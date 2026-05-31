import { useState } from 'react'
import { Folder, ChevronRight } from 'lucide-react'
import { Button, Card } from '../lib/ui'
import { tauri } from '../lib/tauri'

/** Tela inicial pós-login: escolher pasta monitorada. */
export function Setup({ onDone }: { onDone: () => void }) {
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pickFolder() {
    setError(null)
    setPicking(true)
    try {
      const dir = await tauri.pickDirectory()
      if (!dir) { setPicking(false); return }
      await tauri.setWatchDir(dir)
      await tauri.refreshCatalog()
      onDone()
    } catch (err) {
      setError(String(err))
    } finally {
      setPicking(false)
    }
  }

  return (
    <main className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <h1 className="text-xl font-semibold text-ink-900">Aponte a pasta</h1>
        <p className="mt-1 text-sm text-ink-500">
          Selecione a pasta onde o seu software fiscal gera os arquivos (SPED, DCTFWeb, guias, recibos).
          O robô vai monitorar essa pasta e enviar automaticamente o que reconhecer.
        </p>

        <div className="mt-5 rounded-lg border border-dashed border-black/15 bg-ink-50 p-6 text-center">
          <Folder size={36} className="mx-auto mb-3 text-ink-400" />
          <p className="text-sm text-ink-700">Clique em escolher para abrir o seletor de pasta.</p>
          <p className="mt-1 text-xs text-ink-400">Exemplo: <span className="font-mono">~/Documents/Cecopel/Saida</span></p>
          <Button variant="primary" className="mx-auto mt-4" onClick={pickFolder} disabled={picking}>
            {picking ? 'Aguardando...' : 'Escolher pasta'} <ChevronRight size={14} />
          </Button>
        </div>

        {error && <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

        <ul className="mt-5 space-y-1.5 text-xs text-ink-500">
          <li>• Você pode mudar a pasta a qualquer momento em Configurações</li>
          <li>• Subpastas também são monitoradas (recursivo)</li>
          <li>• Arquivos invisíveis (.DS_Store, etc.) e temporários são ignorados</li>
        </ul>
      </Card>
    </main>
  )
}
