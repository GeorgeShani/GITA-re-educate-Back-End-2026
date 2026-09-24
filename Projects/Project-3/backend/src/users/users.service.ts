import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { AuditService } from '#/core/audit/audit.service.js';
import type { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** The caller's own user and company. Looked up by primary key: it is *their* row. */
  async profile(userId: string): Promise<{ user: User; company: Company }> {
    const user = await this.users.findOne({ where: { id: userId }, relations: { company: true } });
    if (!user?.company) throw new NotFoundException('User not found');
    return { user, company: user.company };
  }

  async updateFullName(userId: string, fullName: string): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOneOrFail(User, { where: { id: userId } });
      await manager.update(User, { id: userId }, { fullName });
      await this.audit.record(
        {
          action: 'user.profile_updated',
          companyId: user.companyId,
          actorUserId: user.id,
          target: { type: 'user', id: user.id },
        },
        manager,
      );
      return manager.findOneOrFail(User, { where: { id: userId } });
    });
  }
}
