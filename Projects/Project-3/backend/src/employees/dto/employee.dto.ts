import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { OffsetPageOf } from '#/common/pagination/offset-page.dto.js';
import { toDto } from '#/common/response/to-dto.js';
import {
  USER_ROLES,
  USER_STATUSES,
  type User,
  type UserRole,
  type UserStatus,
} from '#/database/entities/user.entity.js';

/** The admin's full view of a person in their company. No credentials — see AuthIdentity. */
export class EmployeeDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ description: 'The company contact address invitations go to.' })
  @Expose()
  email!: string;

  @ApiProperty()
  @Expose()
  fullName!: string;

  @ApiProperty({ enum: USER_ROLES })
  @Expose()
  role!: UserRole;

  @ApiProperty({ enum: USER_STATUSES })
  @Expose()
  status!: UserStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Expose()
  activatedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Expose()
  disabledAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  static from(user: User): EmployeeDto {
    return toDto(EmployeeDto, user);
  }
}

export class EmployeePageDto extends OffsetPageOf(EmployeeDto) {}
