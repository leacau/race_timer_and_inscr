import React from 'react'

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">Multi-tenant timing</p>
          <h2 className="text-2xl font-semibold">Race Timer & Inscription Suite</h2>
        </div>
        <div className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Prisma + Next.js</div>
      </header>
      {children}
    </main>
  )
}
