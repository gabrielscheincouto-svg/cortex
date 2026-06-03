/// <reference types="vite/client" />

/**
 * Tipagem das envvars do Vite usadas no robô.
 * VITE_* são embutidas no bundle em build time (vide robot-release.yml).
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
