import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { parse } from 'marked';

import type {
  AssistantSseEvent,
  ChatMessageDto,
  ChatSessionDto,
  StoredToolCallDto,
} from '@/app/core/api/dto';
import { AssistantPanelState } from '@/app/core/services/assistant-panel-state.service';
import { AssistantService } from '@/app/core/services/assistant.service';
import { AuthService } from '@/app/core/services/auth.service';
import { CartService } from '@/app/core/services/cart.service';
import { closestForm, inputValue } from '@/app/core/util/dom-event';
import { ActionButton } from '@/app/shared/ui/action-button';
import { DrawerPanel } from '@/app/shared/ui/drawer-panel';
import { IconButton } from '@/app/shared/ui/icon-button';
import { IconGlyph } from '@/app/shared/ui/icon-glyph';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';

const SESSION_STORAGE_KEY = 'assistant.activeSessionId';

const SUGGESTIONS = [
  'What clubs suit a beginner?',
  'Show me golf balls under $30',
  'Compare two rangefinders',
];

interface ProductChip {
  slug: string;
  name: string;
  brand?: string;
  priceMinor: number;
  compareAtPriceMinor?: number;
}

/**
 * The SSE chat panel — slide-over via drawer-panel, launched from the
 * bottom-right sparkles FAB (auth-gated: assistant routes are JWT-only,
 * backend/src/assistant/assistant.controller.ts).
 *
 * State model: `messages` is always the last-fetched, authoritative
 * server transcript. A send/confirm appends nothing to it directly —
 * `streamingText` holds the in-flight assistant reply as a separate,
 * ephemeral signal shown after the real list, and once the stream ends
 * (done/confirmation_required/error) the transcript is refetched and
 * streamingText clears. Simpler and more correct than hand-reconstructing
 * ids/toolCalls/toolResults locally to match what the server persisted.
 *
 * The root wrapper is `.chat`, NOT `.assistant` — an assistant message
 * bubble is `.bubble.assistant`, and a shared `.assistant` class name let
 * the wrapper's `display:flex; height:100%` rule land on every bubble and
 * stretch it (and collapse the typing dots into a vertical sliver).
 */
