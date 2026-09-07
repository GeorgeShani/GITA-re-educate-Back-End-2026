import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';

import { API_BASE_URL } from '@/app/core/services/api-client';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

/**
 * On the server, "/api/v1" means nothing — there is no page origin to
 * resolve a relative URL against, so a fetch with one hangs until it is
 * aborted. The browser's dev proxy has no equivalent here either, so SSR
 * talks to the API directly and therefore needs an absolute origin.
 *
 * API_ORIGIN is read from the environment so a deployed SSR service can
 * point at the internal API address rather than the public one.
 */
const apiOrigin = process.env['API_ORIGIN'] ?? 'http://localhost:3000';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: API_BASE_URL, useValue: `${apiOrigin}/api/v1` },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
