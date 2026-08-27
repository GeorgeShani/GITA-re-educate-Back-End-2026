import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsEnum } from 'class-validator';

import { Role } from '../../common/enums/role.enum';

// Replaces the array wholesale — the app's single-active-role decision
// means only roles[0] is ever authorized against (see
// admin-roles.constant.ts), so this is meant to set exactly one role in
// practice, not accumulate several.
export class UpdateUserRolesDto {
  @ApiProperty({ enum: Role, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(Role, { each: true })
  roles!: Role[];
}
