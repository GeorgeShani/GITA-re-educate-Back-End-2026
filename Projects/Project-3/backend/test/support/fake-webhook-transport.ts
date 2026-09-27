import type {
  WebhookRequest,
  WebhookResponse,
  WebhookTransport,
} from '#/outgoing-webhooks/webhook-transport.js';

type PlannedResult = WebhookResponse | Error;

export class FakeWebhookTransport implements WebhookTransport {
  readonly requests: WebhookRequest[] = [];
  private readonly planned: PlannedResult[] = [];

  respondWith(status: number): void {
    this.planned.push({ status });
  }

  failWith(message: string): void {
    this.planned.push(new Error(message));
  }

  async send(input: WebhookRequest): Promise<WebhookResponse> {
    this.requests.push({
      url: input.url,
      body: input.body,
      headers: { ...input.headers },
    });
    const result = this.planned.shift() ?? { status: 204 };
    if (result instanceof Error) throw result;
    return result;
  }

  reset(): void {
    this.requests.length = 0;
    this.planned.length = 0;
  }
}
