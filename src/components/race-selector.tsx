"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, PlusCircle } from "lucide-react";
import Link from "next/link";
import type { Race } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface RaceSelectorProps {
  races: Race[];
  activeRaceId: string | null;
  className?: string;
}

export function RaceSelector({ races, activeRaceId, className }: RaceSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const activeRace = races.find((race) => race.id === activeRaceId) || null;

  const handleChange = (value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams?.toString());
      if (value) {
        params.set("raceId", value);
      } else {
        params.delete("raceId");
      }
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    });
  };

  if (races.length === 0) {
    return (
      <div className={cn("flex flex-wrap items-center gap-3 rounded-lg border p-4", className)}>
        <div>
          <p className="text-sm font-medium">No hay carreras registradas</p>
          <p className="text-sm text-muted-foreground">Crea una carrera para comenzar a cargar categorías y competidores.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/races">
            <PlusCircle className="mr-2 h-4 w-4" /> Nueva carrera
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-4 rounded-lg border bg-card/30 p-4", className)}>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-muted-foreground">Carrera activa</span>
        <Select value={activeRaceId ?? undefined} onValueChange={handleChange} disabled={isPending}>
          <SelectTrigger className="min-w-[220px]">
            <SelectValue placeholder="Elige una carrera" />
          </SelectTrigger>
          <SelectContent>
            {races.map((race) => (
              <SelectItem key={race.id} value={race.id}>
                <div className="flex flex-col">
                  <span>{race.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {race.eventDate ? format(new Date(race.eventDate), "PPP", { locale: es }) : "Sin fecha"}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {activeRace && (
        <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <CalendarIcon className="h-4 w-4" />
          {activeRace.eventDate ? format(new Date(activeRace.eventDate), "PPP", { locale: es }) : "Fecha no definida"}
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" asChild size="sm">
          <Link href="/races">
            <PlusCircle className="mr-2 h-4 w-4" /> Administrar carreras
          </Link>
        </Button>
      </div>
    </div>
  );
}
