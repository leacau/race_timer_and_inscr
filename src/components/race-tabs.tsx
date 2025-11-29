"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, UsersIcon, TimerIcon, LayoutGridIcon, TruckIcon } from "lucide-react";
import type { Category, Participant, Race, RunnerChange, Team } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimingDashboard } from "./timing-dashboard";
import { CompetitorsManager } from "./competitors-manager";
import { CategoryManager } from "./category-manager";
import { useContext, useEffect } from "react";
import { AppContext } from "@/context/app-context";
import { KitDelivery } from "./kit-delivery";

export function RaceTabs({
  race,
  participants,
  categories,
  runnerChanges,
  teams = [],
}: {
  race: Race;
  participants: Participant[];
  categories: Category[];
  runnerChanges?: RunnerChange[];
  teams?: Team[];
}) {
  const { role, setRaceDate, setAgeCalculationMethod } = useContext(AppContext);
  const isAdmin = role === "admin";

  const tabColumns = isAdmin ? "sm:grid-cols-4" : "sm:grid-cols-2";

  useEffect(() => {
    if (race.eventDate) {
      setRaceDate(new Date(race.eventDate));
    }
    if (race.ageCalculationMethod) {
      setAgeCalculationMethod(race.ageCalculationMethod);
    }
  }, [race, setAgeCalculationMethod, setRaceDate]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarIcon className="h-4 w-4" />
          <span>
            {race.eventDate ? format(parseISO(race.eventDate), "PPP", { locale: es }) : "Fecha no definida"}
          </span>
        </div>
        <h1 className="text-2xl font-bold leading-tight">{race.name}</h1>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span className="rounded-full bg-muted px-3 py-1">{race.discipline ?? "Disciplina"}</span>
          <span className="rounded-full bg-muted px-3 py-1">
            {race.competitionMode === "teams" ? "Formato por equipos" : "Formato individual"}
          </span>
          <span className="rounded-full bg-muted px-3 py-1">
            {race.evaluationMethod === "points" ? "Evalúa por puntaje" : "Evalúa por tiempo"}
          </span>
          <span className="rounded-full bg-muted px-3 py-1">
            {race.ageCalculationMethod === "endOfYear" ? "Edad al fin de año" : "Edad al día de carrera"}
          </span>
        </div>
      </div>

      <Tabs defaultValue="timing" className="space-y-4">
        <TabsList className={`grid w-full grid-cols-2 ${tabColumns} sm:w-auto`}>
          <TabsTrigger value="timing" className="flex items-center gap-2">
            <TimerIcon className="h-4 w-4" />
            {isAdmin ? "Cronometraje" : "Clasificación"}
          </TabsTrigger>
          <TabsTrigger value="competitors" className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4" />
            {isAdmin ? "Competidores" : "Participantes"}
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="kits" className="flex items-center gap-2">
              <TruckIcon className="h-4 w-4" />
              Entrega de kits
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <LayoutGridIcon className="h-4 w-4" />
              Categorías
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="timing" className="space-y-4">
          <TimingDashboard
            raceId={race.id}
            activeRace={race}
            participants={participants}
            categories={categories}
          />
        </TabsContent>

        <TabsContent value="competitors" className="space-y-4">
          <CompetitorsManager
            participants={participants}
            categories={categories}
            raceId={race.id}
            activeRace={race}
            runnerChanges={runnerChanges}
            teams={teams}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="kits" className="space-y-4">
            <KitDelivery race={race} participants={participants} categories={categories} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="categories" className="space-y-4">
            <CategoryManager initialCategories={categories} raceId={race.id} activeRace={race} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
