/** Ponte tipada com os comandos Rust expostos em src-tauri/src/main.rs. */

import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { open as openDialog } from '@tauri-apps/plugin-dialog'

export interface Status {
  hostname: string
  api_url: string
  watch_dir: string | null
  logged_in: boolean
  email: string | null
  version: string
}

export interface LoginResult {
  email: string
  user_id: string
}

export type PipelineEvent =
  | { kind: 'file_detected';     path: string }
  | { kind: 'identified';        path: string; obrigacao_codigo: string; cnpj?: string; competencia?: string }
  | { kind: 'skipped';           path: string; motivo: string }
  | { kind: 'uploaded';          path: string; entrega_id: string; arquivo_id: string; status: string }
  | { kind: 'upload_error';      path: string; erro: string }
  | { kind: 'heartbeat_sent' }
  | { kind: 'catalog_refreshed'; obrigacoes: number }

export const tauri = {
  getStatus:        ()                                                       => invoke<Status>('cmd_get_status'),
  setWatchDir:      (dir: string)                                            => invoke<void>('cmd_set_watch_dir', { dir }),
  setApiUrl:        (url: string)                                            => invoke<void>('cmd_set_api_url', { url }),
  login:            (supabaseUrl: string, supabaseAnonKey: string, email: string, password: string) =>
    invoke<LoginResult>('cmd_login', { supabaseUrl, supabaseAnonKey, email, password }),
  logout:           ()                                                       => invoke<void>('cmd_logout'),
  refreshCatalog:   ()                                                       => invoke<number>('cmd_refresh_catalog'),

  onPipelineEvent:  (cb: (ev: PipelineEvent) => void): Promise<UnlistenFn>   =>
    listen<PipelineEvent>('pipeline://event', e => cb(e.payload)),

  pickDirectory:    async (): Promise<string | null> => {
    const dir = await openDialog({ directory: true, multiple: false, title: 'Escolha a pasta a monitorar' })
    return typeof dir === 'string' ? dir : null
  },
}
