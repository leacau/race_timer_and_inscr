import { CategoryManager } from "@/components/category-manager";
import { RaceSelector } from "@/components/race-selector";
import { getCategories, getRaces } from "@/lib/data";
import { DataError } from "@/components/data-error";

type SearchParams = Promise<{ raceId?: string }>;

export default async function CategoriesPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {};

  try {
    const races = await getRaces();
    const requestedRaceId = params?.raceId;
    const hasRequestedRace = races.some((race) => race.id === requestedRaceId);
    const activeRaceId = hasRequestedRace ? requestedRaceId! : races[0]?.id ?? null;
    const activeRace = races.find((race) => race.id === activeRaceId) ?? null;
    const categories = activeRaceId ? await getCategories(activeRaceId) : [];

    return (
      <div className="space-y-6">
        <RaceSelector races={races} activeRaceId={activeRaceId} />
        <CategoryManager initialCategories={categories} raceId={activeRaceId} activeRace={activeRace} />
      </div>
    );
  } catch (error) {
    console.error("Failed to load categories page", error);
  }

  return (
    <DataError
      message="No se pudieron cargar las categorías"
      description="Revisa tu configuración de Firebase o intenta nuevamente."
    />
  );
}
