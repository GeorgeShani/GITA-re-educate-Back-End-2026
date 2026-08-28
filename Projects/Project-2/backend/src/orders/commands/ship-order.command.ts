import { ShipOrderDto } from '@/orders/dto/ship-order.dto';

export class ShipOrderCommand {
  constructor(
    readonly orderId: string,
    readonly dto: ShipOrderDto,
    readonly correlationId: string,
  ) {}
}
