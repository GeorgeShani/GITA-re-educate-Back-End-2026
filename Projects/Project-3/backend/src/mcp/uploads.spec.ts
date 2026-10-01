import 'reflect-metadata';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { MAX_MCP_UPLOAD_BYTES, incomingFrom } from './uploads.js';

describe('incomingFrom', () => {
  it('makes an upload from text, as UTF-8 bytes', () => {
    const incoming = incomingFrom({ name: 'ანგარიში.csv', text: 'id,სახელი\n1,ა\n' });
    expect(incoming.name).toBe('ანგარიში.csv');
    expect(incoming.buffer.toString('utf8')).toBe('id,სახელი\n1,ა\n');
    expect(incoming.size).toBe(incoming.buffer.length);
  });

  it('makes an upload from base64, ignoring line breaks', () => {
    const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00]);
    const encoded = bytes.toString('base64');
    const wrapped = `${encoded.slice(0, 4)}\n${encoded.slice(4)}`;
    expect(incomingFrom({ name: 'a.xlsx', base64: wrapped }).buffer.equals(bytes)).toBe(true);
  });

  it('wants exactly one of text and base64', () => {
    expect(() => incomingFrom({ name: 'a.csv' })).toThrow(BadRequestException);
    expect(() => incomingFrom({ name: 'a.csv', text: 'x', base64: 'eA==' })).toThrow(BadRequestException);
  });

  it('rejects base64 that is not base64, and an empty file', () => {
    expect(() => incomingFrom({ name: 'a.csv', base64: 'not base64!' })).toThrow(/base64/);
    expect(() => incomingFrom({ name: 'a.csv', base64: 'A' })).toThrow(/base64/);
    expect(() => incomingFrom({ name: 'a.csv', text: '' })).toThrow(/empty/);
  });

  it('stops at the size limit, in bytes of the decoded file', () => {
    const atLimit = Buffer.alloc(MAX_MCP_UPLOAD_BYTES, 0x61);
    expect(incomingFrom({ name: 'a.csv', base64: atLimit.toString('base64') }).size).toBe(MAX_MCP_UPLOAD_BYTES);
    const over = Buffer.alloc(MAX_MCP_UPLOAD_BYTES + 1, 0x61);
    expect(() => incomingFrom({ name: 'a.csv', base64: over.toString('base64') })).toThrow(PayloadTooLargeException);
  });
});
