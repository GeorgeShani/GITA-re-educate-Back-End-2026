import { Service, signal } from '@angular/core';

/**
 * Just the open/closed flag, shared between site-header's launcher button
 * and the globally-mounted <assistant-panel> in app.ts (they aren't
 * parent/child, so this is simpler than an @Output threaded through app.ts).
 */
@Service()
export class AssistantPanelState {
  private readonly _open = signal(false);
  readonly open = this._open.asReadonly();

  toggle(): void {
    this._open.update((value) => !value);
  }

  close(): void {
    this._open.set(false);
  }
}
