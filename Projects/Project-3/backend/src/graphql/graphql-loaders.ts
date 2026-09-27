import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { User } from '#/database/entities/user.entity.js';
import { TenantScope } from '#/database/tenant-scope.js';
import { FileComment } from '#/comments/file-comment.entity.js';
import { DataQualityReport } from '#/files/data-quality-report.entity.js';
import { FileAccessGrant } from '#/files/file-access-grant.entity.js';
import { FileAsset } from '#/files/file-asset.entity.js';
import { applyFileVisibility } from '#/files/file-visibility.js';
import { type ReportView, toReportView } from '#/files/quality/reports.service.js';

const countRowsSchema = z.array(
  z.object({ fileId: z.uuid(), count: z.coerce.number().int().nonnegative() }),
);

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function missing(kind: string, id: string): Error {
  return new Error(`${kind} ${id} no longer exists.`);
}

export interface GraphqlLoaders {
  users: DataLoader<string, User>;
  reports: DataLoader<string, ReportView>;
  grants: DataLoader<string, User[]>;
  versions: DataLoader<string, FileAsset[]>;
  commentCounts: DataLoader<string, number>;
}

/**
 * Creates one isolated loader set per GraphQL request. Every batch reads the
 * tenant and viewer from CLS when it executes, then applies that boundary in
 * SQL. Nothing is cached across requests, companies, users, or API keys.
 */
@Injectable()
export class GraphqlLoaderFactory {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScope,
    private readonly context: RequestContextService,
  ) {}

  create(): GraphqlLoaders {
    return {
      users: new DataLoader((keys) => this.users(keys), { name: 'graphql-users' }),
      reports: new DataLoader((keys) => this.reports(keys), { name: 'graphql-reports' }),
      grants: new DataLoader((keys) => this.grants(keys), { name: 'graphql-grants' }),
      versions: new DataLoader((keys) => this.versions(keys), { name: 'graphql-versions' }),
      commentCounts: new DataLoader((keys) => this.commentCounts(keys), {
        name: 'graphql-comment-counts',
      }),
    };
  }

  private async users(keys: readonly string[]): Promise<Array<User | Error>> {
    const ids = unique(keys);
    const rows = await this.tenantScope
      .forCompany(
        this.dataSource.getRepository(User),
        this.context.requireCompanyId(),
        'u',
      )
      .andWhere('u.id IN (:...ids)', { ids })
      .getMany();
    const byId = new Map(rows.map((row) => [row.id, row]));
    return keys.map((id) => byId.get(id) ?? missing('User', id));
  }

  private async reports(
    keys: readonly string[],
  ): Promise<Array<ReportView | Error>> {
    const fileIds = unique(keys);
    const rows = await this.tenantScope
      .forCompany(
        this.dataSource.getRepository(DataQualityReport),
        this.context.requireCompanyId(),
        'r',
      )
      .andWhere('r.fileId IN (:...fileIds)', { fileIds })
      .getMany();
    const byFile = new Map(rows.map((row) => [row.fileId, toReportView(row)]));
    return keys.map(
      (fileId) => byFile.get(fileId) ?? missing('Report for file', fileId),
    );
  }

  private async grants(keys: readonly string[]): Promise<User[][]> {
    const fileIds = unique(keys);
    const rows = await this.dataSource
      .getRepository(FileAccessGrant)
      .createQueryBuilder('g')
      .innerJoin('g.file', 'f', 'f.companyId = :companyId', {
        companyId: this.context.requireCompanyId(),
      })
      .leftJoinAndSelect('g.user', 'u')
      .andWhere('g.fileId IN (:...fileIds)', { fileIds })
      .orderBy('g.createdAt', 'ASC')
      .addOrderBy('g.id', 'ASC')
      .getMany();
    const byFile = new Map<string, User[]>();
    for (const row of rows) {
      if (!row.user) continue;
      const users = byFile.get(row.fileId) ?? [];
      users.push(row.user);
      byFile.set(row.fileId, users);
    }
    return keys.map((fileId) => byFile.get(fileId) ?? []);
  }

  private async versions(keys: readonly string[]): Promise<FileAsset[][]> {
    const datasetIds = unique(keys);
    const userId = this.context.requireUserId();
    const role = this.context.requireRole();
    const scoped = this.tenantScope
      .forCompany(
        this.dataSource.getRepository(FileAsset),
        this.context.requireCompanyId(),
        'f',
      )
      .andWhere('f.datasetId IN (:...datasetIds)', { datasetIds });
    const rows = await applyFileVisibility(scoped, 'f', { userId, role })
      .orderBy('f.datasetId', 'ASC')
      .addOrderBy('f.version', 'DESC')
      .getMany();
    const byDataset = new Map<string, FileAsset[]>();
    for (const row of rows) {
      const files = byDataset.get(row.datasetId) ?? [];
      files.push(row);
      byDataset.set(row.datasetId, files);
    }
    return keys.map((datasetId) => byDataset.get(datasetId) ?? []);
  }

  private async commentCounts(keys: readonly string[]): Promise<number[]> {
    const fileIds = unique(keys);
    const raw: unknown = await this.tenantScope
      .forCompany(
        this.dataSource.getRepository(FileComment),
        this.context.requireCompanyId(),
        'c',
      )
      .select('c.fileId', 'fileId')
      .addSelect('COUNT(*)', 'count')
      .andWhere('c.fileId IN (:...fileIds)', { fileIds })
      .groupBy('c.fileId')
      .getRawMany();
    const rows = countRowsSchema.parse(raw);
    const byFile = new Map(rows.map((row) => [row.fileId, row.count]));
    return keys.map((fileId) => byFile.get(fileId) ?? 0);
  }
}

export interface GraphqlRequestContext {
  req: object;
  res: object;
  loaders?: GraphqlLoaders;
}
