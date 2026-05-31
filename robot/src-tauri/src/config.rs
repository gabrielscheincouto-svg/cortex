use crate::error::{RoboError, RoboResult};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

/// Configuração persistida em disco (~/Library/Application Support/.../config.json em macOS,
/// %APPDATA%\... em Windows).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// URL base da API Go (ex: https://api.cecopel.com.br)
    pub api_url: String,

    /// Pasta local que o robô monitora.
    pub watch_dir: Option<PathBuf>,

    /// Hostname enviado em cada upload (para o admin saber qual máquina enviou).
    pub hostname: String,

    /// Org atual do user logado. Recebido da API ao logar.
    pub current_org_id: Option<String>,

    /// Auto-iniciar com o sistema.
    pub auto_start: bool,
}

impl Default for Config {
    fn default() -> Self {
        let hostname = hostname::get_hostname();
        Self {
            api_url: "https://api.cecopel.com.br".into(),
            watch_dir: None,
            hostname,
            current_org_id: None,
            auto_start: true,
        }
    }
}

impl Config {
    pub fn load() -> RoboResult<Self> {
        let path = config_path()?;
        if !path.exists() {
            let default = Self::default();
            default.save()?;
            return Ok(default);
        }
        let raw = fs::read_to_string(&path)?;
        Ok(serde_json::from_str(&raw)?)
    }

    pub fn save(&self) -> RoboResult<()> {
        let path = config_path()?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, serde_json::to_string_pretty(self)?)?;
        Ok(())
    }
}

pub fn config_dir() -> RoboResult<PathBuf> {
    let proj = ProjectDirs::from("br", "CECOPEL", "robot")
        .ok_or_else(|| RoboError::Config("não foi possível resolver diretório de config".into()))?;
    Ok(proj.config_dir().to_path_buf())
}

pub fn config_path() -> RoboResult<PathBuf> {
    Ok(config_dir()?.join("config.json"))
}

/// Diretório de logs locais.
pub fn log_dir() -> RoboResult<PathBuf> {
    let proj = ProjectDirs::from("br", "CECOPEL", "robot")
        .ok_or_else(|| RoboError::Config("diretório de log indisponível".into()))?;
    let dir = proj.data_local_dir().join("logs");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

mod hostname {
    /// Best-effort: retorna o hostname do sistema, ou "desconhecido".
    pub fn get_hostname() -> String {
        std::env::var("HOSTNAME")
            .or_else(|_| std::env::var("COMPUTERNAME"))
            .unwrap_or_else(|_| "desconhecido".into())
    }
}
