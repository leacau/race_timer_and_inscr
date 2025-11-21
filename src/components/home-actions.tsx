'use client'

import { useMemo, useState } from 'react'
import {
  Check,
  ClipboardCopy,
  ClipboardList,
  Database,
  Link2,
  Play,
  Rocket,
} from 'lucide-react'

const commands = [
  {
    label: '1) Instala dependencias',
    command: 'npm install',
    icon: Rocket,
  },
  {
    label: '2) Genera cliente Prisma',
    command: 'npm run db:generate',
    icon: Database,
  },
  {
    label: '3) Ejecuta seeds y arranca dev',
    command: 'npm run db:seed && npm run dev',
    icon: Play,
  },
]

const apiCalls = [
  {
    label: 'Crear inscripción demo',
    description: 'POST /api/registrations con un corredor de ejemplo',
    sample:
      "curl -X POST http://localhost:3000/api/registrations -H 'Content-Type: application/json' -d '{\n  \"raceId\": \"seed-race-10k\",\n  \"participant\": {\n    \"firstName\": \"Lucia\",\n    \"lastName\": \"Martinez\",\n    \"email\": \"lucia@example.com\",\n    \"gender\": \"FEMALE\"\n  }\n}'",
  },
  {
    label: 'Enviar lectura de tiempo',
    description: 'POST /api/timing/reads para simular un chip',
    sample:
      "curl -X POST http://localhost:3000/api/timing/reads -H 'Content-Type: application/json' -d '{\n  \"raceId\": \"seed-race-10k\",\n  \"timingPointId\": \"seed-tp-finish\",\n  \"bib\": 101,\n  \"timestamp\": \"2024-04-21T12:30:10Z\"\n}'",
  },
  {
    label: 'Consultar rankings',
    description: 'GET /api/results/seed-race-10k para ver clasificaciones',
    sample: 'curl http://localhost:3000/api/results/seed-race-10k',
  },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Clipboard unavailable', err)
    }
  }

  const Icon = copied ? Check : ClipboardCopy

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-2 rounded-lg border bg-muted/60 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
    >
      <Icon className="h-4 w-4" /> {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

export function HomeActions() {
  const [selectedCall, setSelectedCall] = useState(apiCalls[0])
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [response, setResponse] = useState<string>('')

  async function runSample() {
    setStatus('loading')
    setResponse('')
    try {
      const res = await fetch(selectedCall.sample.match(/http[^'\s]+/)?.[0] ?? '', {
        cache: 'no-store',
      })
      const text = await res.text()
      setStatus(res.ok ? 'done' : 'error')
      setResponse(text || 'Respuesta vacía')
    } catch (error) {
      setStatus('error')
      setResponse('No se pudo llamar al endpoint. ¿Está corriendo npm run dev?')
    }
  }

  const statusBadge = useMemo(() => {
    if (status === 'loading') return 'Ejecutando…'
    if (status === 'done') return 'Éxito'
    if (status === 'error') return 'Error'
    return 'Listo para probar'
  }, [status])

  return (
    <section className="grid gap-6 rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Home con acción</p>
          <h3 className="text-xl font-semibold">Checklist para activar el proyecto</h3>
          <p className="text-sm text-muted-foreground">
            Ejecuta los comandos, luego prueba los endpoints listos con el seed. Todo desde la misma portada.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <ClipboardList className="h-4 w-4" /> {statusBadge}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          {commands.map((item) => (
            <div key={item.label} className="flex items-start justify-between gap-3 rounded-lg bg-background/70 p-3 shadow-sm">
              <div className="flex items-start gap-2">
                <item.icon className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.command}</p>
                </div>
              </div>
              <CopyButton text={item.command} />
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-lg border bg-background p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Probar endpoints seed</p>
              <p className="text-xs text-muted-foreground">Selecciona un ejemplo y lánzalo directo desde el home.</p>
            </div>
            <button
              type="button"
              onClick={runSample}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow hover:opacity-90"
            >
              <Play className="h-4 w-4" /> Ejecutar GET
            </button>
          </div>
          <div className="grid gap-2">
            {apiCalls.map((call) => (
              <button
                key={call.label}
                type="button"
                onClick={() => setSelectedCall(call)}
                className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition hover:bg-muted/60 ${
                  selectedCall.label === call.label ? 'border-primary bg-muted/80' : 'bg-muted/30'
                }`}
              >
                <div>
                  <p className="font-semibold">{call.label}</p>
                  <p className="text-xs text-muted-foreground">{call.description}</p>
                </div>
                <Link2 className="h-4 w-4 text-primary" />
              </button>
            ))}
          </div>
          <div className="rounded-lg bg-black/90 p-3 text-xs text-primary-foreground">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Ejemplo listo para copiar</p>
              <CopyButton text={selectedCall.sample} />
            </div>
            <pre className="mt-2 whitespace-pre-wrap break-words">{selectedCall.sample}</pre>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Respuesta</p>
            <p className="mt-1 whitespace-pre-wrap break-words">
              {response || 'Sin ejecutar aún. Asegúrate de tener el server en http://localhost:3000.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
