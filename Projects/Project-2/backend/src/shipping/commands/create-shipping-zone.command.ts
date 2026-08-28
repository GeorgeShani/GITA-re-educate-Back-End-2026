import { CreateShippingZoneDto } from '@/shipping/dto/create-shipping-zone.dto';

export class CreateShippingZoneCommand {
  constructor(
    readonly dto: CreateShippingZoneDto,
    readonly correlationId: string,
  ) {}
}
