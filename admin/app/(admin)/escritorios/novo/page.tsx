'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Copy, CheckCircle2 } from 'lucide-react'
import { Card, CardHeader, Button, Input } from '@/components/ui'

type Plano = 'free' | 'pro' | 'enterprise'

interface CriarResponse {
  org: { id: string; slug: string; nome: string }
  admin: {
    email: string
    nome: string
    invite_status: 'enviado'
    login_url: string
  }
}

export default function NovoEscritorioPage() {
  const router = useRouter()

  const [slug, setSlug] = useState('')
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [plano, setPlano] = useState<Plano>('pro')
  const [adminNome, setAdminNome] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<CriarResponse | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const r = await fetch('/api/escritorios/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug.trim().toLowerCase(),
          nome: nome.trim(),
          cnpj: cnpj.trim() || undefined,
          razao_social: razaoSocial.trim() || undefined,
          plano_codigo: plano,
          admin_email: adminEmail.trim().toLowerCase(),
          admin_nome: adminNome.trim(),
        }),
      })
      const j = (await r.json()) as CriarResponse | { error: string }
      if (!r.ok || 'error' in j) {
        throw new Error('error' in j ? j.error : 'erro desconhecido')
      }
      setResultado(j)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function copiarCredenciais() {
    if (!resultado) return
    const texto = `Olá ${resultado.admin.nome}!

Você foi convidado pra administrar a ${resultado.org.nome} no Cortex —
o sistema do escritório contábil.

Enviamos um email para ${resultado.admin.email} com o link de ativação.
Clique no link, defina sua senha e comece a usar.

Caso não receba em 5 min, confira a caixa de spam.

Depois você acessa em: ${resultado.admin.login_url}`
    navigator.clipboard.writeText(texto)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ─── Tela de sucesso ───────────────────────────────────────────
  if (resultado) {
    return (
      <div className="max-w-2xl space-y-6">
        <Link
          href="/escritorios"
          className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft size={14} /> Voltar para escritórios
        </Link>

        <Card>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink-900">
                Escritório criado · {resultado.org.nome}
              </h2>
              <p className="text-sm text-ink-500">
                Convite enviado pro email do admin. Ele define a senha e completa o cadastro.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-4 text-sm">
            <div className="mb-2">
              <span className="text-ink-500">Email convidado:</span>{' '}
              <span className="font-medium text-ink-900">{resultado.admin.email}</span>
            </div>
            <div className="mb-2">
              <span className="text-ink-500">Nome:</span>{' '}
              <span className="text-ink-900">{resultado.admin.nome}</span>
            </div>
            <div className="mb-2">
              <span className="text-ink-500">URL final:</span>{' '}
              <a className="text-mind-700 hover:underline font-mono" href={resultado.admin.login_url} target="_blank" rel="noreferrer">
                {resultado.admin.login_url}
              </a>
            </div>
            <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              ⓘ O email pode demorar até 1 minuto. Se ele não receber, confira spam ou
              configure SMTP próprio em <span className="font-mono">Supabase → Auth → SMTP Settings</span>
              {' '}(o padrão tem limite de ~4 emails/hora).
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="primary" onClick={copiarCredenciais}>
              <Copy size={14} />
              {copied ? 'Copiado!' : 'Copiar mensagem pronta'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push(`/escritorios/${resultado.org.id}`)}
            >
              Abrir detalhe do escritório
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setResultado(null)
                setSlug(''); setNome(''); setCnpj(''); setRazaoSocial('')
                setAdminNome(''); setAdminEmail('')
              }}
            >
              Criar outro
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // ─── Formulário ────────────────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/escritorios" className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={14} /> Voltar para escritórios
      </Link>

      <Card>
        <CardHeader
          title="Novo escritório"
          subtitle="Cria o tenant + admin inicial do escritório (com senha temporária). Trial de 14 dias começa agora."
        />

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ─── Dados do escritório ── */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">
              Dados do escritório
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700">Slug (subdomínio)</label>
                <Input
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  placeholder="meu-escritorio"
                  required
                  pattern="[a-z0-9-]+"
                />
                <p className="mt-1 text-xs text-ink-400">
                  Vira o subdomínio:{' '}
                  <span className="font-mono">{slug || 'slug'}.usecortex.com.br</span>
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700">Nome</label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Aurora Contabilidade" required />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700">CNPJ (opcional)</label>
                <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700">Razão social (opcional)</label>
                <Input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-ink-700">Plano inicial</label>
              <div className="grid grid-cols-3 gap-2">
                {(['free', 'pro', 'enterprise'] as Plano[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlano(p)}
                    className={`rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                      plano === p
                        ? 'border-brand-500 bg-brand-50 text-brand-900 font-medium'
                        : 'border-black/10 bg-white hover:bg-ink-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Admin do escritório ── */}
          <div className="border-t border-ink-100 pt-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">
              Admin inicial (1º usuário do escritório)
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700">Nome do admin</label>
                <Input
                  value={adminNome}
                  onChange={e => setAdminNome(e.target.value)}
                  placeholder="João da Silva"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-700">Email do admin</label>
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  placeholder="joao@aurora.com.br"
                  required
                />
                <p className="mt-1 text-xs text-ink-400">
                  Vai receber as credenciais de acesso após criar.
                </p>
              </div>
            </div>
          </div>

          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Link href="/escritorios">
              <Button type="button" variant="ghost">Cancelar</Button>
            </Link>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Criando…' : 'Criar escritório + admin'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
