import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';

export const FILE_VISIBILITIES = ['company', 'restricted'] as const;
export type FileVisibility = (typeof FILE_VISIBILITIES)[number];

/**
 * An uploaded spreadsheet. The bytes live in storage under `storageKey`; this row is
 * the metadata and the access rules. Deleting is a SOFT delete (`deletedAt`) — the
 * stored object goes, the row and its history stay.
 *
 * Indexes:
 * - `idx_file_asset_company (companyId, deletedAt, createdAt)` leads with the tenant
 *   and doubles as the keyset index for `GET /files`.
 * - `idx_file_asset_company_live` is the PARTIAL `(companyId, createdAt) WHERE
 *   "deletedAt" IS NULL`: soft-deleted rows are never read on the hot path but pile up
 *   forever, so this keeps the common-case index from growing with dead rows. A
 *   partial index cannot be expressed in a decorator, so the migration creates it by
 *   hand and `synchronize: false` stops the schema diff from proposing to drop it.
 *
 * `storageKey` is server-generated (`companies/<companyId>/files/<id>`) and is never
 * returned by the API.
 */
@Entity({ name: 'file_asset' })
@Index('idx_file_asset_company', ['companyId', 'deletedAt', 'createdAt'])
@Index('idx_file_asset_company_live', { synchronize: false })
export class FileAsset extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaderId' })
  uploader?: Relation<User>;

  @Column({ type: 'uuid' })
  uploaderId!: string;

  /** The uploader's file name, reduced to a base name. Display only; never used as a path. */
  @Column({ type: 'text' })
  originalName!: string;

  /** What the BYTES are (from magic-byte detection), not what the client claimed. */
  @Column({ type: 'text' })
  mimeType!: string;

  @Column({ type: 'int' })
  sizeBytes!: number;

  @Column({ type: 'text' })
  storageKey!: string;

  @Column({
    type: 'enum',
    enum: FILE_VISIBILITIES,
    enumName: 'file_visibility',
    default: 'company',
  })
  visibility!: FileVisibility;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
