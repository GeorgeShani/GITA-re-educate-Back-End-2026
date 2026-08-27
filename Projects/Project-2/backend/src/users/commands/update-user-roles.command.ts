import { Role } from '../../common/enums/role.enum';

export class UpdateUserRolesCommand {
  constructor(
    readonly userId: string,
    readonly roles: Role[],
    readonly correlationId: string,
  ) {}
}
