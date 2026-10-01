import { SetMetadata } from '@nestjs/common';

export const DEMO_WRITES_CHECKED_KEY = 'demoWritesChecked';

/**
 * For a route that is a POST only because of its transport: the MCP endpoint carries reads and writes in one POST, so
 * `DemoReadOnlyGuard` cannot tell them apart by method. Marked with this, the guard steps aside and the handler must
 * refuse every write by a demo user itself (the MCP layer hides write tools from them and refuses a direct call).
 */
export const DemoWritesCheckedByHandler = () => SetMetadata(DEMO_WRITES_CHECKED_KEY, true);
