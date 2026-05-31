use serde::{Serialize, Serializer};
use thiserror::Error;

/// Erros do robô. Implementa `Serialize` para que possam ser devolvidos
/// como respostas de comandos Tauri ao frontend.
#[derive(Debug, Error)]
pub enum RoboError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    #[error("json: {0}")]
    Json(#[from] serde_json::Error),

    #[error("http: {0}")]
    Http(#[from] reqwest::Error),

    #[error("watcher: {0}")]
    Watch(#[from] notify::Error),

    #[error("regex: {0}")]
    Regex(#[from] regex::Error),

    #[error("keyring: {0}")]
    Keyring(#[from] keyring::Error),

    #[error("config: {0}")]
    Config(String),

    #[error("auth: {0}")]
    Auth(String),

    #[error("identifier: {0}")]
    Identifier(String),

    #[error("upload: {0}")]
    Upload(String),

    #[error("{0}")]
    Other(String),
}

impl Serialize for RoboError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(self.to_string().as_ref())
    }
}

pub type RoboResult<T> = Result<T, RoboError>;
