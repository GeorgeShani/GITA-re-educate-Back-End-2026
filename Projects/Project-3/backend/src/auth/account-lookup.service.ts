import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AuthIdentity } from '../database/entities/auth-identity.entity.js';

/**
 * Login is by *password identity email*, not `User.email`: the latter is only
 * unique per company, so it cannot say who is signing in. The partial unique
 * index on `lower(email) WHERE provider = 'password'` guarantees at most one
 * match, and this query is what that index serves.
 *
 * Returns the identity with `user` and `user.company` loaded, since every
 * caller needs to check both statuses.
 */
@Injectable()
export class AccountLookupService {
  constructor(
    @InjectRepository(AuthIdentity) private readonly identities: Repository<AuthIdentity>,
  ) {}

  findByLoginEmail(email: string): Promise<AuthIdentity | null> {
    return this.identities
      .createQueryBuilder('identity')
      .innerJoinAndSelect('identity.user', 'user')
      .innerJoinAndSelect('user.company', 'company')
      .where("identity.provider = 'password'")
      .andWhere('lower(identity.email) = :email', { email: email.toLowerCase() })
      .getOne();
  }
}
