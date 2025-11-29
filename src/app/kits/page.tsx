import { RaceDashboard } from "@/components/race-dashboard";
import { getRaces } from "@/lib/data";

export default async function KitsPage() {
  const races = await getRaces();
  return (
    <RaceDashboard
      races={races}
      title="Entrega de kits"
      description="Busca una carrera y gestiona la entrega de kits a sus participantes."
      linkPrefix="/kits"
      openLabel="Abrir entrega"
      ctaHref="/races"
      ctaLabel="Gestionar carreras"
    />
  );
}
