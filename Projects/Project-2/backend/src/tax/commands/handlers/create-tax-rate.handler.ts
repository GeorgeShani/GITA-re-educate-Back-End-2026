import { ConflictException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { TaxRateCreatedEvent } from '../../events/tax-rate-created.event';
import { TaxRate, TaxRateDocument } from '../../schemas/tax-rate.schema';
import { CreateTaxRateCommand } from '../create-tax-rate.command';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

@CommandHandler(CreateTaxRateCommand)
export class CreateTaxRateHandler
  extends TransactionalCommandHandler<CreateTaxRateCommand>
  implements ICommandHandler<CreateTaxRateCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(TaxRate.name)
    private readonly taxRateModel: Model<TaxRateDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: CreateTaxRateCommand): Promise<TaxRateDocument> {
    const { dto } = command;

    try {
      return await this.withTransaction(async (session) => {
        const [taxRate] = await this.taxRateModel.create(
          [
            {
              countryCode: dto.countryCode.toUpperCase(),
              region: dto.region,
              rateBasisPoints: dto.rateBasisPoints,
              isActive: dto.isActive ?? true,
            },
          ],
          { session },
        );

        await this.outboxRepository.write(
          new TaxRateCreatedEvent(
            taxRate.id,
            taxRate.countryCode,
            command.correlationId,
          ),
          session,
        );

        return taxRate;
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `A tax rate for ${dto.countryCode}${dto.region ? `/${dto.region}` : ''} already exists`,
        );
      }
      throw error;
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === MONGO_DUPLICATE_KEY_ERROR
    );
  }
}
