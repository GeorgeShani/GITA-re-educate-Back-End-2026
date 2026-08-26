import { DomainEvent } from '../../core/events/domain-event.base';

export class MediaDeletedEvent extends DomainEvent {
  readonly eventName = 'media.deleted';
  readonly aggregateType = 'Media';

  // publicId travels in the payload because that's all the async
  // consumer (media queue) needs to call StorageProvider.destroy — it
  // has no reason to look the Media doc back up by aggregateId.
  constructor(
    readonly aggregateId: string,
    readonly publicId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
