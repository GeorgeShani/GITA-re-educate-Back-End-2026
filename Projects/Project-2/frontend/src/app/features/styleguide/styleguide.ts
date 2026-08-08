import { Component } from '@angular/core';

/**
 * Dev-only component workshop. Guarded by devOnlyGuard so it never ships
 * in production (see app.routes.ts).
 *
 * Each Phase F1 primitive adds its own <section> here — every variant and
 * state, rendered through the real app shell so what's shown here is
 * exactly what ships. Nothing to show yet; this is the F0 scaffold.
 */
@Component({
  selector: 'styleguide-page',
  template: `
    <main>
      <h1>Style Guide</h1>
      <p>Dev-only. Components land here section by section as Phase F1 builds them.</p>
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
  `,
})
export class Styleguide {}
