/** 表示名はDBを正とし、色・絵のキーは名前の変更から独立させる。 */
export type Category = { id: string; name: string; presentation_key?: string | null; created_at?: string | null };
export function categoryKey(category: Category): string {
  return category.presentation_key || category.name;
}
export function resolveCategory(value: string | null | undefined, categories: Category[]): Category | undefined {
  if (!value) return undefined;
  return categories.find(c => c.id === value) ?? categories.find(c => c.name === value) ?? categories.find(c => c.presentation_key === value);
}
export function withCategory<T extends { category: string; categoryId?: string; categoryKey?: string }>(shop: T, categories: Category[]): T & { categoryId?: string; categoryKey?: string } {
  const category = resolveCategory(shop.categoryId || shop.category, categories);
  if (!category || (shop.categoryId === category.id && shop.category === category.name && shop.categoryKey === categoryKey(category))) return shop;
  return { ...shop, categoryId: category.id, category: category.name, categoryKey: categoryKey(category) };
}
