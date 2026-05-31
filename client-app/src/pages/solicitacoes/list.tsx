/**
 * Solicitações do cliente — lista de chamados + criação tipada por setor.
 *
 * Fluxo de criação:
 *   1. Cliente clica "Nova solicitação" → abre modal com setores (Contábil, Fiscal,
 *      Pessoal, Societário, Outro)
 *   2. Escolhe setor → mostra os tipos daquele setor (admissão, balancete, etc)
 *   3. Escolhe tipo → renderiza form dinamicamente a partir de campos_form
 *   4. Preenche e envia → INSERT em public.solicitacoes via Supabase
 *      (RLS permite cliente criar solicitação da própria empresa)
 *
 * Lista mostra histórico ordenado por mais recente. Click em uma solicitação
 * abrirá futuramente a página de detalhe com conversa.
 */
import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  MessagesSquare, Plus, AlertTriangle, X, ChevronRight, Clock, CheckCircle2,
} from 'lucide-react'
import { Card, Empty, Button, Input, Textarea, Pill, Spinner } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'
import {
  useSolicitacoes, useSolicitacaoTipos,
  type SolicitacaoTipo, type SolicitacaoStatus, type DepartamentoCodigo, type CampoForm,
} from '@/lib/queries'
import { ago, cn } from '@/lib/utils'

const STATUS_LABEL: Record<SolicitacaoStatus, string> = {
  nova: 'Nova',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Aguardando você',
  resolvida: 'Resolvida',
  fechada: 'Fechada',
  cancelada: 'Cancelada',
}

const STATUS_PILL: Record<SolicitacaoStatus, string> = {
  nova: 'bg-mind-100 text-mind-800 ring-mind-200',
  em_atendimento: 'bg-gold-100 text-gold-800 ring-gold-200',
  aguardando_cliente: 'bg-rose-50 text-rose-800 ring-rose-200',
  resolvida: 'bg-brand-50 text-brand-800 ring-brand-200',
  fechada: 'bg-ink-100 text-ink-600 ring-black/10',
  cancelada: 'bg-ink-100 text-ink-500 ring-black/10',
}

const DEPT_LABEL: Record<DepartamentoCodigo, string> = {
  contabil: 'Contábil',
  fiscal: 'Fiscal',
  pessoal: 'Pessoal',
  societario: 'Societário',
  comercial: 'Comercial',
  rural: 'Rural',
  paralegal: 'Paralegal',
  outro: 'Outros',
}

export function SolicitacoesListPage() {
  const { empresa } = useAuth()
  const solicitacoes = useSolicitacoes(empresa?.id)
  const [novaAberta, setNovaAberta] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">Solicitações</h1>
          <p className="mt-1 text-sm text-ink-500">
            Abra chamados pro escritório e acompanhe as respostas em um só lugar.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setNovaAberta(true)}>
          Nova solicitação
        </Button>
      </div>

      {solicitacoes.isPending ? (
        <Card className="flex items-center justify-center py-12"><Spinner size={20} /></Card>
      ) : solicitacoes.isError ? (
        <Card>
          <Empty
            icon={AlertTriangle}
            title="Erro ao carregar suas solicitações"
            description="Tente atualizar a página em alguns segundos."
          />
        </Card>
      ) : (solicitacoes.data ?? []).length === 0 ? (
        <Card>
          <Empty
            icon={MessagesSquare}
            title="Nenhuma solicitação ainda"
            description="Quando você abrir um chamado, o histórico fica aqui com cada resposta do escritório."
            action={<Button variant="primary" icon={Plus} onClick={() => setNovaAberta(true)}>Abrir primeira solicitação</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {solicitacoes.data!.map(s => (
            <Card key={s.id} className="!p-0">
              <Link
                to={`/solicitacoes/${s.id}`}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-ink-50/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Pill className={STATUS_PILL[s.status]}>{STATUS_LABEL[s.status]}</Pill>
                    {s.departamento_sugerido && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                        {DEPT_LABEL[s.departamento_sugerido as DepartamentoCodigo] ?? s.departamento_sugerido}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm font-semibold text-ink-900">{s.assunto}</p>
                  <p className="text-[11px] text-ink-500">
                    <Clock size={10} className="-mt-0.5 mr-1 inline" />
                    Aberta {ago(s.criada_em)}
                    {s.primeira_resposta_em && (
                      <> · <CheckCircle2 size={10} className="-mt-0.5 mr-1 inline text-brand-600" /> respondida</>
                    )}
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-ink-300" />
              </Link>
            </Card>
          ))}
        </div>
      )}

      {novaAberta && (
        <NovaSolicitacaoModal
          empresaId={empresa?.id}
          onClose={() => setNovaAberta(false)}
        />
      )}
    </div>
  )
}

