import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../core/audit/audit.service.js';
import { RequestContextService } from '../core/context/request-context.service.js';
import { Company } from '../database/entities/company.entity.js';
import { isUniqueViolation } from '../database/pg-errors.js';
import type { UpdateCompanyDto } from './dto/update-company.dto.js';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly context: RequestContextService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Updates the caller's own company — the id comes from request context, never
   * from the URL or body, so there is no way to name another tenant.
   */
  async updateMine(dto: UpdateCompanyDto): Promise<Company> {
    const companyId = this.context.requireCompanyId();

    const changes: Partial<Pick<Company, 'name' | 'country' | 'industry' | 'billingEmail'>> = {};
    if (dto.name !== undefined) changes.name = dto.name;
    if (dto.country !== undefined) changes.country = dto.country;
    if (dto.industry !== undefined) changes.industry = dto.industry;
    if (dto.billingEmail !== undefined) changes.billingEmail = dto.billingEmail;

    const changedFields = Object.keys(changes);
    if (changedFields.length === 0) throw new BadRequestException('No fields to update');

    try {
      return await this.dataSource.transaction(async (manager) => {
        await manager.update(Company, { id: companyId }, changes);
        await this.audit.record(
          {
            action: 'company.updated',
            target: { type: 'company', id: companyId },
            metadata: { fields: changedFields },
          },
          manager,
        );
        return manager.findOneOrFail(Company, { where: { id: companyId } });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Another company already uses that billing email');
      }
      throw error;
    }
  }
}
