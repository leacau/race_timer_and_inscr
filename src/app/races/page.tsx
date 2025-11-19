import { getRaces } from "@/lib/data";
import { RacesManager } from "@/components/races-manager";

export default async function RacesPage() {
  const races = await getRaces();
  return <RacesManager races={races} />;
}
