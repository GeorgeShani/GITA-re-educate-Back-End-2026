import { Agent, request } from 'undici';
import { Injectable } from '@nestjs/common';
import { sendToFirstReachable } from './send-to-any.js';
import {
  type PinnedDestination,
  WebhookDestinationService,
} from './webhook-destination.service.js';

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
    const destinations = await this.destinations.resolveAll(input.url);
    return sendToFirstReachable(destinations, (destination) =>
      this.sendTo(destination, input),
    );
  }

  private async sendTo(
    destination: PinnedDestination,
    input: WebhookRequest,
  ): Promise<WebhookResponse> {
    const dispatcher = new Agent({
      connect: {
        lookup: destination.lookup,
        servername: destination.url.hostname,
        // An unreachable address must fail fast so the next one gets its turn.
        timeout: 5_000,
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
      // The answer's body is of no interest, but it must be disposed of properly: `destroy()` on an undici body makes it
      // emit an AbortError nobody listens for, which Node raises as an UNCAUGHT exception — enough to take the API process
      // down after a delivery. `dump` reads at most a little and then closes it safely.
      await response.body.dump({ limit: 1_024 });
      return { status: response.statusCode };
    } finally {
      await dispatcher.close();
    }
  }
}
