import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  type EntityManager,
  IsNull,
  type ObjectLiteral,
} from 'typeorm';
import type { OffsetQueryDto } from '#/common/pagination/offset-query.dto.js';
import { toOffsetPage } from '#/common/pagination/paginate.js';
import type { OffsetPage } from '#/common/pagination/paginated-result.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { TenantScope } from '#/database/tenant-scope.js';
import { PLAN_CATALOG } from '#/subscriptions/plan-catalog.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import type {
  CreateWebhookEndpointDto,
  UpdateWebhookEndpointDto,
} from './dto/webhook-input.dto.js';
import { WebhookDelivery } from './webhook-delivery.entity.js';
import { WebhookDestinationService } from './webhook-destination.service.js';
import { WebhookEndpoint } from './webhook-endpoint.entity.js';
import { WebhookPublisher } from './webhook-publisher.service.js';
import { WebhookSecretService } from './webhook-secret.service.js';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScope,
    private readonly context: RequestContextService,
    private readonly destinations: WebhookDestinationService,
    private readonly secrets: WebhookSecretService,
    private readonly publisher: WebhookPublisher,
    private readonly queue: TaskQueue,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async create(
    dto: CreateWebhookEndpointDto,
  ): Promise<{ endpoint: WebhookEndpoint; secret: string }> {
    const companyId = this.context.requireCompanyId();
    const createdByUserId = this.context.requireUserId();
    const url = this.destinations.parseUrl(dto.url).toString();
    const generated = this.secrets.generate();
    const endpoint = await this.dataSource.transaction(async (manager) => {
      const subscription = await manager.findOne(Subscription, {
        where: { companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!subscription)
        throw new ConflictException('Choose a subscription plan first.');
      const active = await manager.count(WebhookEndpoint, {
        where: { companyId, active: true, deletedAt: IsNull() },
      });
      const limit = PLAN_CATALOG[subscription.plan].maxWebhookEndpoints;
      if (limit !== null && active >= limit) {
        throw new ConflictException(
          `${subscription.plan} allows ${limit} active webhook endpoint${limit === 1 ? '' : 's'}.`,
        );
      }
      const saved = await manager.save(
        manager.create(WebhookEndpoint, {
          companyId,
          createdByUserId,
          name: dto.name,
          url,
          events: [...new Set(dto.events)],
          ...generated.encrypted,
          active: true,
          consecutiveFailures: 0,
          disabledAt: null,
          deletedAt: null,
        }),
      );
      await this.audit.record(
        {
          action: 'webhook_endpoint.created',
          target: { type: 'webhook_endpoint', id: saved.id },
          metadata: { name: saved.name, events: saved.events },
        },
        manager,
      );
      return saved;
    });
    return { endpoint, secret: generated.plaintext };
  }

  async list(query: OffsetQueryDto): Promise<OffsetPage<WebhookEndpoint>> {
    const qb = this.mine(WebhookEndpoint, 'endpoint').andWhere(
      'endpoint.deletedAt IS NULL',
    );
    const [rows, total] = await qb
      .orderBy('endpoint.createdAt', 'DESC')
      .addOrderBy('endpoint.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return toOffsetPage(rows, total, query.page, query.limit);
  }

  async update(
    id: string,
    dto: UpdateWebhookEndpointDto,
  ): Promise<WebhookEndpoint> {
    if (
      dto.name === undefined &&
      dto.url === undefined &&
      dto.events === undefined &&
      dto.active === undefined
    ) {
      throw new BadRequestException('Provide name, url, events and/or active.');
    }
    return this.dataSource.transaction(async (manager) => {
      const endpoint = await this.requireEndpoint(id, manager);
      if (dto.name !== undefined) endpoint.name = dto.name;
      if (dto.url !== undefined)
        endpoint.url = this.destinations.parseUrl(dto.url).toString();
      if (dto.events !== undefined) endpoint.events = [...new Set(dto.events)];
      if (dto.active !== undefined && dto.active !== endpoint.active) {
        if (dto.active) {
          const subscription = await manager.findOne(Subscription, {
            where: { companyId: endpoint.companyId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!subscription)
            throw new ConflictException('Choose a subscription plan first.');
          const active = await manager.count(WebhookEndpoint, {
            where: {
              companyId: endpoint.companyId,
              active: true,
              deletedAt: IsNull(),
            },
          });
          const limit = PLAN_CATALOG[subscription.plan].maxWebhookEndpoints;
          if (limit !== null && active >= limit) {
            throw new ConflictException(
              `${subscription.plan} allows ${limit} active webhook endpoint${limit === 1 ? '' : 's'}.`,
            );
          }
          endpoint.active = true;
          endpoint.disabledAt = null;
          endpoint.consecutiveFailures = 0;
        } else {
          endpoint.active = false;
          endpoint.disabledAt = this.clock.now();
        }
      }
      const saved = await manager.save(endpoint);
      await this.audit.record(
        {
          action: 'webhook_endpoint.updated',
          target: { type: 'webhook_endpoint', id },
          metadata: { name: saved.name, events: saved.events },
        },
        manager,
      );
      return saved;
    });
  }

  async remove(id: string): Promise<WebhookEndpoint> {
    return this.dataSource.transaction(async (manager) => {
      const endpoint = await this.requireEndpoint(id, manager);
      endpoint.active = false;
      endpoint.deletedAt = this.clock.now();
      endpoint.disabledAt = endpoint.disabledAt ?? endpoint.deletedAt;
      const saved = await manager.save(endpoint);
      await this.audit.record(
        {
          action: 'webhook_endpoint.deleted',
          target: { type: 'webhook_endpoint', id },
          metadata: { name: saved.name },
        },
        manager,
      );
      return saved;
    });
  }

  async rotateSecret(id: string): Promise<{ id: string; secret: string }> {
    const generated = this.secrets.generate();
    await this.dataSource.transaction(async (manager) => {
      const endpoint = await this.requireEndpoint(id, manager);
      Object.assign(endpoint, generated.encrypted);
      await manager.save(endpoint);
      await this.audit.record(
        {
          action: 'webhook_endpoint.secret_rotated',
          target: { type: 'webhook_endpoint', id },
          metadata: {},
        },
        manager,
      );
    });
    return { id, secret: generated.plaintext };
  }

  async ping(id: string): Promise<WebhookDelivery> {
    return this.dataSource.transaction(async (manager) => {
      const endpoint = await this.requireEndpoint(id, manager);
      if (!endpoint.active)
        throw new ConflictException('Webhook endpoint is disabled.');
      return this.publisher.ping(manager, endpoint);
    });
  }

  async deliveries(
    id: string,
    query: OffsetQueryDto,
  ): Promise<OffsetPage<WebhookDelivery>> {
    await this.requireEndpoint(id, this.dataSource.manager);
    const qb = this.mine(WebhookDelivery, 'delivery').andWhere(
      'delivery.endpointId = :id',
      { id },
    );
    const [rows, total] = await qb
      .orderBy('delivery.createdAt', 'DESC')
      .addOrderBy('delivery.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return toOffsetPage(rows, total, query.page, query.limit);
  }

  async redeliver(deliveryId: string): Promise<WebhookDelivery> {
    return this.dataSource.transaction(async (manager) => {
      const delivery = await this.tenantScope
        .forCompany(
          manager.getRepository(WebhookDelivery),
          this.context.requireCompanyId(),
          'delivery',
        )
        .andWhere('delivery.id = :deliveryId', { deliveryId })
        .setLock('pessimistic_write')
        .getOne();
      if (!delivery) throw new NotFoundException('Webhook delivery not found.');
      const endpoint = await this.requireEndpoint(delivery.endpointId, manager);
      if (!endpoint.active)
        throw new ConflictException('Webhook endpoint is disabled.');
      if (delivery.status === 'pending')
        throw new ConflictException('Webhook delivery is already pending.');
      delivery.status = 'pending';
      delivery.attempts = 0;
      delivery.responseStatus = null;
      delivery.lastError = null;
      delivery.deliveredAt = null;
      await manager.save(delivery);
      await this.queue.enqueue('deliver_webhook', { deliveryId }, { manager });
      await this.audit.record(
        {
          action: 'webhook_delivery.redelivered',
          target: { type: 'webhook_delivery', id: deliveryId },
          metadata: { endpointId: endpoint.id, eventType: delivery.eventType },
        },
        manager,
      );
      return delivery;
    });
  }

  private mine<TEntity extends ObjectLiteral & { companyId: string }>(
    entity: new () => TEntity,
    alias: string,
  ) {
    return this.tenantScope.forCompany(
      this.dataSource.getRepository(entity),
      this.context.requireCompanyId(),
      alias,
    );
  }

  private async requireEndpoint(
    id: string,
    manager: EntityManager,
  ): Promise<WebhookEndpoint> {
    const endpoint = await this.tenantScope
      .forCompany(
        manager.getRepository(WebhookEndpoint),
        this.context.requireCompanyId(),
        'endpoint',
      )
      .andWhere('endpoint.id = :id AND endpoint.deletedAt IS NULL', { id })
      .getOne();
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found.');
    return endpoint;
  }
}
