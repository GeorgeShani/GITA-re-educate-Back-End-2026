import { DomainEvent } from '../../core/events/domain-event.base';
import { Role } from '../../common/enums/role.enum';

export class UserRolesUpdatedEvent extends DomainEvent {
  readonly eventName = 'user.roles_updated';
  readonly aggregateType = 'User';

  constructor(
    readonly aggregateId: string,
    readonly roles: Role[],
    correlationId: string,
  ) {
    super(correlationId);
  }
}
