import { notFound } from "next/navigation";
import { getCategories, getParticipants, getRaces } from "@/lib/data";
import { KitDelivery } from "@/components/kit-delivery";
import { DataError } from "@/components/data-error";

export default async function KitDeliveryPage({ params }: { params: { raceId: string } }) {
  try {
    const races = await getRaces();
    const race = races.find((item) => item.id === params.raceId);

    if (!race) {
      notFound();
    }

    const [participants, categories] = await Promise.all([
      getParticipants(race.id),
      getCategories(race.id),
    ]);

    return <KitDelivery race={race} participants={participants} categories={categories} />;
  } catch (error) {
    console.error("Failed to load kit delivery view", error);
    return (
      <DataError
        message="No se pudo cargar la entrega de kits"
        description="Verifica la conexión con Firebase e intenta nuevamente."
      />
    );
  }
}
