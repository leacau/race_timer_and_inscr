import { ParticipantsTable } from "@/components/participants-table";
import { getParticipants, getCategories } from "@/lib/data";

export default async function DashboardPage() {
  const participants = await getParticipants();
  const categories = await getCategories();

  return <ParticipantsTable participants={participants} categories={categories} />;
}
