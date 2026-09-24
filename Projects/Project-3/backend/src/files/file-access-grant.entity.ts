import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation, Unique } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { FileAsset } from './file-asset.entity.js';

/**
 * "This person may see this restricted file." One row per (file, person).
 * `UNIQUE (fileId, userId)` is both the integrity rule and the index the visibility
 * predicate's `EXISTS` probes; the plain `userId` index serves "every grant this
 * person holds", which employee removal deletes by.
 *
 * Grants only ever WIDEN access for a `restricted` file; a `company` file needs
 * none, so switching a file to `company` deletes its grants.
 */
@Entity({ name: 'file_access_grant' })
@Unique('uq_file_access_grant_file_user', ['fileId', 'userId'])
export class FileAccessGrant extends BaseEntity {
  @ManyToOne(() => FileAsset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fileId' })
  file?: Relation<FileAsset>;

  @Column({ type: 'uuid' })
  fileId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;
}
