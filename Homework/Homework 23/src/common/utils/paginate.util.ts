export function paginate<T>(items: T[], page: number, take: number): T[] {
  const start = (page - 1) * take;
  return items.slice(start, start + take);
}
