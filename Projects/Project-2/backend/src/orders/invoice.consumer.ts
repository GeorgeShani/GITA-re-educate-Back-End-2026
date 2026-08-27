import { Inject } from '@nestjs/common';
import { Processor } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { BaseConsumer } from '../core/queues/base.consumer';
import { QueueName } from '../core/queues/queue-names.enum';
import { OutboxJobData } from '../core/outbox/outbox.publisher';
import { STORAGE_PROVIDER_TOKEN } from '../media/providers/storage-provider.interface';
import type { StorageProvider } from '../media/providers/storage-provider.interface';
import { InvoicePdfService } from './invoice-pdf.service';
import { Order, OrderDocument } from './schemas/order.schema';

@Processor(QueueName.INVOICES)
export class InvoiceConsumer extends BaseConsumer {
  constructor(
    cls: ClsService,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly invoicePdfService: InvoicePdfService,
    @Inject(STORAGE_PROVIDER_TOKEN)
    private readonly storageProvider: StorageProvider,
  ) {
    super(cls);
  }

  protected async handle(job: Job<OutboxJobData>): Promise<void> {
    const order = await this.orderModel.findById(job.data.aggregateId);
    if (!order || order.invoiceUrl) {
      return; // deleted, or already generated (redelivered job) — idempotent no-op
    }

    const buffer = await this.invoicePdfService.generate(order);
    const asset = await this.storageProvider.uploadBuffer({
      buffer,
      folder: 'invoices',
      publicId: order.orderNumber,
      resourceType: 'raw',
    });

    order.invoiceUrl = asset.url;
    await order.save();
  }
}
