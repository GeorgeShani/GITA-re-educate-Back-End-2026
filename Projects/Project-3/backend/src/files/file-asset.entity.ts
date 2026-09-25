import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation, Unique } from 'typeorm';
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
 * **Versions.** A file and its later versions form a DATASET: they share `datasetId` (a first upload's
 * `datasetId` is its own `id`), each has a `version` (1, 2, …, unique within the dataset, never reused after
 * a delete), and exactly one live version has `isLatest`. `GET /files` lists only the latest by default.
 * A version is a file in every other respect — its own object, grants, report, usage event and quota slot.
 *
 * - `idx_file_asset_company_dataset (companyId, datasetId)` serves a dataset's versions.
 * - The partial index also requires `isLatest`: the default list is latest-and-live, and older versions
 *   (read only by `?allVersions=true` or a versions list) use `idx_file_asset_company`.
 *
 * `storageKey` is server-generated (`companies/<companyId>/files/<id>`) and is never
 * returned by the API.
 */
@Entity({ name: 'file_asset' })
@Index('idx_file_asset_company', ['companyId', 'deletedAt', 'createdAt'])
@Index('idx_file_asset_company_live', { synchronize: false })
@Index('idx_file_asset_company_dataset', ['companyId', 'datasetId'])
@Unique('uq_file_asset_dataset_version', ['datasetId', 'version'])
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

  /** Shared by every version of one file; a first upload's is its own `id`. */
  @Column({ type: 'uuid' })
  datasetId!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  /** The newest LIVE version of the dataset; the one a default list shows. */
  @Column({ type: 'boolean', default: true })
  isLatest!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
