#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
//! Entrypoint do robô CECOPEL.
//!
//! Stack: Tauri 2 + tokio. O Rust core roda em background (watcher + pipeline);
//! o webview é uma janela que pode ser fechada/escondida — o app continua
//! vivo na bandeja do sistema.

mod auth;
mod config;
mod error;
mod identifier;
mod parser;
mod pipeline;
mod uploader;
mod watcher;

use crate::auth::StoredCredentials;
use crate::config::Config;
use crate::error::{RoboError, RoboResult};
use crate::pipeline::Pipeline;
use crate::uploader::Uploader;
use serde::Serialize;
use std::sync::Arc;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, RunEvent, State,
};
use tokio::sync::{Mutex, RwLock};
use tracing::{error, info};
use tracing_subscriber::EnvFilter;

/// Estado compartilhado entre comandos Tauri.
pub struct AppState {
    pub config:   Arc<RwLock<Config>>,
    pub uploader: Arc<Uploader>,
    pub pipeline: Arc<Pipeline>,
    pub watcher_task: Mutex<Option<tokio::task::JoinHandle<()>>>,
}

// ─── Comandos expostos ao frontend ────────────────────────────

#[tauri::command]
async fn cmd_get_status(state: State<'_, AppState>) -> RoboResult<Status> {
    let cfg = state.config.read().await.clone();
    let creds = StoredCredentials::load()?;
    Ok(Status {
        hostname: cfg.hostname,
        api_url: cfg.api_url,
        watch_dir: cfg.watch_dir.map(|p| p.display().to_string()),
        logged_in: creds.is_some(),
        email: creds.as_ref().map(|c| c.email.clone()),
        version: env!("CARGO_PKG_VERSION").into(),
    })
}

#[tauri::command]
async fn cmd_set_watch_dir(state: State<'_, AppState>, dir: String) -> RoboResult<()> {
    let path = std::path::PathBuf::from(&dir);
    if !path.exists() {
        return Err(RoboError::Config(format!("pasta não existe: {dir}")));
    }
    {
        let mut cfg = state.config.write().await;
        cfg.watch_dir = Some(path.clone());
        cfg.save()?;
    }
    // Restarta o watcher
    let pipeline = state.pipeline.clone();
    let new_task = restart_watcher(pipeline, path).await?;
    let mut guard = state.watcher_task.lock().await;
    if let Some(old) = guard.replace(new_task) {
        old.abort();
    }
    Ok(())
}

#[tauri::command]
async fn cmd_set_api_url(state: State<'_, AppState>, url: String) -> RoboResult<()> {
    let mut cfg = state.config.write().await;
    cfg.api_url = url;
    cfg.save()?;
    Ok(())
}

#[tauri::command]
async fn cmd_login(
    supabase_url: String,
    supabase_anon_key: String,
    email: String,
    password: String,
) -> RoboResult<LoginResult> {
    let creds = auth::login_password(&supabase_url, &supabase_anon_key, &email, &password).await?;
    creds.save()?;
    Ok(LoginResult { email: creds.email, user_id: creds.user_id })
}

#[tauri::command]
async fn cmd_logout() -> RoboResult<()> {
    StoredCredentials::clear()
}

#[tauri::command]
async fn cmd_refresh_catalog(state: State<'_, AppState>) -> RoboResult<usize> {
    state.pipeline.refresh_catalog().await?;
    Ok(state.pipeline.catalog.read().await.len())
}

#[tauri::command]
async fn cmd_test_upload(_state: State<'_, AppState>, _path: String) -> RoboResult<()> {
    // Reservado para uma futura UI de "testar com este arquivo agora"
    Ok(())
}

// ─── DTOs ─────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct Status {
    hostname: String,
    api_url: String,
    watch_dir: Option<String>,
    logged_in: bool,
    email: Option<String>,
    version: String,
}

#[derive(Debug, Serialize)]
struct LoginResult {
    email: String,
    user_id: String,
}

// ─── Inicialização ────────────────────────────────────────────

