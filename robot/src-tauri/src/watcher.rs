//! Observador de pasta cross-platform.
//!
//! Usa `notify` (FSEvents no macOS, ReadDirectoryChangesW no Win, inotify no Linux)
//! com `notify-debouncer-full` para evitar processar o mesmo arquivo várias vezes
//! enquanto está sendo escrito.

use crate::error::{RoboError, RoboResult};
use notify::{RecursiveMode, Watcher};
use notify_debouncer_full::{new_debouncer, DebounceEventResult};
use std::{
    path::{Path, PathBuf},
    sync::mpsc,
    time::Duration,
};
use tokio::sync::mpsc as tokio_mpsc;
use tracing::{info, warn};

/// Evento de filesystem entregue ao pipeline.
#[derive(Debug, Clone)]
pub struct FileEvent {
    pub path: PathBuf,
}

/// Inicia o watcher em background. Retorna um receiver assíncrono com paths novos/modificados.
///
/// Por padrão, monitora recursivo e debounce de 2 segundos (espera o arquivo terminar de gravar).
pub fn spawn(watch_dir: &Path) -> RoboResult<tokio_mpsc::Receiver<FileEvent>> {
    if !watch_dir.exists() {
        return Err(RoboError::Other(format!(
            "pasta não existe: {}",
            watch_dir.display()
        )));
    }

    info!(target: "watcher", dir = %watch_dir.display(), "iniciando watcher");

    let (sync_tx, sync_rx) = mpsc::channel::<DebounceEventResult>();
    let (tx, rx) = tokio_mpsc::channel::<FileEvent>(256);
    let watch_dir_clone = watch_dir.to_path_buf();

    let mut debouncer = new_debouncer(Duration::from_secs(2), None, sync_tx)
        .map_err(RoboError::Watch)?;
    debouncer
        .watcher()
        .watch(&watch_dir_clone, RecursiveMode::Recursive)
        .map_err(RoboError::Watch)?;

    // Thread que faz ponte do canal síncrono do `notify` → canal Tokio.
    // O debouncer precisa permanecer vivo enquanto a thread roda.
    std::thread::spawn(move || {
        let _keep_alive = debouncer; // não dropar o debouncer
        while let Ok(result) = sync_rx.recv() {
            match result {
                Ok(events) => {
                    for ev in events {
                        for path in ev.event.paths.iter() {
                            // Ignora diretórios e arquivos invisíveis (`.DS_Store`, etc.)
                            if path.is_dir() { continue; }
                            if is_hidden_or_temp(path) { continue; }
                            let _ = tx.blocking_send(FileEvent { path: path.clone() });
                        }
                    }
                }
                Err(errs) => {
                    for e in errs {
                        warn!(target: "watcher", error = %e, "evento de erro");
                    }
                }
            }
        }
    });

    Ok(rx)
}

fn is_hidden_or_temp(path: &Path) -> bool {
    if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
        if name.starts_with('.') { return true; }
        if name.ends_with(".tmp") || name.ends_with("~") || name.ends_with(".crdownload") {
            return true;
        }
    }
    false
}
