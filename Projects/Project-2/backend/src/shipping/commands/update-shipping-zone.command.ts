import { UpdateShippingZoneDto } from '@/shipping/dto/update-shipping-zone.dto';

export class UpdateShippingZoneCommand {
  constructor(
    readonly zoneId: string,
    readonly dto: UpdateShippingZoneDto,
    readonly correlationId: string,
  ) {}
}
