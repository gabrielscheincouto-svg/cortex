//! Orquestrador: recebe paths do watcher, identifica, faz parse de conteúdo
//! para refinar metadados e dispara o upload.
//!
//! Roda como uma task Tokio única (loop). Eventos do frontend são enviados via `app_handle.emit`.

use crate::auth::StoredCredentials;
use crate::config::Config;
use crate::error::RoboResult;
use crate::identifier::{Catalog, IdentifiedFile};
use crate::parser;
use crate::uploader::{UploadResponse, Uploader};
use crate::watcher::FileEvent;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, RwLock};
use tracing::{error, info, warn};

/// Eventos que o pipeline emite para o frontend (Tauri event system).
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum PipelineEvent {
    FileDetected     { path: String },
    Identified       { path: String, obrigacao_codigo: String, cnpj: Option<String>, competencia: Option<String> },
    Skipped          { path: String, motivo: String },
    Uploaded         { path: String, entrega_id: String, arquivo_id: String, status: String },
    UploadError      { path: String, erro: String },
    HeartbeatSent,
    CatalogRefreshed { obrigacoes: usize },
}

#[derive(Clone)]
pub struct Pipeline {
    pub config:   Arc<RwLock<Config>>,
    pub catalog:  Arc<RwLock<Catalog>>,
    pub uploader: Arc<Uploader>,
    pub app:      AppHandle,
}

impl Pipeline {
    pub fn new(app: AppHandle, config: Arc<RwLock<Config>>, uploader: Arc<Uploader>) -> Self {
        Self { app, config, uploader, catalog: Arc::new(RwLock::new(Catalog::default())) }
    }

    /// Consome o canal de eventos do watcher e processa cada arquivo.
    pub async fn run(&self, mut rx: mpsc::Receiver<FileEvent>) {
        info!(target: "pipeline", "iniciado");
        while let Some(ev) = rx.recv().await {
            let pipeline = self.clone();
            tokio::spawn(async move {
                if let Err(e) = pipeline.process(ev.path).await {
                    error!(target: "pipeline", err = %e, "falha processando arquivo");
                }
            });
        }
    }

    /// Atualiza o catálogo de obrigações em memória. Roda no startup e periodicamente.
    pub async fn refresh_catalog(&self) -> RoboResult<()> {
        let Some(creds) = StoredCredentials::load()? else {
            warn!(target: "pipeline", "sem credenciais, pulando refresh do catálogo");
            return Ok(());
        };
        let catalog = self.uploader.fetch_catalog(&creds).await?;
        let len = catalog.len();
        *self.catalog.write().await = catalog;
        let _ = self.app.emit("pipeline://event", PipelineEvent::CatalogRefreshed { obrigacoes: len });
        info!(target: "pipeline", n = len, "catálogo atualizado");
        Ok(())
    }

    /// Envia heartbeat. Chamado periodicamente.
    pub async fn send_heartbeat(&self) -> RoboResult<()> {
        let Some(creds) = StoredCredentials::load()? else { return Ok(()); };
        let cfg = self.config.read().await.clone();
        self.uploader.heartbeat(&creds, &cfg.hostname).await?;
        let _ = self.app.emit("pipeline://event", PipelineEvent::HeartbeatSent);
        Ok(())
    }

    async fn process(&self, path: PathBuf) -> RoboResult<()> {
        let path_str = path.display().to_string();
        let _ = self.app.emit("pipeline://event", PipelineEvent::FileDetected { path: path_str.clone() });

        let catalog = self.catalog.read().await;
        let mut identified: IdentifiedFile = match catalog.identify(&path) {
            Some(i) => i,
            None => {
                let _ = self.app.emit("pipeline://event", PipelineEvent::Skipped {
                    path: path_str.clone(),
                    motivo: "nenhuma obrigação combina com o nome do arquivo".into(),
                });
                return Ok(());
            }
        };
        drop(catalog);

        // Refina CNPJ/competência pelo conteúdo se houver parser correspondente
        if let Some(tipo) = identified.parser_tipo.as_deref() {
            if let Some(parser) = parser::for_tipo(tipo) {
                let hint = parser.parse(&path);
                if identified.cnpj_extraido.is_none() {
                    identified.cnpj_extraido = hint.cnpj.clone();
                }
                if identified.competencia_extraida.is_none() {
                    identified.competencia_extraida = hint.competencia.clone();
                }
            }
        }

        let _ = self.app.emit("pipeline://event", PipelineEvent::Identified {
            path: path_str.clone(),
            obrigacao_codigo: identified.obrigacao_codigo.clone(),
            cnpj: identified.cnpj_extraido.clone(),
            competencia: identified.competencia_extraida.clone(),
        });

        let Some(creds) = StoredCredentials::load()? else {
            let _ = self.app.emit("pipeline://event", PipelineEvent::Skipped {
                path: path_str,
                motivo: "robô não está logado".into(),
            });
            return Ok(());
        };

        let cfg = self.config.read().await.clone();
        match self.uploader.upload(&creds, &path, &identified, &cfg.hostname).await {
            Ok(UploadResponse { entrega_id, arquivo_id, status }) => {
                let _ = self.app.emit("pipeline://event", PipelineEvent::Uploaded {
                    path: path_str,
                    entrega_id,
                    arquivo_id,
                    status,
                });
            }
            Err(e) => {
                let _ = self.app.emit("pipeline://event", PipelineEvent::UploadError {
                    path: path_str,
                    erro: e.to_string(),
                });
                return Err(e);
            }
        }
        Ok(())
    }
}
