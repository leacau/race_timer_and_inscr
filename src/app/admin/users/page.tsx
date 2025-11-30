import { getUsers } from "@/lib/data";
import { UserAdmin } from "@/components/user-admin";

export default async function UsersAdminPage() {
  const users = await getUsers();
  return <UserAdmin initialUsers={users} />;
}
