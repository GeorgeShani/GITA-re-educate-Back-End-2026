import { ShipOrderDto } from '../dto/ship-order.dto';

export class ShipOrderCommand {
  constructor(
    readonly orderId: string,
    readonly dto: ShipOrderDto,
    readonly correlationId: string,
  ) {}
}
