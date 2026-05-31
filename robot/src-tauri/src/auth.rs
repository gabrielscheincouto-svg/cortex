//! Gerencia o JWT do Supabase Auth — guardado no chaveiro nativo do sistema
//! (Keychain no macOS, Credential Manager no Windows, Secret Service no Linux).

use crate::error::{RoboError, RoboResult};
use keyring::Entry;
use serde::{Deserialize, Serialize};

const SERVICE: &str = "br.com.cecopel.robot";
const USER: &str = "auth";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredCredentials {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64, // unix epoch seconds
    pub email: String,
    pub user_id: String,
}

impl StoredCredentials {
    fn entry() -> RoboResult<Entry> {
        Entry::new(SERVICE, USER).map_err(RoboError::from)
    }

    /// Armazena credenciais no chaveiro do sistema.
    pub fn save(&self) -> RoboResult<()> {
        let entry = Self::entry()?;
        let payload = serde_json::to_string(self)?;
        entry.set_password(&payload)?;
        Ok(())
    }

    /// Recupera credenciais do chaveiro. Retorna `Ok(None)` se não houver nada salvo.
    pub fn load() -> RoboResult<Option<Self>> {
        let entry = Self::entry()?;
        match entry.get_password() {
            Ok(p)  => Ok(Some(serde_json::from_str(&p)?)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(RoboError::Keyring(e)),
        }
    }

    /// Apaga as credenciais (logout).
    pub fn clear() -> RoboResult<()> {
        let entry = Self::entry()?;
        match entry.delete_credential() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(RoboError::Keyring(e)),
        }
    }

    pub fn is_expired(&self) -> bool {
        let now = chrono::Utc::now().timestamp();
        self.expires_at <= now + 60 // 1 min de margem
    }
}

/// Faz login direto contra o Supabase Auth (endpoint público `/auth/v1/token`).
///
/// Usado quando o user digita email+senha na tela de configuração do robô.
/// O robô nunca enxerga a senha depois disso — só guarda o JWT no chaveiro.
pub async fn login_password(
    supabase_url: &str,
    supabase_anon_key: &str,
    email: &str,
    password: &str,
) -> RoboResult<StoredCredentials> {
    #[derive(Serialize)]
    struct Req<'a> { email: &'a str, password: &'a str }
    #[derive(Deserialize)]
    struct Resp {
        access_token: String,
        refresh_token: String,
        expires_in: i64,
        user: User,
    }
    #[derive(Deserialize)]
    struct User { id: String, email: String }

    let url = format!("{}/auth/v1/token?grant_type=password", supabase_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("apikey", supabase_anon_key)
        .header("Content-Type", "application/json")
        .json(&Req { email, password })
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(RoboError::Auth(format!("login falhou ({status}): {body}")));
    }

    let r: Resp = resp.json().await?;
    Ok(StoredCredentials {
        access_token: r.access_token,
        refresh_token: r.refresh_token,
        expires_at: chrono::Utc::now().timestamp() + r.expires_in,
        email: r.user.email,
        user_id: r.user.id,
    })
}

/// Atualiza o JWT usando o refresh_token (chamado quando is_expired() é true).
pub async fn refresh_token(
    supabase_url: &str,
    supabase_anon_key: &str,
    refresh_token: &str,
) -> RoboResult<StoredCredentials> {
    #[derive(Serialize)]
    struct Req<'a> { refresh_token: &'a str }
    #[derive(Deserialize)]
    struct Resp {
        access_token: String,
        refresh_token: String,
        expires_in: i64,
        user: User,
    }
    #[derive(Deserialize)]
    struct User { id: String, email: String }

    let url = format!("{}/auth/v1/token?grant_type=refresh_token", supabase_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("apikey", supabase_anon_key)
        .header("Content-Type", "application/json")
        .json(&Req { refresh_token })
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(RoboError::Auth(format!("refresh falhou: {}", resp.status())));
    }
    let r: Resp = resp.json().await?;
    Ok(StoredCredentials {
        access_token: r.access_token,
        refresh_token: r.refresh_token,
        expires_at: chrono::Utc::now().timestamp() + r.expires_in,
        email: r.user.email,
        user_id: r.user.id,
    })
}
