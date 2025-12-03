import { RaceDashboard } from "@/components/race-dashboard";
import { getRaces } from "@/lib/data";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DataError } from "@/components/data-error";

export default async function DashboardPage() {
  try {
    const races = await getRaces();
    return <RaceDashboard races={races} />;
  } catch (error) {
    console.error("Failed to load dashboard data", error);
    return (
      <div className="space-y-4">
        <DataError
          message="Error al cargar el panel"
          description="No se pudieron cargar las carreras desde Firebase. Intenta nuevamente en unos minutos."
        />
        <Button asChild>
          <Link href="/races">Ir a carreras</Link>
        </Button>
      </div>
    );
  }
}
