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
  const isTimer = role === "timer";
  const isClient = role === "client";
  const isKit = role === "kit";
  const isUnassigned = role === "unassigned";

  const showTiming = !isKit && !isUnassigned;
  const showCompetitors = isAdmin || isClient || isTimer;
  const showKits = isAdmin || isKit;
  const showCategories = isAdmin;

  const visibleTabs = [
    showTiming ? "timing" : null,
    showCompetitors ? "competitors" : null,
    showKits ? "kits" : null,
    showCategories ? "categories" : null,
  ].filter(Boolean) as string[];

  const tabColumns = (() => {
    const count = Math.max(visibleTabs.length, 2);
    if (count >= 4) return "sm:grid-cols-4";
    if (count === 3) return "sm:grid-cols-3";
    return "sm:grid-cols-2";
  })();

  useEffect(() => {
    if (race.eventDate) {
      setRaceDate(new Date(race.eventDate));
    }
    if (race.ageCalculationMethod) {
      setAgeCalculationMethod(race.ageCalculationMethod);
    }
  }, [race, setAgeCalculationMethod, setRaceDate]);

  const defaultTab = visibleTabs[0] ?? "timing";

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

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className={`grid w-full grid-cols-2 ${tabColumns} sm:w-auto`}>
          {showTiming && (
            <TabsTrigger value="timing" className="flex items-center gap-2">
              <TimerIcon className="h-4 w-4" />
              {isAdmin || isTimer ? "Cronometraje" : "Clasificación"}
            </TabsTrigger>
          )}
          {showCompetitors && (
            <TabsTrigger value="competitors" className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              {isAdmin ? "Competidores" : "Participantes"}
            </TabsTrigger>
          )}
          {showKits && (
            <TabsTrigger value="kits" className="flex items-center gap-2">
              <TruckIcon className="h-4 w-4" />
              Entrega de kits
            </TabsTrigger>
          )}
          {showCategories && (
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <LayoutGridIcon className="h-4 w-4" />
              Categorías
            </TabsTrigger>
          )}
        </TabsList>

        {showTiming && (
          <TabsContent value="timing" className="space-y-4">
            <TimingDashboard
              raceId={race.id}
              activeRace={race}
              participants={participants}
              categories={categories}
            />
          </TabsContent>
        )}

        {showCompetitors && (
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
        )}

        {showKits && (
          <TabsContent value="kits" className="space-y-4">
            <KitDelivery race={race} participants={participants} categories={categories} />
          </TabsContent>
        )}

        {showCategories && (
          <TabsContent value="categories" className="space-y-4">
            <CategoryManager initialCategories={categories} raceId={race.id} activeRace={race} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
