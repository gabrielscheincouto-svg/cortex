import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cortex Admin',
  description: 'Painel super-admin do Cortex',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
