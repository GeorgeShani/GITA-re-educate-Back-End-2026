import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { FileAsset } from '#/files/file-asset.entity.js';

@Entity({ name: 'file_comment' })
@Index('idx_file_comment_company_file_created', [
  'companyId',
  'fileId',
  'createdAt',
  'id',
])
export class FileComment extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => FileAsset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fileId' })
  file?: Relation<FileAsset>;

  @Column({ type: 'uuid' })
  fileId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'authorId' })
  author?: Relation<User>;

  @Column({ type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => FileComment, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parentId' })
  parent?: Relation<FileComment> | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
