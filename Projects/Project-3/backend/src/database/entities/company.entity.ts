import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base.entity.js';

export const COMPANY_STATUSES = ['pending_activation', 'active', 'suspended'] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const COMPANY_INDUSTRIES = [
  'finance',
  'e-commerce',
  'healthcare',
  'education',
  'logistics',
  'manufacturing',
  'media',
  'real-estate',
  'technology',
  'other',
] as const;
export type CompanyIndustry = (typeof COMPANY_INDUSTRIES)[number];

/**
 * The tenant. Every other tenant-scoped table carries a `companyId` back to
 * this row, and `TenantScope` is what makes that boundary provable rather
 * than a convention someone can forget.
 */
@Entity({ name: 'company' })
export class Company extends BaseEntity {
  @Column({ type: 'text' })
  name!: string;

  /**
   * Where invoices and account notices go. Defaults to the registering
   * admin's contact address at signup but is independently editable
   * afterward — deliberately NOT a foreign key to any `User`, since it must
   * survive that admin being disabled.
   */
  @Index({ unique: true })
  @Column({ type: 'text' })
  billingEmail!: string;

  @Column({ type: 'text' })
  country!: string;

  @Column({
    type: 'enum',
    enum: COMPANY_INDUSTRIES,
    enumName: 'company_industry',
  })
  industry!: CompanyIndustry;

  @Column({
    type: 'enum',
    enum: COMPANY_STATUSES,
    enumName: 'company_status',
    default: 'pending_activation',
  })
  status!: CompanyStatus;

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt!: Date | null;
}
