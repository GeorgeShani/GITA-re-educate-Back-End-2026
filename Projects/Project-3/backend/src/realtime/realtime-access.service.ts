import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantScope } from '#/database/tenant-scope.js';
import { FileAsset } from '#/files/file-asset.entity.js';
import {
  applyFileVisibility,
  type FileViewer,
} from '#/files/file-visibility.js';

@Injectable()
export class RealtimeAccessService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScope,
  ) {}

  async canViewFile(
    companyId: string,
    fileId: string,
    viewer: FileViewer,
  ): Promise<boolean> {
    const file = await applyFileVisibility(
      this.tenantScope.forCompany(
        this.dataSource.getRepository(FileAsset),
        companyId,
        'f',
      ),
      'f',
      viewer,
    )
      .andWhere('f.id = :fileId', { fileId })
      .getOne();
    return file !== null;
  }
}
