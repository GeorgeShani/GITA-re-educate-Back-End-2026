// Decorator metadata is read at import time by TypeORM entities and
// class-validator DTOs. Nest's own entrypoints import this for us; a spec that
// imports an entity or DTO directly does not, and the failure mode is an empty
// `design:paramtypes` rather than an error — see the canary spec in
// src/probe/probe.metadata.spec.ts.
import 'reflect-metadata';
