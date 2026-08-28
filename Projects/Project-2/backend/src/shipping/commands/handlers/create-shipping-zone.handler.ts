import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { ShippingZoneCreatedEvent } from '@/shipping/events/shipping-zone-created.event';
import {
  ShippingZone,
  ShippingZoneDocument,
} from '@/shipping/schemas/shipping-zone.schema';
import { CreateShippingZoneCommand } from '@/shipping/commands/create-shipping-zone.command';

@CommandHandler(CreateShippingZoneCommand)
export class CreateShippingZoneHandler
  extends TransactionalCommandHandler<CreateShippingZoneCommand>
  implements ICommandHandler<CreateShippingZoneCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(ShippingZone.name)
    private readonly zoneModel: Model<ShippingZoneDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(
    command: CreateShippingZoneCommand,
  ): Promise<ShippingZoneDocument> {
    const { dto } = command;

    return this.withTransaction(async (session) => {
      const [zone] = await this.zoneModel.create(
        [
          {
            name: dto.name,
            countryCodes: dto.countryCodes.map((code) => code.toUpperCase()),
            rates: dto.rates ?? [],
            isActive: dto.isActive ?? true,
          },
        ],
        { session },
      );

      await this.outboxRepository.write(
        new ShippingZoneCreatedEvent(zone.id, zone.name, command.correlationId),
        session,
      );

      return zone;
    });
  }
}
