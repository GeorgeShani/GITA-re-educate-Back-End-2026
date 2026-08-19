import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IconSprite } from '@/app/shared/ui/icon-sprite';
import { SkipLink } from '@/app/shared/ui/skip-link';
import { ToastStack } from '@/app/shared/ui/toast-stack';

/**
 * Minimal shell — the composed navbar/footer/homepage were demolished
 * (four rounds of Figma-fidelity work that didn't converge; see the
 * reset-and-re-platform plan). What's left is genuinely reusable
 * regardless of what replaces them: the icon sprite, toast stack, and
 * skip link are cross-cutting infrastructure, not page composition.
 */
@Component({
  selector: 'store-root',
  imports: [RouterOutlet, IconSprite, ToastStack, SkipLink],
  template: `
    <icon-sprite />
    <toast-stack />
    <skip-link />
    <main id="main-content">
      <router-outlet />
    </main>
  `,
})
export class App {}
