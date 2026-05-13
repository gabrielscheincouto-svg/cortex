import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tauri serve o webview localmente. Estas portas/configs são padrão.
export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  // Tauri precisa que tudo seja relativo (sem domínio fixo).
  build: { target: 'esnext' },
}))
