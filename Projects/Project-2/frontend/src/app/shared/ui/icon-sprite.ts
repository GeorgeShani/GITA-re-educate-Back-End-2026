import { Component } from '@angular/core';

/**
 * Mounted once at the app root (see app.html). Holds every icon as an
 * inline <symbol> so icon-glyph's <use href="#name"> resolves same-
 * document — an externally-fetched sprite file doesn't reliably let
 * currentColor cascade into the referenced symbol across browsers, which
 * matters here since icons must pick up whatever color their context sets.
 *
 * Placeholder icon set: simple, hand-authored geometric shapes, not yet
 * pulled from the Figma icon library. Add/replace symbols here as real
 * assets are exported.
 */
@Component({
  selector: 'icon-sprite',
  template: `
    <svg xmlns="http://www.w3.org/2000/svg">
      <symbol id="star" viewBox="0 0 24 24">
        <path
          d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 7.1-1.01z"
        />
      </symbol>
      <symbol id="chevron-down" viewBox="0 0 24 24">
        <path
          d="M6 9l6 6 6-6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </symbol>
      <symbol id="close" viewBox="0 0 24 24">
        <path
          d="M6 6l12 12M18 6L6 18"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </symbol>
      <symbol id="search" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
        <line
          x1="21"
          y1="21"
          x2="16.65"
          y2="16.65"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </symbol>
      <symbol id="heart" viewBox="0 0 24 24">
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </symbol>
      <symbol id="cart" viewBox="0 0 24 24">
        <path d="M6 8V6a6 6 0 1112 0v2" fill="none" stroke="currentColor" stroke-width="2" />
        <path
          d="M4 8h16l-1.5 12.5a2 2 0 01-2 1.5H7.5a2 2 0 01-2-1.5L4 8z"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        />
      </symbol>
      <symbol id="user" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2" />
        <path
          d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </symbol>
      <symbol id="check" viewBox="0 0 24 24">
        <path
          d="M5 13l4 4L19 7"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </symbol>
      <symbol id="plus" viewBox="0 0 24 24">
        <path
          d="M12 5v14M5 12h14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </symbol>
      <symbol id="minus" viewBox="0 0 24 24">
        <path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </symbol>
      <symbol id="chevron-right" viewBox="0 0 24 24">
        <path
          d="M9 6l6 6-6 6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </symbol>
    </svg>
  `,
  styles: `
    :host {
      display: none;
    }
  `,
})
export class IconSprite {}
