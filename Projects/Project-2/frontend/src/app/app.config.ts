import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
  type ActivatedRouteSnapshot,
} from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions,
} from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { IMAGE_LOADER, type ImageLoaderConfig } from '@angular/common';

import { routes } from './app.routes';
import { authInterceptor } from '@/app/core/interceptors/auth.interceptor';
import { correlationIdInterceptor } from '@/app/core/interceptors/correlation-id.interceptor';
import { errorInterceptor } from '@/app/core/interceptors/error.interceptor';

/**
 * Rewrites a Cloudinary delivery URL to request the requested width at
 * f_auto,q_auto — format and quality negotiated per browser, so there is no
 * responsive ladder to generate or store (SCOPE.md A9's Cloudinary
 * decision). Anything not on res.cloudinary.com (the local site images
 * under /images, or a URL missing mid-build) passes through untouched.
 */
/**
 * The path a route snapshot resolves to, ignoring query params and
 * fragment — walks the primary-outlet chain from the root, concatenating
 * each node's own URL segments. Query params live outside `.url` entirely
 * (they're on `.queryParams`, shared by the whole tree), so this
 * comparison naturally ignores them.
 */
function routePath(snapshot: ActivatedRouteSnapshot): string {
  let path = '';
  let node: ActivatedRouteSnapshot | null = snapshot;
  while (node) {
    const segment = node.url.map((s) => s.path).join('/');
    if (segment) path += `/${segment}`;
    node = node.firstChild;
  }
  return path;
}

function cloudinaryImageLoader(config: ImageLoaderConfig): string {
  const marker = '/image/upload/';
  const splitAt = config.src.indexOf(marker);
  if (!config.src.includes('res.cloudinary.com') || splitAt === -1) {
    return config.src;
  }
  const head = config.src.slice(0, splitAt + marker.length);
  const tail = config.src.slice(splitAt + marker.length);
  const width = config.width ? `,w_${config.width}` : '';
  return `${head}f_auto,q_auto${width}/${tail}`;
}

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: IMAGE_LOADER, useValue: cloudinaryImageLoader },
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withViewTransitions({
        // Disables the transition on the very first navigation (app
        // bootstrap) — nothing to cross-fade from yet.
        skipInitialTransition: true,
        // shop.ts's filter/sort/page controls (and anything else that
        // calls router.navigate([], { queryParams })) re-resolve the SAME
        // route with a different query string. Without this check that
        // already cross-fades the whole document on every filter click
        // today — confirmed live — because withViewTransitions() has no
        // way to know "same page, new filter" from "new page" on its own.
        // Real route changes (different path) still get the transition.
        onViewTransitionCreated: ({ transition, from, to }) => {
          if (routePath(from) === routePath(to)) {
            transition.skipTransition();
          }
        },
      }),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withComponentInputBinding(),
    ),
    // Incremental hydration is on by default as of v22 — withIncrementalHydration()
    // is deprecated, don't add it back. withEventReplay() captures clicks/inputs
    // that happen before hydration finishes and replays them once it does, which
    // is what actually protects perceived responsiveness on a slow connection.
    provideClientHydration(
      withEventReplay(),
      withHttpTransferCacheOptions({ includePostRequests: false }),
    ),
    // withFetch() is deprecated too — FetchBackend is the default HttpBackend
    // as of v22.
    provideHttpClient(
      withInterceptors([correlationIdInterceptor, authInterceptor, errorInterceptor]),
    ),
  ],
};
