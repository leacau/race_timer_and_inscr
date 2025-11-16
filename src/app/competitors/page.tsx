import { getParticipants, getCategories } from "@/lib/data";
import { CompetitorsManager } from "@/components/competitors-manager";

export default async function CompetitorsPage() {
  const participants = await getParticipants();
  const categories = await getCategories();
  return <CompetitorsManager participants={participants} categories={categories} />;
}
