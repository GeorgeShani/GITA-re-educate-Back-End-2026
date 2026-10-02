import "server-only";
import type { apiClient } from "./api";

export interface Person {
  id: string;
  name: string;
  removed: boolean;
}

/** Everyone in the company, removed people included (their past actions stay in the log). Names only: that is all it needs. */
export async function loadPeople(
  api: ReturnType<typeof apiClient>,
): Promise<Person[]> {
  const { data } = await api.GET("/employees", {
    params: { query: { page: 1, limit: 100 } },
  });
  return (data?.data ?? []).map((person) => ({
    id: person.id,
    name: person.fullName,
    removed: person.status === "disabled",
  }));
}

/** Who did it, in words: a name, "System" when nobody did (the billing cycle), or a stand-in when they are not in the list. */
export function actorName(
  actorUserId: string | null,
  people: readonly Person[],
): string {
  if (actorUserId === null) return "System";
  const person = people.find((entry) => entry.id === actorUserId);
  if (!person) return "Someone no longer in the company";
  return person.removed ? `${person.name} (removed)` : person.name;
}
