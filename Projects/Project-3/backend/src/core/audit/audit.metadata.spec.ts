import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { RequestContextService } from '../context/request-context.service.js';
import { AuditService } from './audit.service.js';

/**
 * The decorator-metadata canary. Vite 8's oxc transformer does emit
 * `emitDecoratorMetadata`, but which tsconfig drives it is path-dependent, so
 * a toolchain or config change can silently stop it. When that happens the
 * symptoms show up far from the cause — TypeORM "column type not defined",
 * class-validator doing nothing, Nest "can't resolve dependency at index N".
 *
 * If this fails, fix the compiler configuration. Do not debug the DI graph.
 */
describe('decorator metadata canary', () => {
  it('emits design:paramtypes for constructor injection', () => {
    const paramTypes: unknown = Reflect.getMetadata('design:paramtypes', AuditService);

    expect(Array.isArray(paramTypes)).toBe(true);
    // [Repository (explicit @InjectRepository token), RequestContextService]
    expect(paramTypes).toHaveLength(2);
    expect(Array.isArray(paramTypes) && paramTypes[1]).toBe(RequestContextService);
  });
});
