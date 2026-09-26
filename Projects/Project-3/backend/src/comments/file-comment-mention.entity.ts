import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
  Unique,
} from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { FileComment } from './file-comment.entity.js';

@Entity({ name: 'file_comment_mention' })
@Unique('uq_file_comment_mention_comment_user', ['commentId', 'userId'])
@Index('idx_file_comment_mention_company_user', ['companyId', 'userId'])
export class FileCommentMention extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => FileComment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commentId' })
  comment?: Relation<FileComment>;

  @Column({ type: 'uuid' })
  commentId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: Relation<User>;

  @Column({ type: 'uuid' })
  userId!: string;
}
