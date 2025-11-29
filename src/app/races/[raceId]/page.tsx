import { notFound } from "next/navigation";
import { RaceTabs } from "@/components/race-tabs";
import { DataError } from "@/components/data-error";
import { getCategories, getParticipants, getRaces, getRunnerChanges } from "@/lib/data";

export default async function RaceDetailPage({ params }: { params: { raceId: string } }) {
  try {
    const races = await getRaces();
    const race = races.find((item) => item.id === params.raceId);

    if (!race) {
      notFound();
    }

    const [participants, categories, runnerChanges] = await Promise.all([
      getParticipants(race.id),
      getCategories(race.id),
      getRunnerChanges(race.id),
    ]);

    return <RaceTabs race={race} participants={participants} categories={categories} runnerChanges={runnerChanges} />;
  } catch (error) {
    console.error("Failed to load race detail", error);
    return (
      <DataError
        message="No se pudo cargar la carrera"
        description="Verifica la conexión con Firebase e intenta nuevamente."
      />
    );
  }
}
