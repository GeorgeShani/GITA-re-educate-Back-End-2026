import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { type ClientMeta, type Session, SessionService } from '#/auth/session.service.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';

/**
 * "Explore the demo": signs in the seeded demo company's admin without a password.
 * That is safe ONLY because the company is read-only (`DemoReadOnlyGuard`) and holds
 * nothing but seeded data; the demo admin has no password identity at all, so there is
 * no credential to guess.
 */
@Injectable()
export class DemoService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sessions: SessionService,
  ) {}

  async login(meta: ClientMeta): Promise<Session> {
    const company = await this.dataSource.getRepository(Company).findOne({ where: { isDemo: true, status: 'active' } });
    const admin = company
      ? await this.dataSource
          .getRepository(User)
          .findOne({ where: { companyId: company.id, role: 'admin', status: 'active' } })
      : null;
    if (!admin) {
      throw new NotFoundException('The demo is not available on this server (run `npm run seed:demo`).');
    }

    return this.dataSource.transaction((manager) => this.sessions.startSession(manager, admin.id, randomUUID(), meta));
  }
}
