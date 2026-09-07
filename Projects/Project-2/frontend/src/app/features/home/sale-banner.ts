import { NgOptimizedImage } from '@angular/common';
import { Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ActionButton } from '@/app/shared/ui/action-button';

interface CountdownParts {
  readonly days: string;
  readonly hours: string;
  readonly minutes: string;
  readonly seconds: string;
}

const ZERO: CountdownParts = { days: '00', hours: '00', minutes: '00', seconds: '00' };
const SALE_WINDOW_MS = 1000 * 60 * 60 * 24 * 7; // a rolling 7-day window — there's no real sale-end date from the API yet

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function partsUntil(endsAt: number): CountdownParts {
  const remaining = Math.max(0, endsAt - Date.now());
  return {
    days: pad(Math.floor(remaining / 86_400_000)),
    hours: pad(Math.floor((remaining % 86_400_000) / 3_600_000)),
    minutes: pad(Math.floor((remaining % 3_600_000) / 60_000)),
    seconds: pad(Math.floor((remaining % 60_000) / 1_000)),
  };
}

/**
 * The countdown starts at 00:00:00:00 and only becomes real numbers once
 * `afterNextRender` fires — i.e. in the browser, after hydration. Computing
 * `Date.now()` during the constructor would bake a "now" into the prerendered
 * HTML that's already stale by the time a real visitor's browser hydrates it,
 * so this deliberately starts inert on the server rather than SSR-ing a
 * countdown that immediately jumps on the client.
 */
@Component({
  selector: 'sale-banner',
  imports: [RouterLink, NgOptimizedImage, ActionButton],
  template: `
    <div class="banner">
      <div class="banner-image">
        <img ngSrc="/images/products/sale-banner.jpg" alt="" fill priority="false" />
      </div>
      <div class="banner-content">
        <p class="eyebrow">Limited edition</p>
        <h2>Hurry up! 30% off</h2>
        <p class="subhead">Find clubs that are right for your game</p>

        <div class="timer">
          <p class="timer-label">Offer expires in:</p>
          <div class="timer-cells">
            @for (cell of cells(); track cell.label) {
              <div class="timer-cell">
                <span class="timer-value" data-numeric>{{ cell.value }}</span>
                <span class="timer-unit">{{ cell.label }}</span>
              </div>
            }
          </div>
        </div>

        <action-button variant="accent" routerLink="/shop">Shop now</action-button>
      </div>
    </div>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    :host {
      display: block;
    }

    .banner {
      display: grid;
      grid-template-columns: 1fr;
      min-height: 420px;

      @include bp.tablet-up {
        grid-template-columns: 1fr 1fr;
        min-height: 480px;
      }
    }

    .banner-image {
      position: relative;
      display: none;

      img {
        object-fit: cover;
      }

      @include bp.tablet-up {
        display: block;
      }
    }

    .banner-content {
      display: flex;
      flex-direction: column;
      align-items: start;
      gap: var(--space-6);
      padding: var(--space-8) var(--space-6);
      background: var(--color-neutral-07);
      color: var(--color-neutral-01);

      @include bp.tablet-up {
        padding: var(--space-10) calc(var(--space-10) * 2) var(--space-10) var(--space-10);
        justify-content: center;
      }
    }

    .eyebrow {
      @include type.hairline-1;
      color: var(--color-success);
    }

    h2 {
      @include type.headline-5;
      margin: 0;
      color: var(--color-neutral-01);

      @include bp.tablet-up {
        @include type.headline-4;
      }
    }

    .subhead {
      @include type.body-1;
      max-width: 40ch;
      margin: 0;
      color: color-mix(in srgb, var(--color-neutral-01) 88%, transparent);
    }

    .timer {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .timer-label {
      @include type.body-2;
      margin: 0;
      color: color-mix(in srgb, var(--color-neutral-01) 82%, transparent);
    }

    .timer-cells {
      display: flex;
      gap: var(--space-4);
    }

    .timer-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
    }

    .timer-value {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: var(--radius-md);
      background: var(--color-neutral-01);
      color: var(--color-neutral-07);
      font-family: var(--font-poppins);
      font-size: 24px;
      font-weight: 500;

      @include bp.tablet-up {
        width: 60px;
        height: 60px;
        font-size: 28px;
      }
    }

    .timer-unit {
      @include type.caption-2;
      color: color-mix(in srgb, var(--color-neutral-01) 78%, transparent);
    }
  `,
})
export class SaleBanner {
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cells = signal([
    { label: 'Days', value: ZERO.days },
    { label: 'Hours', value: ZERO.hours },
    { label: 'Minutes', value: ZERO.minutes },
    { label: 'Seconds', value: ZERO.seconds },
  ]);

  constructor() {
    afterNextRender(() => {
      const endsAt = Date.now() + SALE_WINDOW_MS;
      const tick = () => {
        const p = partsUntil(endsAt);
        this.cells.set([
          { label: 'Days', value: p.days },
          { label: 'Hours', value: p.hours },
          { label: 'Minutes', value: p.minutes },
          { label: 'Seconds', value: p.seconds },
        ]);
      };
      tick();
      const id = setInterval(tick, 1000);
      this.destroyRef.onDestroy(() => clearInterval(id));
    });
  }
}
