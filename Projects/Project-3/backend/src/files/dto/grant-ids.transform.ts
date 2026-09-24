import { Transform } from 'class-transformer';

/**
 * `grantedUserIds` arrives in three shapes depending on the client: repeated
 * multipart fields (`a`, `b` → array), ONE field (`a` → a bare string), or a JSON
 * array in a single field. All become a string array; the validators then check
 * each element. Anything else is passed through untouched so validation rejects it.
 */
export const ToGrantIdList = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    if (trimmed === '') return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : value;
      } catch {
        return value;
      }
    }
    return [trimmed];
  });
