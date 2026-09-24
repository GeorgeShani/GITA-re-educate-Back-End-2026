import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Every entity's shape, in one place.
 *
 * Mongoose's `baseSchemaOptions` in Project-2 did two unrelated jobs at once —
 * timestamps AND `_id` → `id` response serialization — with no TypeORM
 * equivalent for the second half. This class covers only the schema half;
 * serialization is a separate, explicit decision (response DTOs + mappers,
 * from Phase 3), which is exactly the split TypeORM forces and Mongoose let
 * you blur.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Millisecond precision, deliberately. Postgres `now()` is microsecond, but a
   * JS `Date` — and therefore a keyset cursor — is milliseconds: with the extra
   * digits kept, a cursor's truncated timestamp sorts BEFORE the row it names and
   * every page repeats the previous page's last row (proven in
   * `paginate.integration.spec.ts`). The database rounds to what the app can
   * represent, so the two always agree.
   */
  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', precision: 3 })
  updatedAt!: Date;
}
