import { Clock, Flag, GaugeCircle, Timer } from 'lucide-react'

const rows = [
  { bib: 101, name: 'Camila Gómez', category: 'Femenino 30-39', split: '26:44', finish: '00:52:10' },
  { bib: 203, name: 'Diego Soto', category: 'General', split: '24:10', finish: '00:48:55' },
  { bib: 118, name: 'Equipo Andes', category: 'Posta', split: '25:05', finish: '00:50:12' },
]

export function LiveResultsPanel() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Panel de cronometraje</p>
          <h3 className="text-xl font-semibold">Live results (WebSocket-ready)</h3>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Timer className="h-4 w-4" /> Splits</span>
          <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> Neto/bruto</span>
          <span className="flex items-center gap-1"><Flag className="h-4 w-4" /> Ranking</span>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2">Dorsal</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2">Split</th>
              <th className="px-3 py-2">Meta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.bib} className="border-t">
                <td className="px-3 py-2 font-semibold">{row.bib}</td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.category}</td>
                <td className="px-3 py-2">{row.split}</td>
                <td className="px-3 py-2 font-semibold">{row.finish}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <GaugeCircle className="h-4 w-4" />
        Escucha /api/timing/reads (WebSocket o HTTP) y recalcula rankings en /api/results/[raceId].
      </div>
    </div>
  )
}
