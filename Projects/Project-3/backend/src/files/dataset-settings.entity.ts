import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';

/**
 * What a company has decided about one DATASET (the file and all its versions): the columns that identify a row (so two
 * versions can be compared row by row) and the cleaning recipe to apply, with whether to apply it to every new version.
 *
 * One row per dataset, made the first time anyone saves something. `recipe` is `jsonb`, read back through `recipeSchema`.
 */
@Entity({ name: 'dataset_settings' })
@Index('uq_dataset_settings_dataset', ['companyId', 'datasetId'], { unique: true })
export class DatasetSettings extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'uuid' })
  datasetId!: string;

  /** Column names, as the company typed them, that together identify a row. */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  keyColumns!: string[];

  @Column({ type: 'jsonb', nullable: true })
  recipe!: unknown;

  @Column({ type: 'boolean', default: false })
  autoClean!: boolean;

  @Column({ type: 'uuid', nullable: true })
  updatedByUserId!: string | null;
}
