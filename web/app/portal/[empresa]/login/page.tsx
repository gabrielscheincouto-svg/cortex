/**
 * Login do cliente final.
 * Valida em empresa_usuarios_finais: o user deve EXISTIR pra essa empresa
 * antes de poder logar. Quem cadastra o cliente é o escritório (web /empresas).
 */

import { LoginPortalForm } from './form'

export default function PortalLoginPage({ params }: { params: { empresa: string } }) {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-mind-200 bg-white p-8 shadow-sm">
        <h1 className="font-display text-2xl text-ink-900">Acesse seu portal</h1>
        <p className="mt-1 text-sm text-ink-500">
          Use o email cadastrado pelo seu escritório contábil.
        </p>
        <LoginPortalForm empresaSlug={params.empresa} />
      </div>
      <p className="mt-4 text-center text-xs text-ink-400">
        Primeira vez aqui? Peça ao seu escritório para enviar o convite por email.
      </p>
    </div>
  )
}
