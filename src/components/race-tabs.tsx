"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, UsersIcon, TimerIcon, LayoutGridIcon } from "lucide-react";
import type { Category, Participant, Race } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimingDashboard } from "./timing-dashboard";
import { CompetitorsManager } from "./competitors-manager";
import { CategoryManager } from "./category-manager";

export function RaceTabs({
  race,
  participants,
  categories,
}: {
  race: Race;
  participants: Participant[];
  categories: Category[];
}) {
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
      </div>

      <Tabs defaultValue="timing" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="timing" className="flex items-center gap-2">
            <TimerIcon className="h-4 w-4" />
            Cronometraje
          </TabsTrigger>
          <TabsTrigger value="competitors" className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4" />
            Competidores
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <LayoutGridIcon className="h-4 w-4" />
            Categorías
          </TabsTrigger>
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
          />
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <CategoryManager initialCategories={categories} raceId={race.id} activeRace={race} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
