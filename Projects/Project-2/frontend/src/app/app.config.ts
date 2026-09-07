import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
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
      withViewTransitions(),
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
