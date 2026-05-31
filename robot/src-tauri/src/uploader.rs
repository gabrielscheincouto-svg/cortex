//! Cliente HTTP que envia arquivos para a API Go.
//!
//! Fluxo:
//!   1. `POST /api/v1/uploads/preparar` para obter URL assinada
//!   2. `PUT` dos bytes direto no Supabase Storage
//!   3. `POST /api/v1/uploads/:id/confirmar` para criar entrega/arquivo
//!
//! A API Go nunca toca os bytes do arquivo; ela só valida contexto e registra
//! os metadados finais depois que o Storage confirma a presença do objeto.

use crate::auth::StoredCredentials;
use crate::error::{RoboError, RoboResult};
use crate::identifier::{Catalog, IdentifiedFile, ObrigacaoCatalogo};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tokio::fs;

#[derive(Debug, Clone)]
pub struct Uploader {
    pub api_url: String,
    pub client: reqwest::Client,
}

#[derive(Debug, Serialize)]
struct PrepararUploadRequest<'a> {
    contexto: &'a str,
    contexto_payload: UploadContextPayload<'a>,
    nome_original: &'a str,
    mime_type: &'a str,
    tamanho_bytes: u64,
    hash_sha256: &'a str,
}

#[derive(Debug, Serialize)]
struct UploadContextPayload<'a> {
    obrigacao_codigo: &'a str,
    obrigacao_id: &'a str,
    cnpj_extraido: Option<&'a str>,
    competencia: Option<&'a str>,
    parser_tipo: Option<&'a str>,
    hostname: &'a str,
    versao_robo: &'a str,
}

#[derive(Debug, Deserialize)]
struct PrepararUploadResponse {
    upload_id: String,
    upload_url: String,
    storage_path: String,
    bucket: String,
}

#[derive(Debug, Deserialize)]
pub struct UploadResponse {
    pub entrega_id: String,
    pub arquivo_id: String,
    pub status: String,
}

impl Uploader {
    pub fn new(api_url: String) -> Self {
        let client = reqwest::Client::builder()
            .user_agent(concat!("cecopel-robot/", env!("CARGO_PKG_VERSION")))
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .expect("falha criando reqwest::Client");
        Self { api_url, client }
    }

    /// Faz upload de um arquivo identificado.
    pub async fn upload(
        &self,
        creds: &StoredCredentials,
        path: &Path,
        identified: &IdentifiedFile,
        hostname: &str,
    ) -> RoboResult<UploadResponse> {
        let filename = path.file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| RoboError::Upload("nome de arquivo inválido".into()))?
            .to_string();
        let bytes = fs::read(path).await?;
        let hash = hash_sha256(&bytes);

        let mut prep = self.preparar_upload(creds, &filename, bytes.len() as u64, &hash, identified, hostname).await?;
        match self.put_bytes(&prep.upload_url, bytes.clone()).await {
            Ok(()) => {}
            Err(RoboError::Upload(msg)) if msg.contains("status 401") || msg.contains("status 403") => {
                prep = self.preparar_upload(creds, &filename, bytes.len() as u64, &hash, identified, hostname).await?;
                self.put_bytes(&prep.upload_url, bytes).await?;
            }
            Err(err) => return Err(err),
        }
        self.confirmar_upload(creds, &prep.upload_id, &hash).await
    }

    async fn preparar_upload(
        &self,
        creds: &StoredCredentials,
        filename: &str,
        len: u64,
        hash: &str,
        identified: &IdentifiedFile,
        hostname: &str,
    ) -> RoboResult<PrepararUploadResponse> {
        let body = PrepararUploadRequest {
            contexto: "robo_entrega",
            contexto_payload: UploadContextPayload {
                obrigacao_codigo: &identified.obrigacao_codigo,
                obrigacao_id: &identified.obrigacao_id,
                cnpj_extraido: identified.cnpj_extraido.as_deref(),
                competencia: identified.competencia_extraida.as_deref(),
                parser_tipo: identified.parser_tipo.as_deref(),
                hostname,
                versao_robo: env!("CARGO_PKG_VERSION"),
            },
            nome_original: filename,
            mime_type: "application/octet-stream",
            tamanho_bytes: len,
            hash_sha256: hash,
        };
        let url = format!("{}/api/v1/uploads/preparar", self.api_url.trim_end_matches('/'));
        let resp = self
            .client
            .post(&url)
            .bearer_auth(&creds.access_token)
            .json(&body)
            .send()
            .await?;

        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(RoboError::Upload(format!("preparar status {status}: {body}")));
        }
        let parsed: PrepararUploadResponse = serde_json::from_str(&body)
            .map_err(|e| RoboError::Upload(format!("resposta inválida: {e} body={body}")))?;
        Ok(parsed)
    }

    async fn put_bytes(&self, upload_url: &str, bytes: Vec<u8>) -> RoboResult<()> {
        let resp = self
            .client
            .put(upload_url)
            .header("Content-Type", "application/octet-stream")
            .body(bytes)
            .send()
            .await?;
        if resp.status().is_success() {
            return Ok(());
        }
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        Err(RoboError::Upload(format!("put status {status}: {body}")))
    }

    async fn confirmar_upload(&self, creds: &StoredCredentials, upload_id: &str, hash: &str) -> RoboResult<UploadResponse> {
        #[derive(Serialize)]
        struct Confirmar<'a> {
            hash_sha256: &'a str,
        }
        let url = format!("{}/api/v1/uploads/{}/confirmar", self.api_url.trim_end_matches('/'), upload_id);
        let resp = self.client
            .post(&url)
            .bearer_auth(&creds.access_token)
            .json(&Confirmar { hash_sha256: hash })
            .send()
            .await?;
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        if status == StatusCode::ACCEPTED || status.is_success() {
            return serde_json::from_str(&body)
                .map_err(|e| RoboError::Upload(format!("resposta inválida: {e} body={body}")));
        }
        Err(RoboError::Upload(format!("confirmar status {status}: {body}")))
    }

    /// Busca o catálogo de obrigações da org do user logado.
    pub async fn fetch_catalog(&self, creds: &StoredCredentials) -> RoboResult<Catalog> {
        let url = format!("{}/api/v1/robo/catalogo", self.api_url.trim_end_matches('/'));
        let resp = self.client.get(&url).bearer_auth(&creds.access_token).send().await?;
        if !resp.status().is_success() {
            return Err(RoboError::Upload(format!("catálogo: {}", resp.status())));
        }
        let items: Vec<ObrigacaoCatalogo> = resp.json().await?;
        Catalog::compile(items)
    }

    /// Envia heartbeat (a cada 1 minuto) para a API saber que esse host está vivo.
    pub async fn heartbeat(&self, creds: &StoredCredentials, hostname: &str) -> RoboResult<()> {
        #[derive(Serialize)]
        struct H<'a> {
            hostname: &'a str,
            versao_robo: &'a str,
            sistema_operacional: &'a str,
            pasta_monitorada: Option<&'a Path>,
        }
        let url = format!("{}/api/v1/robo/heartbeat", self.api_url.trim_end_matches('/'));
        let body = H {
            hostname,
            versao_robo: env!("CARGO_PKG_VERSION"),
            sistema_operacional: std::env::consts::OS,
            pasta_monitorada: None,
        };
        let _ = self.client.post(&url).bearer_auth(&creds.access_token).json(&body).send().await?;
        Ok(())
    }
}

fn hash_sha256(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let bytes = hasher.finalize();
    hex::encode(bytes)
}

/// Helper para nomear arquivos no log local (depuração).
pub fn _file_repr(path: &PathBuf) -> String {
    path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| path.display().to_string())
}