@Component({
  selector: 'assistant-panel',
  imports: [
    RouterLink,
    DatePipe,
    MoneyPipe,
    ActionButton,
    DrawerPanel,
    IconButton,
    IconGlyph,
    SkeletonBlock,
  ],
  template: `
    @if (auth.isAuthenticated() && !panelState.open()) {
      <button
        type="button"
        class="fab"
        aria-label="Open shopping assistant"
        (click)="panelState.toggle()"
      >
        <icon-glyph name="sparkles" [size]="24" />
      </button>
    }

    <drawer-panel side="right" [open]="panelState.open()" (openChange)="onOpenChange($event)">
      <div class="chat">
        <header class="head">
          <div class="head-title">
            <span class="head-badge"><icon-glyph name="sparkles" [size]="18" /></span>
            <h2>Shopping Assistant</h2>
          </div>
          <div class="head-actions">
            <button type="button" class="head-btn" (click)="startNewChat()">
              <icon-glyph name="plus" [size]="16" />
              New chat
            </button>
            <button type="button" class="head-btn" (click)="toggleHistory()">
              {{ view() === 'history' ? 'Back to chat' : 'History' }}
            </button>
          </div>
        </header>

        @if (view() === 'history') {
          <div class="history">
            @if (sessionsLoading()) {
              <skeleton-block height="52px" width="100%" />
              <skeleton-block height="52px" width="100%" />
              <skeleton-block height="52px" width="100%" />
            } @else if (sessions().length === 0) {
              <div class="history-empty">
                <p>No conversations yet.</p>
                <action-button size="s" variant="secondary" (click)="startNewChat()">
                  Start one
                </action-button>
              </div>
            } @else {
              <ul role="list">
                @for (s of sessions(); track s.id) {
                  <li class="session" [class.is-active]="s.id === activeSessionId()">
                    <button type="button" class="session-open" (click)="selectSession(s.id)">
                      <span class="session-title">{{ s.title || 'New conversation' }}</span>
                      <span class="session-date">{{ s.updatedAt | date: 'mediumDate' }}</span>
                    </button>
                    @if (confirmingDeleteId() === s.id) {
                      <div class="session-confirm">
                        <span>Delete?</span>
                        <button type="button" (click)="confirmingDeleteId.set(null)">Cancel</button>
                        <button
                          type="button"
                          class="danger"
                          [disabled]="deletingId() === s.id"
                          (click)="deleteSession(s.id)"
                        >
                          Delete
                        </button>
                      </div>
                    } @else {
                      <icon-button
                        icon="trash-2"
                        ariaLabel="Delete conversation"
                        class="session-trash"
                        (clicked)="confirmingDeleteId.set(s.id)"
                      />
                    }
                  </li>
                }
              </ul>
            }
          </div>
        } @else {
          <div class="thread" #threadEl>
            @if (messagesLoading()) {
              <skeleton-block height="60px" width="100%" />
              <skeleton-block height="40px" width="70%" />
            } @else if (messages().length === 0 && !streamingText() && !sending()) {
              <div class="welcome">
                <span class="welcome-badge"><icon-glyph name="sparkles" [size]="24" /></span>
                <h3>How can I help?</h3>
                <p>Find gear, compare products, check stock, or add things to your cart.</p>
                <div class="suggestions">
                  @for (s of suggestions; track s) {
                    <button type="button" class="suggestion" (click)="useSuggestion(s)">
                      {{ s }}
                    </button>
                  }
                </div>
              </div>
            }

            @for (m of messages(); track m.id) {
              @switch (m.role) {
                @case ('user') {
                  <div class="bubble user">{{ m.content }}</div>
                }
                @case ('assistant') {
                  @if (m.content) {
                    <div class="bubble assistant" [innerHTML]="renderMarkdown(m.content)"></div>
                  }
                  @if (m.pendingConfirmation) {
                    <div class="confirm-card">
                      @for (call of m.toolCalls ?? []; track call.id) {
                        <p>{{ describeToolCall(call) }}</p>
                      }
                      <div class="confirm-actions">
                        <button
                          type="button"
                          class="decline"
                          [disabled]="sending()"
                          (click)="respondConfirmation(m.id, false)"
                        >
                          Decline
                        </button>
                        <action-button
                          size="s"
                          [loading]="sending()"
                          (click)="respondConfirmation(m.id, true)"
                        >
                          Approve
                        </action-button>
                      </div>
                    </div>
                  }
                }
                @case ('tool') {
                  @if (productChipsFor(m); as chips) {
                    @if (chips.length > 0) {
                      <div class="chips">
                        @for (chip of chips; track chip.slug) {
                          <a
                            class="chip"
                            [routerLink]="['/product', chip.slug]"
                            (click)="panelState.close()"
                          >
                            @if (chip.brand) {
                              <span class="chip-brand">{{ chip.brand }}</span>
                            }
                            <span class="chip-name">{{ chip.name }}</span>
                            <span class="chip-price" data-numeric>{{
                              chip.priceMinor | money
                            }}</span>
                          </a>
                        }
                      </div>
                    }
                  }
                }
              }
            }

            @if (streamingText(); as text) {
              <div class="bubble assistant" [innerHTML]="renderMarkdown(text)"></div>
            } @else if (sending()) {
              <div class="bubble assistant typing" aria-label="Assistant is typing">
                <span></span><span></span><span></span>
              </div>
            }

            @if (streamError(); as err) {
              <p class="stream-error">{{ err }}</p>
            }
          </div>

          <form class="composer" (submit)="onSend($event)">
            <textarea
              rows="1"
              placeholder="Ask about golf gear…"
              [value]="draft()"
              [disabled]="sending()"
              (input)="draft.set(inputValue($event))"
              (keydown.enter)="onEnterKey($event)"
            ></textarea>
            @if (sending()) {
              <button type="button" class="stop" (click)="stopStreaming()">Stop</button>
            } @else {
              <action-button type="submit" size="s" [disabled]="!draft().trim()">Send</action-button>
            }
          </form>
        }
      </div>
    </drawer-panel>
  `,
  styles: `
    @use 'styles/typography' as type;

    /*
     * Bottom-right floating launcher — the established convention for a
     * chat/AI assistant widget (Intercom, Drift, Zendesk all use exactly
     * this position and shape), so it reads as "chat with us" at a glance
     * rather than competing with the header's transactional icons
     * (search/account/cart). Hidden while the panel itself is open —
     * same "toggle, don't stack" behavior those products use.
     */
    .fab {
      position: fixed;
      right: var(--space-6);
      bottom: var(--space-6);
      z-index: var(--z-sticky);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: var(--radius-full);
      background: var(--color-neutral-07);
      color: var(--color-white);
      box-shadow: 0 6px 20px -4px rgba(15, 15, 15, 0.35);
      transition:
        transform var(--duration-fast) var(--ease-out),
        background-color var(--duration-fast) var(--ease-out);

      &:hover {
        background: var(--color-neutral-06);
        transform: translateY(-1px) scale(1.04);
      }

      &:active {
        transform: scale(0.96);
      }
    }

    .chat {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    /* ---- header ------------------------------------------------------ */

    .head {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding-bottom: var(--space-4);
      border-bottom: 1px solid var(--color-neutral-03);
      margin-bottom: var(--space-4);
    }

    .head-title {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      color: var(--color-neutral-07);
    }

    .head-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-full);
      background: var(--color-neutral-07);
      color: var(--color-white);
      flex-shrink: 0;
    }

    .head-title h2 {
      @include type.body-1-semi;
      margin: 0;
      white-space: nowrap;
    }

    .head-actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .head-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
      color: var(--color-neutral-06);
      @include type.caption-1-semi;
      transition:
        background-color var(--duration-fast) var(--ease-out),
        box-shadow var(--duration-fast) var(--ease-out);

      &:hover {
        background: var(--color-neutral-02);
        box-shadow: inset 0 0 0 1px var(--color-neutral-04);
      }

      &:last-child {
        margin-left: auto;
        box-shadow: none;

        &:hover {
          box-shadow: none;
        }
      }
    }

    /* ---- history ---------------------------------------------------- */

    .history {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .history ul {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .history-empty {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-4);
      padding-top: var(--space-4);

      p {
        @include type.caption-1;
        margin: 0;
        color: var(--color-neutral-04);
      }
    }

    .session {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      padding-right: var(--space-2);
      border-radius: var(--radius-md);
      transition: background-color var(--duration-fast) var(--ease-out);

      &:hover,
      &.is-active {
        background: var(--color-neutral-02);
      }
    }

    .session-open {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      flex: 1;
      min-width: 0;
      padding: var(--space-3);
    }

    .session-title {
      @include type.caption-1-semi;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--color-neutral-07);
    }

    .session-date {
      @include type.caption-2;
      color: var(--color-neutral-04);
    }

    .session-trash {
      color: var(--color-neutral-04);
      opacity: 0;
      transition: opacity var(--duration-fast) var(--ease-out);
    }

    .session:hover .session-trash,
    .session-trash:focus-within {
      opacity: 1;
    }

    @media (hover: none) {
      .session-trash {
        opacity: 1;
      }
    }

    .session-confirm {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) 0;
      @include type.caption-2;
      color: var(--color-neutral-05);

      button {
        @include type.caption-2-semi;
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-sm);
        color: var(--color-neutral-06);

        &:hover {
          background: var(--color-neutral-03);
        }
      }

      button.danger {
        color: var(--color-error);

        &:disabled {
          opacity: 0.5;
        }
      }
    }

    /* ---- thread ---------------------------------------------------- */

    .thread {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding-bottom: var(--space-3);
    }

    .welcome {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--space-2);
      margin: auto 0;
      padding: var(--space-6) var(--space-2);
    }

    .welcome-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      margin-bottom: var(--space-2);
      border-radius: var(--radius-full);
      background: var(--color-neutral-02);
      color: var(--color-neutral-07);
    }

    .welcome h3 {
      @include type.body-1-semi;
      margin: 0;
      color: var(--color-neutral-07);
    }

    .welcome p {
      @include type.caption-1;
      margin: 0;
      max-width: 22rem;
      color: var(--color-neutral-04);
    }

    .suggestions {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      width: 100%;
      margin-top: var(--space-4);
    }

    .suggestion {
      @include type.caption-1;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
      color: var(--color-neutral-07);
      text-align: left;
      transition:
        background-color var(--duration-fast) var(--ease-out),
        box-shadow var(--duration-fast) var(--ease-out);

      &:hover {
        background: var(--color-neutral-02);
        box-shadow: inset 0 0 0 1px var(--color-neutral-04);
      }
    }

    .bubble {
      @include type.body-2;
      max-width: 88%;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-lg);
    }

    .bubble.user {
      align-self: flex-end;
      background: var(--color-neutral-07);
      color: var(--color-white);
      border-bottom-right-radius: var(--radius-sm);
    }

    .bubble.assistant {
      align-self: flex-start;
      background: var(--color-neutral-02);
      color: var(--color-neutral-07);
      border-bottom-left-radius: var(--radius-sm);

      ::ng-deep p {
        margin: 0 0 var(--space-2);
      }

      ::ng-deep p:last-child {
        margin-bottom: 0;
      }

      ::ng-deep ul {
        margin: 0 0 var(--space-2);
        padding-left: var(--space-5);
      }

      ::ng-deep strong {
        color: inherit;
      }
    }

    .bubble.typing {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: var(--space-3) var(--space-4);

      span {
        width: 6px;
        height: 6px;
        border-radius: var(--radius-full);
        background: var(--color-neutral-04);
        animation: typing-bounce 1.2s infinite ease-in-out;

        &:nth-child(2) {
          animation-delay: 0.15s;
        }

        &:nth-child(3) {
          animation-delay: 0.3s;
        }
      }
    }

    @keyframes typing-bounce {
      0%,
      60%,
      100% {
        opacity: 0.3;
        transform: translateY(0);
      }
      30% {
        opacity: 1;
        transform: translateY(-3px);
      }
    }

    .confirm-card {
      align-self: flex-start;
      max-width: 88%;
      padding: var(--space-4);
      border-radius: var(--radius-lg);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);

      p {
        @include type.caption-1;
        margin: 0 0 var(--space-3);
        color: var(--color-neutral-07);

        &:last-of-type {
          margin-bottom: var(--space-4);
        }
      }
    }

    .confirm-actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .decline {
      @include type.caption-1-semi;
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      color: var(--color-neutral-05);

      &:hover {
        background: var(--color-neutral-02);
      }
    }

    .chips {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      align-self: flex-start;
      max-width: 88%;
    }

    .chip {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
      color: var(--color-neutral-07);
      transition: background-color var(--duration-fast) var(--ease-out);

      &:hover {
        background: var(--color-neutral-02);
      }
    }

    .chip-brand {
      @include type.caption-2;
      color: var(--color-neutral-04);
    }

    .chip-name {
      @include type.caption-1-semi;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chip-price {
      @include type.caption-1-semi;
      white-space: nowrap;
    }

    .stream-error {
      @include type.caption-1;
      align-self: flex-start;
      color: var(--color-error);
    }

    /* ---- composer ------------------------------------------------- */

    .composer {
      display: flex;
      align-items: flex-end;
      gap: var(--space-2);
      padding: var(--space-2);
      border-radius: var(--radius-lg);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
      transition: box-shadow var(--duration-fast) var(--ease-out);

      &:focus-within {
        box-shadow: inset 0 0 0 1px var(--color-neutral-07);
      }
    }

    .composer textarea {
      @include type.body-2;
      flex: 1;
      min-height: 32px;
      max-height: 120px;
      padding: var(--space-2);
      border: none;
      background: none;
      color: var(--color-neutral-07);
      resize: none;

      &::placeholder {
        color: var(--color-neutral-04);
      }

      &:focus-visible {
        outline: none;
      }
    }

    .stop {
      @include type.caption-1-semi;
      flex-shrink: 0;
      align-self: center;
      padding: var(--space-2) var(--space-3);
      color: var(--color-error);

      &:hover {
        background: var(--color-neutral-02);
        border-radius: var(--radius-md);
      }
    }
  `,
})
export class AssistantPanel {
  protected readonly panelState = inject(AssistantPanelState);
  private readonly assistant = inject(AssistantService);
  protected readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly threadEl = viewChild<ElementRef<HTMLDivElement>>('threadEl');

