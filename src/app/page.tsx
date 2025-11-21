import { LiveResultsPanel } from '@/components/live-results-panel'
import { AdminCards } from '@/components/admin-cards'
import { PublicRegistration } from '@/components/public-registration'
import { Shell } from '@/components/shell'

export default function Home() {
  return (
    <Shell>
      <section className="grid gap-8 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="text-3xl font-semibold">RaceHQ</h1>
          <p className="mt-2 text-muted-foreground">
            Starter multi-tenant para eventos cronometrados con panel de administración, inscripciones públicas y live timing
            listo para WebSockets.
          </p>
          <div className="mt-4 grid gap-2 text-sm">
            <div>
              <strong>Roles:</strong> super admin, organizador, timer, staff, participante.
            </div>
            <div>
              <strong>Disciplinas:</strong> running, trail, ciclismo, triatlón, motor, rally/etapas, postas/equipos.
            </div>
            <div>
              <strong>Stack:</strong> Next.js + TypeScript + Tailwind + Prisma/PostgreSQL.
            </div>
          </div>
        </div>
        <LiveResultsPanel />
      </section>
      <AdminCards />
      <PublicRegistration />
    </Shell>
  )
}
