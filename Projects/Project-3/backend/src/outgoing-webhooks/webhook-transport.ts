import { Agent, request } from 'undici';
import { Injectable } from '@nestjs/common';
import { WebhookDestinationService } from './webhook-destination.service.js';

export interface WebhookRequest {
  url: string;
  body: string;
  headers: Record<string, string>;
}

export interface WebhookResponse {
  status: number;
}

export interface WebhookTransport {
  send(input: WebhookRequest): Promise<WebhookResponse>;
}

export const WEBHOOK_TRANSPORT = Symbol('WEBHOOK_TRANSPORT');

@Injectable()
export class UndiciWebhookTransport implements WebhookTransport {
  constructor(private readonly destinations: WebhookDestinationService) {}

  async send(input: WebhookRequest): Promise<WebhookResponse> {
    const destination = await this.destinations.resolve(input.url);
    const dispatcher = new Agent({
      connect: {
        lookup: destination.lookup,
        servername: destination.url.hostname,
      },
      headersTimeout: 10_000,
      bodyTimeout: 10_000,
    });
    try {
      const response = await request(destination.url, {
        method: 'POST',
        body: input.body,
        headers: input.headers,
        dispatcher,
      });
      response.body.destroy();
      return { status: response.statusCode };
    } finally {
      await dispatcher.close();
    }
  }
}