async fn restart_watcher(pipeline: Arc<Pipeline>, dir: std::path::PathBuf) -> RoboResult<tokio::task::JoinHandle<()>> {
    let rx = watcher::spawn(&dir)?;
    Ok(tokio::spawn(async move {
        pipeline.run(rx).await;
    }))
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let abrir = MenuItem::with_id(app, "open",  "Abrir CECOPEL Robô", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "Pausar monitoramento", true, None::<&str>)?;
    let quit  = MenuItem::with_id(app, "quit",  "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&abrir, &pause, &quit])?;

    let icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png")).unwrap_or_else(|_| {
        // Fallback: pixel transparente 1x1 PNG mínimo. Garante que o build não quebra antes do ícone existir.
        Image::from_bytes(&[
            0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
            0,0,0,1,0,0,0,1,8,6,0,0,0,0x1F,0x15,0xC4,0x89,
            0,0,0,0x0A,0x49,0x44,0x41,0x54,0x78,0x9C,0x63,0,1,0,0,5,0,1,0x0D,0x0A,0x2D,0xB4,
            0,0,0,0,0x49,0x45,0x4E,0x44,0xAE,0x42,0x60,0x82,
        ]).expect("png fallback inválido")
    });

    let _tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .menu(&menu)
        .icon_as_template(true)
        .tooltip("CECOPEL Robô")
        .on_menu_event(move |app, ev| match ev.id.as_ref() {
            "open"  => { let _ = app.get_webview_window("main").map(|w| { let _ = w.show(); let _ = w.set_focus(); }); }
            "pause" => { info!("pausar — TODO"); }
            "quit"  => { app.exit(0); }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn main() {
    // Tracing — logs em JSON em release, console legível em debug
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::fmt().with_env_filter(filter).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // 1) Config
            let cfg = Arc::new(RwLock::new(Config::load().expect("load config")));
            let api_url = cfg.blocking_read().api_url.clone();

            // 2) Uploader (cliente HTTP único, compartilhado)
            let uploader = Arc::new(Uploader::new(api_url));

            // 3) Pipeline
            let pipeline = Arc::new(Pipeline::new(app.handle().clone(), cfg.clone(), uploader.clone()));

            // 4) Estado
            let state = AppState {
                config:   cfg.clone(),
                uploader: uploader.clone(),
                pipeline: pipeline.clone(),
                watcher_task: Mutex::new(None),
            };
            app.manage(state);

            // 5) Tray icon
            if let Err(e) = build_tray(app.handle()) {
                error!("tray: {e}");
            }

            // 6) Jobs em background: refresh catálogo + heartbeat + watcher inicial
            let app_handle = app.handle().clone();
            let pipeline_bg = pipeline.clone();
            let cfg_bg = cfg.clone();
            tauri::async_runtime::spawn(async move {
                // tenta atualizar catálogo
                let _ = pipeline_bg.refresh_catalog().await;

                // sobe o watcher se a pasta está configurada
                if let Some(dir) = cfg_bg.read().await.watch_dir.clone() {
                    if let Ok(task) = restart_watcher(pipeline_bg.clone(), dir).await {
                        if let Some(state) = app_handle.try_state::<AppState>() {
                            *state.watcher_task.lock().await = Some(task);
                        }
                    }
                }

                // loop de heartbeat + catalog refresh
                let mut tick = tokio::time::interval(std::time::Duration::from_secs(60));
                let mut catalog_tick = 0u32;
                loop {
                    tick.tick().await;
                    let _ = pipeline_bg.send_heartbeat().await;
                    catalog_tick += 1;
                    if catalog_tick >= 30 { // ~30 min
                        catalog_tick = 0;
                        let _ = pipeline_bg.refresh_catalog().await;
                    }
                }
            });

            // 7) Janela: começa escondida (só tray). Usuário abre pelo menu da bandeja.
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.hide();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd_get_status,
            cmd_set_watch_dir,
            cmd_set_api_url,
            cmd_login,
            cmd_logout,
            cmd_refresh_catalog,
            cmd_test_upload,
        ])
        .build(tauri::generate_context!())
        .expect("erro construindo Tauri")
        .run(|_app, event| {
            // Mantém o app vivo quando a janela é fechada (usuário fecha tudo → vai pra bandeja).
            if let RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}
