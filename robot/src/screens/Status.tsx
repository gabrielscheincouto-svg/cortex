import { useEffect, useState } from 'react'
import { Activity, CheckCircle2, AlertTriangle, FileText, Folder, LogOut, RefreshCw, Server } from 'lucide-react'
import { Button, Card, Pill } from '../lib/ui'
import { tauri, type PipelineEvent, type Status as RoboStatus } from '../lib/tauri'

interface LogLine {
  id: number
  ts: number
  ev: PipelineEvent
}

function summarize(ev: PipelineEvent): { label: string; tone: 'ok' | 'warn' | 'err' | 'info'; detail?: string } {
  switch (ev.kind) {
    case 'file_detected':     return { label: 'Arquivo detectado',         tone: 'info', detail: ev.path }
    case 'identified':        return { label: `Identificado: ${ev.obrigacao_codigo}`, tone: 'info', detail: `${ev.cnpj ?? '—'} · ${ev.competencia ?? '—'}` }
    case 'skipped':           return { label: 'Ignorado',                  tone: 'warn', detail: ev.motivo }
    case 'uploaded':          return { label: 'Enviado',                   tone: 'ok',   detail: `entrega ${ev.entrega_id.slice(0,8)}` }
    case 'upload_error':      return { label: 'Erro no upload',            tone: 'err',  detail: ev.erro }
    case 'heartbeat_sent':    return { label: 'Heartbeat',                 tone: 'info' }
    case 'catalog_refreshed': return { label: `Catálogo: ${ev.obrigacoes} obrigações`, tone: 'info' }
  }
}

const toneClasses: Record<'ok' | 'warn' | 'err' | 'info', string> = {
  ok:   'bg-emerald-100 text-emerald-900 ring-emerald-300',
  warn: 'bg-amber-100 text-amber-900 ring-amber-300',
  err:  'bg-rose-100 text-rose-900 ring-rose-300',
  info: 'bg-ink-100 text-ink-700 ring-ink-200',
}

export function Status({ status, onLogout, onChangeFolder }: {
  status: RoboStatus
  onLogout: () => void
  onChangeFolder: () => void
}) {
  const [log, setLog] = useState<LogLine[]>([])
  const [counter, setCounter] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let unlisten: (() => void) | undefined
    let id = 0
    ;(async () => {
      unlisten = await tauri.onPipelineEvent(ev => {
        id += 1
        setLog(prev => [{ id, ts: Date.now(), ev }, ...prev].slice(0, 100))
        if (ev.kind === 'uploaded') setCounter(c => c + 1)
      })
    })()
    return () => { unlisten?.() }
  }, [])

  async function refresh() {
    setRefreshing(true)
    try {
      await tauri.refreshCatalog()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <main className="flex h-full flex-col gap-4 p-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Robô ativo</h1>
          <p className="text-xs text-ink-500">
            {status.email} · {status.hostname} · v{status.version}
          </p>
        </div>
        <Button variant="ghost" icon={LogOut} onClick={onLogout}>Sair</Button>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Card className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Status</p>
          <div className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            monitorando
          </div>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Enviados (sessão)</p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">{counter}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">API</p>
          <p className="mt-1 truncate text-xs font-mono text-ink-700">{status.api_url}</p>
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <Folder size={18} className="text-ink-700" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Pasta monitorada</p>
            <p className="truncate text-sm font-mono text-ink-900">{status.watch_dir ?? 'nenhuma'}</p>
          </div>
          <Button variant="secondary" onClick={onChangeFolder}>Trocar</Button>
          <Button variant="ghost" icon={RefreshCw} onClick={refresh} disabled={refreshing}>
            {refreshing ? 'Atualizando...' : 'Catálogo'}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-1 flex-col p-0">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-ink-700" />
            <p className="text-sm font-semibold text-ink-900">Atividade recente</p>
          </div>
          <Pill className="bg-ink-100 text-ink-700 ring-ink-200">{log.length}</Pill>
        </div>

        <div className="flex-1 overflow-auto">
          {log.length === 0 ? (
            <div className="flex h-full items-center justify-center p-10 text-center">
              <div>
                <FileText size={32} className="mx-auto mb-3 text-ink-300" />
                <p className="text-sm text-ink-500">Aguardando arquivos...</p>
                <p className="mt-1 text-xs text-ink-400">Salve um SPED ou guia na pasta monitorada para testar.</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-black/5">
              {log.map(line => {
                const s = summarize(line.ev)
                return (
                  <li key={line.id} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="mt-0.5">{toneIcon(s.tone)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900">{s.label}</p>
                      {s.detail && <p className="truncate text-xs text-ink-500" title={s.detail}>{s.detail}</p>}
                    </div>
                    <span className="shrink-0 text-[11px] text-ink-400">
                      {new Date(line.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>
    </main>
  )
}

function toneIcon(tone: 'ok' | 'warn' | 'err' | 'info') {
  const props = { size: 16 }
  switch (tone) {
    case 'ok':   return <CheckCircle2 {...props} className="text-emerald-600" />
    case 'warn': return <AlertTriangle {...props} className="text-amber-600" />
    case 'err':  return <AlertTriangle {...props} className="text-rose-600" />
    case 'info': return <Server {...props} className="text-ink-400" />
  }
}
