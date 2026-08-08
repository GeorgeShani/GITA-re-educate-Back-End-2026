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
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
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
    // as of v22. Interceptors (auth/error/correlation-id) land in Phase F3
    // once the data layer exists: provideHttpClient(withInterceptors([...])).
    provideHttpClient(),
  ],
};
