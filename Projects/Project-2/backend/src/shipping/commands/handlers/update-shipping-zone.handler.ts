import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { ShippingZoneUpdatedEvent } from '../../events/shipping-zone-updated.event';
import {
  ShippingZone,
  ShippingZoneDocument,
} from '../../schemas/shipping-zone.schema';
import { UpdateShippingZoneCommand } from '../update-shipping-zone.command';

@CommandHandler(UpdateShippingZoneCommand)
export class UpdateShippingZoneHandler
  extends TransactionalCommandHandler<UpdateShippingZoneCommand>
  implements ICommandHandler<UpdateShippingZoneCommand>
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
    command: UpdateShippingZoneCommand,
  ): Promise<ShippingZoneDocument> {
    const { dto } = command;

    return this.withTransaction(async (session) => {
      const zone = await this.zoneModel
        .findById(command.zoneId)
        .session(session);
      if (!zone) {
        throw new NotFoundException(
          `Shipping zone with id ${command.zoneId} not found`,
        );
      }

      if (dto.name !== undefined) zone.name = dto.name;
      if (dto.countryCodes !== undefined) {
        zone.countryCodes = dto.countryCodes.map((code) => code.toUpperCase());
      }
      if (dto.rates !== undefined) zone.rates = dto.rates;
      if (dto.isActive !== undefined) zone.isActive = dto.isActive;

      await zone.save({ session });

      await this.outboxRepository.write(
        new ShippingZoneUpdatedEvent(zone.id, command.correlationId),
        session,
      );

      return zone;
    });
  }
}
