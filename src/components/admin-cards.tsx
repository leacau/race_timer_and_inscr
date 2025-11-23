import { ClipboardList, LayoutDashboard, Network, ShieldCheck } from 'lucide-react'

const items = [
  {
    title: 'Multi-organizador',
    description: 'Organizaciones aisladas con roles y JWT. CRUD de eventos, carreras y puntos de control.',
    icon: LayoutDashboard,
  },
  {
    title: 'Inscripciones y pagos',
    description: 'Endpoints públicos para registrar atletas, actualizar datos y registrar pagos externos.',
    icon: ClipboardList,
  },
  {
    title: 'Cronometraje',
    description: 'Asignación de chips/dorsales, check-in de atletas y recepción de lecturas desde equipos o móvil.',
    icon: Network,
  },
  {
    title: 'Ranking listo',
    description: 'Cálculo de bruto/neto, splits, penalizaciones y ranking general/género/categoría.',
    icon: ShieldCheck,
  },
]

export function AdminCards() {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.title} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-primary">
            <item.icon className="h-5 w-5" />
            <span className="text-sm font-semibold">{item.title}</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
        </div>
      ))}
    </section>
  )
}
