import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  USER_ROLES,
  USER_STATUSES,
  type User,
  type UserRole,
  type UserStatus,
} from '../../database/entities/user.entity.js';
import { toDto } from '../../common/response/to-dto.js';

/** The signed-in person's own record. Holds no credentials — see AuthIdentity. */
export class UserProfileDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ description: 'The company contact address invites are sent to.' })
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

  static from(user: User): UserProfileDto {
    return toDto(UserProfileDto, user);
  }
}
