import { NgOptimizedImage } from '@angular/common';
import { Component, input } from '@angular/core';

/**
 * Neutral background shows while there's no src (loading/empty state);
 * mix-blend-multiply on the <img> once one lands blends product photos
 * (typically shot on white) naturally into that background instead of
 * showing a hard white box edge. The `blurhash` slot is a projection
 * point for a decoded blurhash placeholder — decoding itself isn't built
 * yet, this just reserves where it goes.
 */
@Component({
  selector: 'image-placeholder',
  imports: [NgOptimizedImage],
  host: {
    '[style.aspect-ratio]': "width() + ' / ' + height()",
  },
  template: `
    <ng-content select="[blurhash]" />
    @if (src(); as source) {
      <img
        [ngSrc]="source"
        [alt]="alt()"
        [width]="width()"
        [height]="height()"
        [priority]="priority()"
      />
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      background: var(--color-neutral-02);
      overflow: hidden;
    }

    // @starting-style rather than a [reveal]-style opacity:0 default: the
    // "current" state below is opacity: 1 (never hidden), so an SSR-
    // rendered <img> already in the initial HTML parse — the common case,
    // most product-card grids resolve their data server-side — just
    // paints normally with no flash. @starting-style only supplies a
    // "from" frame for an element the browser sees freshly inserted into
    // the render tree (a lazy panel, a swapped src after a filter/color
    // change, a client-only fetch), which is exactly the case that
    // actually benefits from a fade-in, and needs zero JS to do it.
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      mix-blend-mode: multiply;
      opacity: 1;
      transition: opacity var(--duration-base) var(--ease-out);

      @starting-style {
        opacity: 0;
      }
    }
  `,
})
export class ImagePlaceholder {
  readonly src = input<string>();
  readonly alt = input.required<string>();
  readonly width = input.required<number>();
  readonly height = input.required<number>();
  readonly priority = input(false);
}
