import { Service, inject, signal } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';

export type ToastVariant = 'info' | 'success' | 'error';

export interface ToastMessage {
  readonly id: number;
  readonly text: string;
  readonly variant: ToastVariant;
  /** True for one frame pair after insertion — see the double-rAF note in show(). */
  readonly entering: boolean;
  /** True once dismiss() is called; toast-stack removes the item once its exit transition finishes. */
  readonly leaving: boolean;
}

/** Call `inject(ToastService).show(...)` from anywhere — toast-stack (mounted once at the app root) renders whatever's in `toasts()`. */
@Service()
export class ToastService {
  private readonly liveAnnouncer = inject(LiveAnnouncer);

  private readonly _toasts = signal<ToastMessage[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private nextId = 0;

  show(text: string, variant: ToastVariant = 'info', duration = 4000): void {
    const id = this.nextId++;
    this._toasts.update((list) => [
      ...list,
      { id, text, variant, entering: true, leaving: false },
    ]);
    void this.liveAnnouncer.announce(text, variant === 'error' ? 'assertive' : 'polite');

    if (typeof window === 'undefined') return;

    // Double rAF: a newly-inserted element has no "before" frame to
    // transition from on its own, so it renders once in the entering
    // (off) state, then this flips it to the settled (on) state after a
    // guaranteed paint — same problem the reveal directive solves with
    // afterNextRender, just via rAF since ToastService has no render hook.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._toasts.update((list) =>
          list.map((toast) => (toast.id === id ? { ...toast, entering: false } : toast)),
        );
      });
    });

    setTimeout(() => this.dismiss(id), duration);
  }

  /** Starts the exit transition; toast-stack's (transitionend) handler calls remove() once it finishes. */
  dismiss(id: number): void {
    this._toasts.update((list) =>
      list.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)),
    );
  }

  remove(id: number): void {
    this._toasts.update((list) => list.filter((toast) => toast.id !== id));
  }
}
