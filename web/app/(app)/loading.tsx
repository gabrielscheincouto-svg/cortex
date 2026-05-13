/**
 * Loading global do (app) — mostra skeleton instantâneo enquanto o RSC fetch
 * acontece em background. Mata sensação de "menu lento" — o esqueleto aparece
 * em <100ms, conteúdo enche em ~1s.
 */
export default function AppLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-40 animate-pulse rounded bg-ink-100" />
          <div className="h-7 w-72 animate-pulse rounded bg-ink-100" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0,1,2,3].map(i => (
          <div key={i} className="rounded-xl bg-white p-5 ring-1 ring-inset ring-black/5">
            <div className="h-3 w-20 animate-pulse rounded bg-ink-100" />
            <div className="mt-3 h-7 w-14 animate-pulse rounded bg-ink-100" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="h-96 animate-pulse rounded-xl bg-ink-50" />
        <div className="h-96 animate-pulse rounded-xl bg-ink-50" />
      </div>
    </div>
  )
}
