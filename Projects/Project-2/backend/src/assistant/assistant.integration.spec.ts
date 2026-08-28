import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GoogleGenAI } from '@google/genai';
import type { ClsService } from 'nestjs-cls';
import mongoose from 'mongoose';

import { MongoTestContext } from '../../test/support/mongo-memory-server';
import { getTestModel } from '../../test/support/test-model';
import { AssistantService } from './assistant.service';
import {
  ChatMessage,
  ChatMessageDocument,
  ChatMessageSchema,
} from './schemas/chat-message.schema';
import {
  ChatSession,
  ChatSessionDocument,
  ChatSessionSchema,
} from './schemas/chat-session.schema';
import type { AssistantTool, AssistantToolContext } from './tools';

// SCOPE.md Phase 8's security invariant: "every tool resolves user/
// session from CLS context, never from model input" and no user can
// reach another user's chat session. Two things get exercised here:
//   1. every AssistantService entry point that takes a sessionId also
//      takes the authenticated userId and enforces ownership;
//   2. a tool's execution context always carries the REAL caller's
//      userId, even when the model's own function-call args try to
//      supply a different one — proven with a stub Gemini client, since
//      no live API call is needed to demonstrate this.
async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of gen) items.push(item);
  return items;
}

class ContextProbeTool implements AssistantTool {
  readonly mutating = false;
  readonly declaration = {
    name: 'context_probe',
    description: 'test-only tool that records the ctx it executed with',
    parametersJsonSchema: { type: 'object', properties: {} },
  };
  lastCtx?: AssistantToolContext;
  lastArgs?: Record<string, unknown>;

  execute(
    args: Record<string, unknown>,
    ctx: AssistantToolContext,
  ): Promise<unknown> {
    this.lastCtx = ctx;
    this.lastArgs = args;
    return Promise.resolve({ ok: true });
  }
}

// Minimal structural stand-in for GoogleGenAI — only the
// models.generateContentStream surface AssistantService.runTurn
// actually calls. This is the same "framework typing gap" cast
// documented for cloudinary-storage.provider.ts and test-model.ts: no
// public type expresses "the subset of GoogleGenAI I stubbed."
function makeStubGeminiClient(
  chunksPerCall: { text?: string; functionCalls?: unknown[] }[][],
): GoogleGenAI {
  let call = 0;
  return {
    models: {
      generateContentStream: () => {
        const chunks = chunksPerCall[Math.min(call, chunksPerCall.length - 1)];
        call += 1;
        return Promise.resolve(
          (function* () {
            for (const chunk of chunks) yield chunk;
          })(),
        );
      },
    },
  } as unknown as GoogleGenAI;
}

const stubCls = { get: () => 'test-correlation-id' } as unknown as ClsService;

describe('AssistantService (integration)', () => {
  let ctx: MongoTestContext;
  let chatSessionModel: mongoose.Model<ChatSessionDocument>;
  let chatMessageModel: mongoose.Model<ChatMessageDocument>;
  const configService = new ConfigService({ GEMINI_MODEL: 'gemini-2.5-flash' });

  beforeAll(async () => {
    ctx = await MongoTestContext.start();
    chatSessionModel = getTestModel<ChatSessionDocument>(
      ChatSession.name,
      ChatSessionSchema,
    );
    chatMessageModel = getTestModel<ChatMessageDocument>(
      ChatMessage.name,
      ChatMessageSchema,
    );
  }, 120_000);

  afterEach(async () => {
    await ctx.reset();
  });

  afterAll(async () => {
    await ctx.stop();
  });

  function buildService(
    client: GoogleGenAI | undefined,
    tools: AssistantTool[] = [],
  ): AssistantService {
    return new AssistantService(
      client,
      chatSessionModel,
      chatMessageModel,
      tools,
      configService,
      stubCls,
    );
  }

  describe('session ownership', () => {
    it('findSessions only ever returns the calling user’s own sessions', async () => {
      const service = buildService(undefined);
      const ownerId = new mongoose.Types.ObjectId().toString();
      const otherId = new mongoose.Types.ObjectId().toString();
      await service.createSession(ownerId);
      await service.createSession(otherId);

      const found = await service.findSessions(ownerId);

      expect(found).toHaveLength(1);
      expect(found[0].userId.toString()).toBe(ownerId);
    });

    it('findMessages succeeds for the owning user', async () => {
      const service = buildService(undefined);
      const ownerId = new mongoose.Types.ObjectId().toString();
      const session = await service.createSession(ownerId);

      await expect(service.findMessages(session.id, ownerId)).resolves.toEqual(
        [],
      );
    });

    it('findMessages rejects a different authenticated user with 403, not 404', async () => {
      const service = buildService(undefined);
      const ownerId = new mongoose.Types.ObjectId().toString();
      const otherId = new mongoose.Types.ObjectId().toString();
      const session = await service.createSession(ownerId);

      await expect(service.findMessages(session.id, otherId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('findMessages 404s on a session id that does not exist at all', async () => {
      const service = buildService(undefined);
      const someUserId = new mongoose.Types.ObjectId().toString();
      const nonExistentSessionId = new mongoose.Types.ObjectId().toString();

      await expect(
        service.findMessages(nonExistentSessionId, someUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('sendMessage refuses a different user before writing anything or calling Gemini', async () => {
      const service = buildService(undefined); // no Gemini client wired — a call would throw distinctly if reached
      const ownerId = new mongoose.Types.ObjectId().toString();
      const otherId = new mongoose.Types.ObjectId().toString();
      const session = await service.createSession(ownerId);

      await expect(
        drain(service.sendMessage(session.id, otherId, 'hello')),
      ).rejects.toThrow(ForbiddenException);

      expect(
        await chatMessageModel.countDocuments({ sessionId: session._id }),
      ).toBe(0);
    });

    it('confirmToolCall refuses a different user', async () => {
      const service = buildService(undefined);
      const ownerId = new mongoose.Types.ObjectId().toString();
      const otherId = new mongoose.Types.ObjectId().toString();
      const session = await service.createSession(ownerId);
      const pending = await chatMessageModel.create({
        sessionId: session._id,
        role: 'assistant',
        toolCalls: [{ id: 'c1', name: 'add_to_cart', args: {} }],
        pendingConfirmation: true,
      });

      await expect(
        drain(service.confirmToolCall(session.id, pending.id, otherId, true)),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('tool execution context integrity', () => {
    it('always scopes a tool call to the authenticated caller, never to a model-supplied userId', async () => {
      const probe = new ContextProbeTool();
      const stubClient = makeStubGeminiClient([
        [
          {
            functionCalls: [
              {
                id: 'call-1',
                name: 'context_probe',
                args: { userId: 'attacker-supplied-id' },
              },
            ],
          },
        ],
        [{ text: 'All done.' }],
      ]);
      const service = buildService(stubClient, [probe]);
      const realUserId = new mongoose.Types.ObjectId().toString();
      const session = await service.createSession(realUserId);

      const events = await drain(
        service.sendMessage(session.id, realUserId, 'do the thing'),
      );

      expect(events.at(-1)).toEqual({ type: 'done' });
      // The tool actually ran (auto-executed — it's declared non-mutating).
      expect(probe.lastCtx).toBeDefined();
      // Scoped to the real, authenticated caller...
      expect(probe.lastCtx?.userId).toBe(realUserId);
      // ...never to whatever the model itself tried to pass as an arg.
      expect(probe.lastCtx?.userId).not.toBe('attacker-supplied-id');
      expect(probe.lastArgs?.userId).toBe('attacker-supplied-id');
    });
  });
});
