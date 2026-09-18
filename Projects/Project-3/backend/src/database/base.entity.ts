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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
