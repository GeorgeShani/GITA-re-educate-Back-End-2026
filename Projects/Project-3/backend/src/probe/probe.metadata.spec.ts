import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { RequestContextService } from '../core/context/request-context.service.js';
import { ProbeQueryDto } from './probe.dto.js';
import { ProbeService } from './probe.service.js';

/**
 * THE CANARY.
 *
 * Everything in this app that works by reflection — TypeORM's `@Column()` type
 * inference, class-validator's DTO rules, Nest's entire constructor-injection
 * mechanism — depends on `emitDecoratorMetadata` surviving whatever compiles the
 * code. Vitest 4 runs on Vite 8, which transforms via rolldown/oxc rather than
 * tsc, and oxc emits this metadata only when it can resolve the *nearest*
 * `tsconfig.json` to the file.
 *
 * That makes it path-dependent, so it can break from a toolchain bump or a
 * stray nested tsconfig without anyone touching application code. When it does
 * break, the symptom is Nest failing to resolve a dependency "at index 0" or
 * TypeORM claiming a column type is undefined — hours of debugging pointed at
 * entirely the wrong layer.
 *
 * If this spec fails, stop and fix the compiler configuration. Do not debug the
 * DI graph.
 */
describe('decorator metadata (toolchain canary)', () => {
  it('emits design:paramtypes for injectable constructors', () => {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      ProbeService,
    ) as unknown[] | undefined;

    expect(paramTypes).toBeDefined();
    expect(paramTypes).toEqual([RequestContextService]);
  });

  it('emits design:type for decorated properties', () => {
    const propertyType = Reflect.getMetadata(
      'design:type',
      ProbeQueryDto.prototype,
      'n',
    ) as unknown;

    expect(propertyType).toBe(Number);
  });
});
