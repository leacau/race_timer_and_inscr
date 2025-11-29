import Link from "next/link";
import { format, isAfter, isBefore, isToday, parseISO, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import type { Race } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Clock4Icon, TimerIcon } from "lucide-react";

function categorizeRaces(races: Race[]) {
  const today = startOfDay(new Date());
  const getTime = (race: Race) => (race.eventDate ? startOfDay(parseISO(race.eventDate)).getTime() : Infinity);

  const grouped = races.reduce(
    (acc, race) => {
      const date = race.eventDate ? startOfDay(parseISO(race.eventDate)) : null;

      if (date && isToday(date)) {
        acc.current.push(race);
      } else if (!date || isAfter(date, today)) {
        acc.upcoming.push(race);
      } else if (isBefore(date, today)) {
        acc.past.push(race);
      }

      return acc;
    },
    { current: [] as Race[], upcoming: [] as Race[], past: [] as Race[] }
  );

  return {
    current: grouped.current.sort((a, b) => getTime(a) - getTime(b)),
    upcoming: grouped.upcoming.sort((a, b) => getTime(a) - getTime(b)),
    past: grouped.past.sort((a, b) => getTime(b) - getTime(a)),
  };
}

function RaceColumn({
  title,
  description,
  empty,
  races,
  badgeVariant,
}: {
  title: string;
  description: string;
  empty: string;
  races: Race[];
  badgeVariant: "default" | "secondary" | "outline";
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant={badgeVariant}>{races.length} carreras</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {races.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          races.map((race) => (
            <div
              key={race.id}
              className="rounded-lg border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-base font-semibold leading-tight">{race.name}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarIcon className="h-4 w-4" />
                    {race.eventDate ? format(parseISO(race.eventDate), "PPP", { locale: es }) : "Sin fecha"}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href={`/races/${race.id}`}>Abrir</Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function RaceDashboard({ races }: { races: Race[] }) {
  const { current, upcoming, past } = categorizeRaces(races);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Organiza tus carreras por estado y accede a su gestión desde un solo lugar.</p>
        </div>
        <Button asChild>
          <Link href="/races">
            <TimerIcon className="mr-2 h-4 w-4" />
            Crear o gestionar carreras
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
            <Clock4Icon className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm text-muted-foreground">En curso hoy</p>
              <p className="text-lg font-semibold">{current.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
            <CalendarIcon className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Próximas</p>
              <p className="text-lg font-semibold">{upcoming.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
            <TimerIcon className="h-5 w-5 text-slate-600" />
            <div>
              <p className="text-sm text-muted-foreground">Finalizadas</p>
              <p className="text-lg font-semibold">{past.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <RaceColumn
          title="En curso"
          description="Carreras que se realizan hoy"
          empty="No hay carreras programadas para hoy."
          races={current}
          badgeVariant="default"
        />
        <RaceColumn
          title="Próximas"
          description="Fechas futuras en agenda"
          empty="Agrega nuevas carreras para planificar tus eventos."
          races={upcoming}
          badgeVariant="secondary"
        />
        <RaceColumn
          title="Finalizadas"
          description="Historial de carreras anteriores"
          empty="Aún no tienes carreras finalizadas."
          races={past}
          badgeVariant="outline"
        />
      </div>
    </div>
  );
}
