import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Race Timer Suite',
  description: 'Starter multi-tenant para gestión y cronometraje de eventos deportivos.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
