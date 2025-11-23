import Link from 'next/link'
import { BadgeCheck, Keyboard, NotebookPen, Wallet } from 'lucide-react'

export function PublicRegistration() {
  return (
    <section className="grid gap-6 rounded-xl border bg-card p-6 shadow-sm md:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Sitio público</p>
        <h3 className="text-xl font-semibold">Landing de evento e inscripción</h3>
        <p className="mt-2 text-muted-foreground">
          Formularios construidos con React Hook Form + Zod. Expone endpoints públicos para crear y actualizar inscripciones,
          registrar pagos y consultar estado por email.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1"><Keyboard className="h-4 w-4" /> Modo teclado para check-in</span>
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1"><Wallet className="h-4 w-4" /> Webhooks de pago</span>
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1"><NotebookPen className="h-4 w-4" /> Live forms</span>
        </div>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Ejemplo de API pública</p>
            <p className="text-xs text-muted-foreground">POST /api/registrations</p>
          </div>
          <BadgeCheck className="h-5 w-5 text-primary" />
        </div>
        <pre className="mt-3 overflow-auto rounded bg-black/90 p-3 text-xs text-primary-foreground">
{`curl -X POST /api/registrations \\
  -H 'Content-Type: application/json' \\
  -d '{
    "raceId": "seed-race-10k",
    "participant": {
      "firstName": "Alex",
      "lastName": "Ruiz",
      "email": "alex@example.com",
      "birthDate": "1990-01-01",
      "gender": "MALE"
    }
  }'`}
        </pre>
        <p className="mt-3 text-xs text-muted-foreground">
          Incluye endpoints de pagos (/api/payments) y lecturas de tiempo (/api/timing/reads). Consulta rankings públicos en
          <Link className="text-primary underline" href="/api/results/seed-race-10k">
            {' '}
            /api/results/seed-race-10k
          </Link>
        </p>
      </div>
    </section>
  )
}
