import { TimingDashboard } from "@/components/timing-dashboard";
import { getParticipants, getCategories } from "@/lib/data";

export default async function DashboardPage() {
  const participants = await getParticipants();
  const categories = await getCategories();

  return <TimingDashboard participants={participants} categories={categories} />;
}
