import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Observable } from 'rxjs';

import type { AssistantSseEvent, ChatMessageDto, ChatSessionDto } from '@/app/core/api/dto';
import { API_BASE_URL, ApiClient } from '@/app/core/services/api-client';
import { SseHttpError, streamSse } from '@/app/core/api/sse-client';
import { AuthService } from '@/app/core/services/auth.service';
import { TokenStore } from '@/app/core/services/token-store';

/**
 * Session/message CRUD stays plain HttpClient (ApiClient); only the two
 * streaming endpoints use the raw fetch-based sse-client, since
 * HttpClient has no ReadableStream story that works with @Sse() here.
 */
@Service()
export class AssistantService {
  private readonly api = inject(ApiClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly tokens = inject(TokenStore);
  private readonly auth = inject(AuthService);

  listSessions(): Observable<ChatSessionDto[]> {
    return this.api.get<ChatSessionDto[]>('/assistant/sessions');
  }

  createSession(): Observable<ChatSessionDto> {
    return this.api.post<ChatSessionDto>('/assistant/sessions', {});
  }

  getMessages(sessionId: string): Observable<ChatMessageDto[]> {
    return this.api.get<ChatMessageDto[]>(`/assistant/sessions/${sessionId}/messages`);
  }

  sendMessage(sessionId: string, message: string, signal?: AbortSignal): AsyncGenerator<AssistantSseEvent> {
    return this.stream(`/assistant/sessions/${sessionId}/messages`, { message }, signal);
  }

  confirmToolCall(
    sessionId: string,
    messageId: string,
    approve: boolean,
    signal?: AbortSignal,
  ): AsyncGenerator<AssistantSseEvent> {
    return this.stream(
      `/assistant/sessions/${sessionId}/messages/${messageId}/confirm`,
      { approve },
      signal,
    );
  }

  /**
   * One retry on a 401, same spirit as core/interceptors/auth.interceptor.ts
   * — but a raw fetch() stream bypasses that interceptor entirely, so a
   * near-expiry access token needs its own refresh-and-retry here.
   */
  private async *stream(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): AsyncGenerator<AssistantSseEvent> {
    const url = `${this.baseUrl}${path}`;
    try {
      yield* streamSse<AssistantSseEvent>({ url, body, accessToken: this.tokens.accessToken(), signal });
    } catch (error) {
      const shouldRetry =
        error instanceof SseHttpError && error.status === 401 && this.tokens.refreshToken() !== null;
      if (!shouldRetry) throw error;

      const refreshed = await firstValueFrom(this.auth.refresh());
      yield* streamSse<AssistantSseEvent>({ url, body, accessToken: refreshed.accessToken, signal });
    }
  }
}
