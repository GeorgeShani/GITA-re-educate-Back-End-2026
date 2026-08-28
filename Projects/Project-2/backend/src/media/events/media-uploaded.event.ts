import { DomainEvent } from '@/core/events/domain-event.base';

export class MediaUploadedEvent extends DomainEvent {
  readonly eventName = 'media.uploaded';
  readonly aggregateType = 'Media';

  constructor(
    readonly aggregateId: string,
    readonly publicId: string,
    readonly ownerContext: string,
    readonly uploadedByUserId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