  protected readonly suggestions = SUGGESTIONS;

  protected readonly view = signal<'chat' | 'history'>('chat');
  protected readonly activeSessionId = signal<string | null>(readStoredSessionId());

  protected readonly sessions = signal<ChatSessionDto[]>([]);
  protected readonly sessionsLoading = signal(false);
  protected readonly confirmingDeleteId = signal<string | null>(null);
  protected readonly deletingId = signal<string | null>(null);

  protected readonly messages = signal<ChatMessageDto[]>([]);
  protected readonly messagesLoading = signal(false);

  protected readonly inputValue = inputValue;
  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly streamingText = signal<string | null>(null);
  protected readonly streamError = signal<string | null>(null);

  private abortController: AbortController | null = null;
  private sessionLoadedFor: string | null = null;

  constructor() {
    // Loads the persisted session's transcript the first time the panel is
    // actually opened, not eagerly at app boot (it's mounted globally in
    // app.ts so it exists before the user ever clicks the launcher).
    effect(() => {
      if (!this.panelState.open()) return;
      if (!this.auth.isAuthenticated()) {
        this.panelState.close();
        return;
      }
      const sessionId = this.activeSessionId();
      if (sessionId && this.sessionLoadedFor !== sessionId) {
        this.loadMessages(sessionId);
      }
    });

    effect(() => {
      // Re-run on every change to these so the thread stays pinned to the
      // latest message as it streams in, not just once at the end.
      this.messages();
      this.streamingText();
      const el = this.threadEl()?.nativeElement;
      if (el) queueMicrotask(() => (el.scrollTop = el.scrollHeight));
    });

    this.destroyRef.onDestroy(() => this.abortController?.abort());
  }

