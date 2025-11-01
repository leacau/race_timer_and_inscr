import { CategoryManager } from "@/components/category-manager";
import { getCategories } from "@/lib/data";

export default async function CategoriesPage() {
  const categories = await getCategories();
  return <CategoryManager initialCategories={categories} />;
}
