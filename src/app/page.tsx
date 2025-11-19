import { TimingDashboard } from "@/components/timing-dashboard";
import { RaceSelector } from "@/components/race-selector";
import { getParticipants, getCategories, getRaces } from "@/lib/data";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type SearchParams = Promise<{ raceId?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {};
  const races = await getRaces();
  const requestedRaceId = params?.raceId;
  const hasRequestedRace = races.some((race) => race.id === requestedRaceId);
  const activeRaceId = hasRequestedRace ? requestedRaceId! : races[0]?.id ?? null;
  const activeRace = races.find((race) => race.id === activeRaceId) ?? null;
  const participants = activeRaceId ? await getParticipants(activeRaceId) : [];
  const categories = activeRaceId ? await getCategories(activeRaceId) : [];

  return (
    <div className="space-y-6">
      <RaceSelector races={races} activeRaceId={activeRaceId} />
      {activeRaceId ? (
        <TimingDashboard
          raceId={activeRaceId}
          activeRace={activeRace}
          participants={participants}
          categories={categories}
        />
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-lg font-medium">Crea tu primera carrera</p>
          <p className="text-muted-foreground">Necesitas una carrera para comenzar a cronometrar.</p>
          <Button asChild className="mt-4">
            <Link href="/races">Crear carrera</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
