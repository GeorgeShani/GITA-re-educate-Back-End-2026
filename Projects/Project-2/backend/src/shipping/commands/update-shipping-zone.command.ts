import { UpdateShippingZoneDto } from '../dto/update-shipping-zone.dto';

export class UpdateShippingZoneCommand {
  constructor(
    readonly zoneId: string,
    readonly dto: UpdateShippingZoneDto,
    readonly correlationId: string,
  ) {}
}