  protected onOpenChange(open: boolean): void {
    // drawer-panel only ever emits false here (backdrop click, Escape, its
    // own close button) — it never opens itself.
    if (open) return;
    this.panelState.close();
    this.abortController?.abort();
  }

  protected startNewChat(): void {
    this.activeSessionId.set(null);
    this.sessionLoadedFor = null;
    writeStoredSessionId(null);
    this.messages.set([]);
    this.streamError.set(null);
    this.view.set('chat');
  }

  protected useSuggestion(text: string): void {
    this.draft.set(text);
    this.submitDraft();
  }

  protected toggleHistory(): void {
    if (this.view() === 'history') {
      this.view.set('chat');
      return;
    }
    this.view.set('history');
    this.confirmingDeleteId.set(null);
    this.sessionsLoading.set(true);
    this.assistant.listSessions().subscribe({
      next: (list) => {
        this.sessions.set(list);
        this.sessionsLoading.set(false);
      },
      error: () => this.sessionsLoading.set(false),
    });
  }

  protected selectSession(sessionId: string): void {
    this.activeSessionId.set(sessionId);
    writeStoredSessionId(sessionId);
    this.view.set('chat');
    this.loadMessages(sessionId);
  }

  protected deleteSession(sessionId: string): void {
    if (this.deletingId()) return;
    this.deletingId.set(sessionId);
    this.assistant.deleteSession(sessionId).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.confirmingDeleteId.set(null);
        this.sessions.update((list) => list.filter((s) => s.id !== sessionId));
        if (this.activeSessionId() === sessionId) this.startNewChat();
      },
      error: () => {
        this.deletingId.set(null);
        this.confirmingDeleteId.set(null);
      },
    });
  }

  protected onEnterKey(event: Event): void {
    // Angular types a filtered binding like `(keydown.enter)`'s $event as
    // plain Event, not KeyboardEvent (confirmed against the compiler, not
    // assumed) — narrow with a real check instead of casting.
    if (!(event instanceof KeyboardEvent) || event.shiftKey) return;
    event.preventDefault();
    closestForm(event)?.requestSubmit();
  }

  protected onSend(event: SubmitEvent): void {
    event.preventDefault();
    this.submitDraft();
  }

  private submitDraft(): void {
    const text = this.draft().trim();
    if (!text || this.sending()) return;
    this.draft.set('');

    const existingSessionId = this.activeSessionId();
    if (existingSessionId) {
      this.beginTurn(existingSessionId, text);
      return;
    }

    this.assistant.createSession().subscribe({
      next: (session) => {
        this.activeSessionId.set(session.id);
        this.sessionLoadedFor = session.id;
        writeStoredSessionId(session.id);
        this.beginTurn(session.id, text);
      },
      error: () => this.streamError.set('Could not start a new conversation.'),
    });
  }

  private beginTurn(sessionId: string, text: string): void {
    this.messages.update((list) => [
      ...list,
      {
        id: `local-${Date.now()}`,
        sessionId,
        role: 'user',
        content: text,
        pendingConfirmation: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    this.abortController = new AbortController();
    void this.consumeStream(
      this.assistant.sendMessage(sessionId, text, this.abortController.signal),
      sessionId,
      false,
    );
  }

  protected respondConfirmation(messageId: string, approve: boolean): void {
    const sessionId = this.activeSessionId();
    if (!sessionId || this.sending()) return;
    this.abortController = new AbortController();
    void this.consumeStream(
      this.assistant.confirmToolCall(sessionId, messageId, approve, this.abortController.signal),
      sessionId,
      approve,
    );
  }

  protected stopStreaming(): void {
    this.abortController?.abort();
  }

  private async consumeStream(
    events: AsyncGenerator<AssistantSseEvent>,
    sessionId: string,
    refreshCartAfter: boolean,
  ): Promise<void> {
    this.sending.set(true);
    this.streamError.set(null);
    this.streamingText.set('');
    try {
      for await (const event of events) {
        if (event.type === 'text') {
          this.streamingText.update((current) => (current ?? '') + event.delta);
        } else if (event.type === 'error') {
          this.streamError.set(event.message);
        }
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        this.streamError.set(error instanceof Error ? error.message : 'Something went wrong.');
      }
    } finally {
      this.sending.set(false);
      this.streamingText.set(null);
      this.loadMessages(sessionId);
      if (refreshCartAfter) {
        this.cart.refresh().subscribe({ error: () => undefined });
      }
    }
  }

  private loadMessages(sessionId: string): void {
    this.messagesLoading.set(true);
    this.sessionLoadedFor = sessionId;
    this.assistant.getMessages(sessionId).subscribe({
      next: (list) => {
        this.messages.set(list);
        this.messagesLoading.set(false);
      },
      error: () => this.messagesLoading.set(false),
    });
  }

  protected renderMarkdown(content: string | undefined): string {
    if (!content) return '';
    // Angular's [innerHTML] binding sanitizes automatically — this is
    // model-generated text, less trusted than the CMS body content
    // blog-post.ts/content-page.ts render the same way, so that default
    // sanitization is load-bearing here, not just incidental.
    return parse(content, { async: false, breaks: true, gfm: true });
  }

  protected describeToolCall(call: StoredToolCallDto): string {
    const args = call.args ?? {};
    const slug = typeof args['slug'] === 'string' ? args['slug'] : 'this item';
    const sku = typeof args['variantSku'] === 'string' ? ` (${args['variantSku']})` : '';
    switch (call.name) {
      case 'add_to_cart': {
        const quantity = typeof args['quantity'] === 'number' ? args['quantity'] : 1;
        return `Add ${quantity} × ${slug}${sku} to your cart`;
      }
      case 'update_cart_item': {
        const quantity = typeof args['quantity'] === 'number' ? args['quantity'] : 0;
        return quantity === 0
          ? `Remove ${slug}${sku} from your cart`
          : `Change ${slug}${sku} to quantity ${quantity}`;
      }
      case 'apply_coupon': {
        const code = typeof args['code'] === 'string' ? args['code'] : '';
        return `Apply coupon code "${code}"`;
      }
      default:
        return `Run ${call.name ?? 'an action'}`;
    }
  }

  protected productChipsFor(message: ChatMessageDto): ProductChip[] {
    const chips: ProductChip[] = [];
    for (const result of message.toolResults ?? []) {
      const response = result.response;
      if (!isRecord(response)) continue;

      const candidates: Record<string, unknown>[] = Array.isArray(response['products'])
        ? response['products'].filter(isRecord)
        : typeof response['slug'] === 'string'
          ? [response]
          : [];

      for (const candidate of candidates) {
        if (typeof candidate['slug'] !== 'string' || typeof candidate['name'] !== 'string')
          continue;
        const priceMinor =
          typeof candidate['basePriceMinor'] === 'number'
            ? candidate['basePriceMinor']
            : typeof candidate['priceMinor'] === 'number'
              ? candidate['priceMinor']
              : undefined;
        if (priceMinor === undefined) continue;

        chips.push({
          slug: candidate['slug'],
          name: candidate['name'],
          brand: typeof candidate['brand'] === 'string' ? candidate['brand'] : undefined,
          priceMinor,
          compareAtPriceMinor:
            typeof candidate['compareAtPriceMinor'] === 'number'
              ? candidate['compareAtPriceMinor']
              : undefined,
        });
      }
    }
    return chips;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readStoredSessionId(): string | null {
  try {
    return globalThis.localStorage?.getItem(SESSION_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeStoredSessionId(id: string | null): void {
  try {
    if (id === null) {
      globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
    } else {
      globalThis.localStorage?.setItem(SESSION_STORAGE_KEY, id);
    }
  } catch {
    // Storage unavailable — in-memory signal still works for this tab.
  }
}
