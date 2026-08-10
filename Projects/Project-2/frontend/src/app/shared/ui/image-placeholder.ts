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
      <img [ngSrc]="source" [alt]="alt()" [width]="width()" [height]="height()" [priority]="priority()" />
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      background: var(--color-neutral-02);
      overflow: hidden;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      mix-blend-mode: multiply;
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
