import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Empty, Button } from '@/components/ui'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-md text-center">
        <Empty
          icon={Compass}
          title="Página não encontrada"
          description="O endereço acessado não existe ou foi movido."
          action={
            <Link to="/">
              <Button variant="primary">Voltar ao início</Button>
            </Link>
          }
        />
      </div>
    </div>
  )
}
