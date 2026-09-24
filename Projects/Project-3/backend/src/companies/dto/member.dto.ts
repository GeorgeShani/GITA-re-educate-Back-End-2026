import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { toDto } from '#/common/response/to-dto.js';
import type { User } from '#/database/entities/user.entity.js';

/**
 * `{ id, fullName }` and NOTHING else — no email, role, status or anything an
 * employee could use to reach or profile a colleague. It exists so an employee
 * can name grantees when uploading a restricted file (brief req. 9) while
 * `GET /employees` stays admin-only (req. 7). See decision D1. Adding a field
 * here widens what every employee can learn; the spec asserts the exact key set.
 */
export class MemberDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  fullName!: string;

  static from(user: User): MemberDto {
    return toDto(MemberDto, user);
  }
}
