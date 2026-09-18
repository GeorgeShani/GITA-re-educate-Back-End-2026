import { type ClassConstructor, plainToInstance } from 'class-transformer';

/**
 * The mechanism every DTO's own `static from(entity)` calls internally —
 * see AGENTS.md's "Responses" convention. `excludeExtraneousValues: true` is
 * what makes this opt-in: a property survives onto the DTO only if it
 * carries `@Expose()`, so a new column on an entity (`passwordHash`,
 * `storageKey`, …) is invisible on every DTO until someone deliberately
 * opts it in. The opposite default — `@Exclude()` on the entity itself —
 * leaks by default instead, which is the wrong failure direction for a
 * database holding credentials.
 *
 * Example:
 * ```ts
 * export class UserSummaryDto {
 *   @Expose() id!: string;
 *   @Expose() fullName!: string;
 *
 *   static from(entity: User): UserSummaryDto {
 *     return toDto(UserSummaryDto, entity);
 *   }
 * }
 * ```
 */
export function toDto<TEntity extends object, TDto>(
  dtoClass: ClassConstructor<TDto>,
  entity: TEntity,
): TDto {
  return plainToInstance(dtoClass, entity, { excludeExtraneousValues: true });
}

export function toDtoList<TEntity extends object, TDto>(
  dtoClass: ClassConstructor<TDto>,
  entities: TEntity[],
): TDto[] {
  return entities.map((entity) => toDto(dtoClass, entity));
}
