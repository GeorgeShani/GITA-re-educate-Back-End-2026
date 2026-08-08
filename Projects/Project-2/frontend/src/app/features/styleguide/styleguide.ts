import { Component } from '@angular/core';

import { RevealDirective } from '@/app/shared/directives/reveal.directive';

/**
 * Dev-only component workshop. Guarded by devOnlyGuard so it never ships
 * in production (see app.routes.ts).
 *
 * Each Phase F1 primitive adds its own <section> here — every variant and
 * state, rendered through the real app shell so what's shown here is
 * exactly what ships. The Motion section is the exception: it proves the
 * [reveal] directive itself (plain viewport reveal + stagger), ahead of
 * any component that will actually consume it.
 */
@Component({
  selector: 'styleguide-page',
  imports: [RevealDirective],
  template: `
    <main>
      <h1>Style Guide</h1>
      <p>Dev-only. Components land here section by section as Phase F1 builds them.</p>

      <section class="motion-demo">
        <h2>Motion — reveal directive</h2>
        <p>
          Scroll down. The single box reveals on its own; the grid below staggers in tile by
          tile.
        </p>

        <div class="motion-demo__spacer" aria-hidden="true"></div>

        <div class="motion-demo__single" reveal>Reveals alone on scroll</div>

        <div class="motion-demo__grid">
          @for (tile of revealDemoTiles; track tile; let i = $index) {
            <div class="motion-demo__tile" reveal [revealIndex]="i" [revealStagger]="60">
              {{ tile }}
            </div>
          }
        </div>
      </section>
    </main>
  `,
  styles: `
    @use 'styles/typography' as type;

    main {
      max-width: var(--container-max);
      margin-inline: auto;
      padding: var(--space-8) var(--page-padding);
    }

    h1 {
      @include type.headline-4;
      margin-bottom: var(--space-3);
    }

    p {
      @include type.body-2;
      color: var(--color-neutral-04);
    }

    .motion-demo {
      margin-top: var(--space-10);
    }

    .motion-demo h2 {
      @include type.headline-5;
      margin-bottom: var(--space-2);
    }

    .motion-demo__spacer {
      block-size: 60vh;
    }

    .motion-demo__single,
    .motion-demo__tile {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-neutral-02);
      border-radius: var(--radius-md);
      color: var(--color-neutral-05);
      @include type.body-2;
    }

    .motion-demo__single {
      block-size: 96px;
      margin-block-end: var(--space-6);
    }

    .motion-demo__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: var(--space-4);
      margin-block-end: var(--space-10);
    }

    .motion-demo__tile {
      block-size: 100px;
    }
  `,
})
export class Styleguide {
  protected readonly revealDemoTiles = [1, 2, 3, 4, 5, 6];
}
