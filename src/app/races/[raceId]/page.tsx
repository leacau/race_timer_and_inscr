import { notFound } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimingDashboard } from "@/components/timing-dashboard";
import { CompetitorsManager } from "@/components/competitors-manager";
import { CategoryManager } from "@/components/category-manager";
import { RegistrationDesk } from "@/components/registration-desk";
import { getCategories, getParticipants, getRaceById } from "@/lib/data";

export default async function RaceDetailPage({ params }: { params: Promise<{ raceId: string }> }) {
  const { raceId } = await params;
  const race = await getRaceById(raceId);

  if (!race) {
    return notFound();
  }

  const [participants, categories] = await Promise.all([getParticipants(raceId), getCategories(raceId)]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Estás gestionando la carrera <span className="font-semibold text-foreground">{race.name}</span>
      </div>
      <Tabs defaultValue="timing" className="space-y-4">
        <TabsList>
          <TabsTrigger value="registration">Inscripciones</TabsTrigger>
          <TabsTrigger value="participants">Participantes</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
          <TabsTrigger value="timing">Cronometraje</TabsTrigger>
        </TabsList>
        <TabsContent value="registration">
          <RegistrationDesk participants={participants} race={race} />
        </TabsContent>
        <TabsContent value="participants">
          <CompetitorsManager participants={participants} categories={categories} raceId={raceId} activeRace={race} />
        </TabsContent>
        <TabsContent value="categories">
          <CategoryManager initialCategories={categories} raceId={raceId} activeRace={race} />
        </TabsContent>
        <TabsContent value="timing">
          <TimingDashboard raceId={raceId} activeRace={race} participants={participants} categories={categories} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