// ─── Modal de Nova Solicitação ───────────────────────────────────────────

function NovaSolicitacaoModal({ empresaId, onClose }: { empresaId: string | undefined; onClose: () => void }) {
  const qc = useQueryClient()
  const tipos = useSolicitacaoTipos()
  const [etapa, setEtapa] = useState<'setor' | 'tipo' | 'form'>('setor')
  const [setor, setSetor] = useState<DepartamentoCodigo | null>(null)
  const [tipo, setTipo] = useState<SolicitacaoTipo | null>(null)
  const [valores, setValores] = useState<Record<string, string | boolean>>({})
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Trava scroll do body
  useEffect(() => {
    const o = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = o }
  }, [])

  const setoresDisponiveis = useMemo(() => {
    const all = tipos.data ?? []
    const setoresUnicos = Array.from(new Set(all.map(t => t.departamento)))
    return setoresUnicos as DepartamentoCodigo[]
  }, [tipos.data])

  const tiposDoSetor = useMemo(() => {
    if (!setor || !tipos.data) return []
    return tipos.data.filter(t => t.departamento === setor)
  }, [setor, tipos.data])

  async function submeter() {
    if (!tipo || !empresaId) return
    setErro(null)
    // Validar campos obrigatórios
    for (const campo of tipo.campos_form) {
      if (campo.required) {
        const v = valores[campo.name]
        if (v === undefined || v === '' || v === null) {
          setErro(`Campo obrigatório: ${campo.label}`)
          return
        }
      }
    }

    setEnviando(true)
    try {
      const supabase = getSupabase()
      // org_id do tipo (NULL no template global; mas precisa de um org_id pra inserir).
      // Resolvemos via empresa: a empresa pertence a uma org.
      const { data: empRow, error: empErr } = await supabase
        .from('empresas').select('org_id').eq('id', empresaId).single()
      if (empErr || !empRow) throw new Error('empresa não encontrada')

      const assunto = tipo.label
      const descricao = montarDescricao(tipo, valores)

      const { error } = await supabase.from('solicitacoes').insert({
        org_id: (empRow as { org_id: string }).org_id,
        empresa_id: empresaId,
        assunto,
        descricao,
        prioridade: 'media',
        status: 'nova',
        origem: 'app_cliente',
        departamento_sugerido: tipo.departamento,
        tipo_codigo: tipo.codigo,
        dados_form: valores,
        sla_resposta_horas: tipo.sla_resposta_horas,
        sla_resolucao_horas: tipo.sla_resolucao_horas,
      })
      if (error) throw error

      // Invalida listas e fecha
      await qc.invalidateQueries({ queryKey: ['solicitacoes', empresaId] })
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'erro ao enviar solicitação')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div className="flex items-center gap-3">
            {etapa !== 'setor' && (
              <button
                type="button"
                onClick={() => {
                  if (etapa === 'form') { setEtapa('tipo'); setTipo(null); setValores({}) }
                  else if (etapa === 'tipo') { setEtapa('setor'); setSetor(null) }
                }}
                className="text-xs font-medium text-mind-700 hover:text-mind-900"
              >
                ← Voltar
              </button>
            )}
            <h2 className="text-base font-semibold text-ink-900">
              {etapa === 'setor' && 'Para qual setor é a solicitação?'}
              {etapa === 'tipo' && `Sobre o que é, em ${setor ? DEPT_LABEL[setor] : ''}?`}
              {etapa === 'form' && tipo?.label}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          {/* ETAPA 1: Setor */}
          {etapa === 'setor' && (
            <>
              {tipos.isPending ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : tipos.isError ? (
                <p className="text-sm text-rose-700">Não consegui carregar os tipos de chamado.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {setoresDisponiveis.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setSetor(s); setEtapa('tipo') }}
                      className="flex items-center justify-between rounded-xl border border-ink-200 bg-white p-4 text-left transition-colors hover:border-ink-900"
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{DEPT_LABEL[s]}</p>
                        <p className="text-xs text-ink-500">
                          {tipos.data!.filter(t => t.departamento === s).length} tipo(s)
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-ink-400" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ETAPA 2: Tipo */}
          {etapa === 'tipo' && setor && (
            <div className="space-y-2">
              {tiposDoSetor.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setTipo(t); setEtapa('form') }}
                  className="flex w-full items-center justify-between rounded-xl border border-ink-200 bg-white p-4 text-left transition-colors hover:border-ink-900"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900">{t.label}</p>
                    {t.descricao && <p className="mt-0.5 text-xs text-ink-500">{t.descricao}</p>}
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-ink-400">
                      Resposta em até {t.sla_resposta_horas}h
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-ink-400" />
                </button>
              ))}
            </div>
          )}

          {/* ETAPA 3: Form dinâmico */}
          {etapa === 'form' && tipo && (
            <form onSubmit={(e) => { e.preventDefault(); void submeter() }} className="space-y-4">
              {tipo.descricao && (
                <p className="rounded-lg bg-mind-50 px-3 py-2 text-sm text-mind-800">{tipo.descricao}</p>
              )}
              {tipo.campos_form.map(campo => (
                <CampoFormRender
                  key={campo.name}
                  campo={campo}
                  valor={valores[campo.name]}
                  onChange={(v) => setValores(s => ({ ...s, [campo.name]: v }))}
                  disabled={enviando}
                />
              ))}
              {erro && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{erro}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={onClose} disabled={enviando}>Cancelar</Button>
                <Button type="submit" variant="primary" disabled={enviando}>
                  {enviando ? 'Enviando…' : 'Enviar solicitação'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Renderiza um campo do form dinamicamente ─────────────────────────────

function CampoFormRender({
  campo, valor, onChange, disabled,
}: {
  campo: CampoForm
  valor: string | boolean | undefined
  onChange: (v: string | boolean) => void
  disabled: boolean
}) {
  const label = (
    <label className="mb-1 block text-sm font-medium text-ink-800">
      {campo.label}{campo.required && <span className="ml-0.5 text-rose-600">*</span>}
    </label>
  )

  switch (campo.type) {
    case 'textarea':
      return (
        <div>
          {label}
          <Textarea
            rows={3}
            placeholder={campo.placeholder}
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      )
    case 'select':
      return (
        <div>
          {label}
          <select
            className={cn(
              'w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
            )}
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">— Selecione —</option>
            {(campo.options ?? []).map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        </div>
      )
    case 'checkbox':
      return (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-800">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            checked={Boolean(valor)}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
          />
          {campo.label}
        </label>
      )
    case 'date':
      return (
        <div>
          {label}
          <Input
            type="date"
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      )
    case 'number':
      return (
        <div>
          {label}
          <Input
            type="number"
            step="0.01"
            placeholder={campo.placeholder}
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      )
    case 'file':
      // upload de arquivos requer integração com Storage — deixar pra próxima iteração
      return (
        <div>
          {label}
          <p className="text-xs text-ink-500">(upload disponível em breve)</p>
        </div>
      )
    case 'text':
    default:
      return (
        <div>
          {label}
          <Input
            type="text"
            placeholder={campo.placeholder}
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      )
  }
}

/** Compacta os dados do form em texto humanmente legível para gravar em `descricao`. */
function montarDescricao(tipo: SolicitacaoTipo, valores: Record<string, string | boolean>): string {
  const linhas = tipo.campos_form
    .map(c => {
      const v = valores[c.name]
      if (v === undefined || v === '') return null
      if (typeof v === 'boolean') return `${c.label}: ${v ? 'Sim' : 'Não'}`
      return `${c.label}: ${v}`
    })
    .filter(Boolean)
  return linhas.join('\n')
}
