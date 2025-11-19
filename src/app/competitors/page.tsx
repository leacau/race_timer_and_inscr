import { getParticipants, getCategories, getRaces } from "@/lib/data";
import { CompetitorsManager } from "@/components/competitors-manager";
import { RaceSelector } from "@/components/race-selector";

type SearchParams = Promise<{ raceId?: string }>;

export default async function CompetitorsPage({ searchParams }: { searchParams?: SearchParams }) {
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
      <CompetitorsManager
        participants={participants}
        categories={categories}
        raceId={activeRaceId}
        activeRace={activeRace}
      />
    </div>
  );
}
