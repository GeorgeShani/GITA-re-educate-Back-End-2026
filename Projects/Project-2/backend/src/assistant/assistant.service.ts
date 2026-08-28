import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Content, FunctionCall, GoogleGenAI, Part } from '@google/genai';
import { Model, Types } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { GEMINI_CLIENT_TOKEN } from './gemini-client.provider';
import { ASSISTANT_SYSTEM_INSTRUCTION } from './system-instruction';
import { AssistantSseEvent } from './assistant-sse-event';
import {
  ChatMessage,
  ChatMessageDocument,
} from './schemas/chat-message.schema';
import {
  ChatSession,
  ChatSessionDocument,
} from './schemas/chat-session.schema';
import { ASSISTANT_TOOLS_TOKEN } from './tools';
import type { AssistantTool, AssistantToolContext } from './tools';

const TITLE_MAX_LENGTH = 60;
const MAX_TOOL_LOOP_DEPTH = 5;

// Index-signature'd so these stay freely assignable both ways against
// ChatMessage.toolCalls/toolResults' schema type (Record<string,
// unknown>[], Mixed) — writing one of these to Mongoose and reading one
// back both need to typecheck without a cast.
interface StoredToolCall {
  [key: string]: unknown;
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
}

interface StoredToolResult {
  [key: string]: unknown;
  id?: string;
  name?: string;
  response?: unknown;
}

// Source for every @google/genai call shape below:
// https://github.com/googleapis/js-genai (README) plus
// https://googleapis.github.io/js-genai/release_docs/ (Chat,
// GenerateContentResponse, FunctionCall, ThinkingConfig, Caches classes)
// — verified against the installed @google/genai@2.19.0 rather than
// trusted from memory, per SCOPE.md Phase 8's own warning that this is
// the fastest-moving surface in the stack.
//
// Deliberately uses the low-level ai.models.generateContentStream, not
// ai.chats.create/Chat.sendMessage — the Chat class's sendMessage takes
// a NEW user message and doesn't cleanly support "resume from a
// function response already appended to history" (the shape the
// confirmation gate needs), whereas generateContentStream's `contents`
// array already IS the full turn-by-turn history, so continuing after a
// tool result is just appending to that array and calling it again.
@Injectable()
export class AssistantService {
  private readonly model: string;
  private readonly toolByName = new Map<string, AssistantTool>();

  constructor(
    @Inject(GEMINI_CLIENT_TOKEN)
    private readonly client: GoogleGenAI | undefined,
    @InjectModel(ChatSession.name)
    private readonly chatSessionModel: Model<ChatSessionDocument>,
    @InjectModel(ChatMessage.name)
    private readonly chatMessageModel: Model<ChatMessageDocument>,
    @Inject(ASSISTANT_TOOLS_TOKEN) tools: AssistantTool[],
    private readonly configService: ConfigService,
    private readonly cls: ClsService,
  ) {
    this.model = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-2.5-flash',
    );
    for (const tool of tools) {
      this.toolByName.set(tool.declaration.name!, tool);
    }
  }

  async createSession(userId: string): Promise<ChatSessionDocument> {
    return this.chatSessionModel.create({ userId: new Types.ObjectId(userId) });
  }

  async findSessions(userId: string): Promise<ChatSessionDocument[]> {
    return this.chatSessionModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findMessages(
    sessionId: string,
    userId: string,
  ): Promise<ChatMessageDocument[]> {
    await this.findOwnedSession(sessionId, userId);
    return this.chatMessageModel
      .find({ sessionId: new Types.ObjectId(sessionId) })
      .sort({ createdAt: 1 })
      .exec();
  }

  async *sendMessage(
    sessionId: string,
    userId: string,
    text: string,
  ): AsyncGenerator<AssistantSseEvent> {
    const session = await this.findOwnedSession(sessionId, userId);

    if (!session.title) {
      session.title = text.slice(0, TITLE_MAX_LENGTH);
      await session.save();
    }

    await this.chatMessageModel.create({
      sessionId: session._id,
      role: 'user',
      content: text,
    });

    const contents = await this.rehydrate(session.id);
    const ctx: AssistantToolContext = {
      userId,
      correlationId: this.correlationId(),
    };
    yield* this.runTurn(session, contents, ctx, 0);
  }

  async *confirmToolCall(
    sessionId: string,
    messageId: string,
    userId: string,
    approve: boolean,
  ): AsyncGenerator<AssistantSseEvent> {
    const session = await this.findOwnedSession(sessionId, userId);
    const pending = await this.chatMessageModel.findOne({
      _id: messageId,
      sessionId: session._id,
      pendingConfirmation: true,
    });
    if (!pending) {
      throw new NotFoundException(
        `No pending confirmation ${messageId} on this session`,
      );
    }

    const calls = (pending.toolCalls ?? []) as StoredToolCall[];
    const ctx: AssistantToolContext = {
      userId,
      correlationId: this.correlationId(),
    };

    const results: StoredToolResult[] = approve
      ? await Promise.all(
          calls.map((call) => this.executeStoredCall(call, ctx)),
        )
      : calls.map((call) => ({
          id: call.id,
          name: call.name,
          response: { error: 'The user declined this action.' },
        }));

    pending.pendingConfirmation = false;
    await pending.save();

    await this.chatMessageModel.create({
      sessionId: session._id,
      role: 'tool',
      toolResults: results,
    });

    const contents = await this.rehydrate(session.id);
    yield* this.runTurn(session, contents, ctx, 0);
  }

  private async *runTurn(
    session: ChatSessionDocument,
    contents: Content[],
    ctx: AssistantToolContext,
    depth: number,
  ): AsyncGenerator<AssistantSseEvent> {
    if (!this.client) {
      yield {
        type: 'error',
        message: 'The assistant is not configured (GEMINI_API_KEY missing).',
      };
      return;
    }
    if (depth > MAX_TOOL_LOOP_DEPTH) {
      yield { type: 'error', message: 'Too many tool calls in a single turn.' };
      return;
    }

    const stream = await this.client.models.generateContentStream({
      model: this.model,
      contents,
      config: {
        systemInstruction: ASSISTANT_SYSTEM_INSTRUCTION,
        tools: [
          {
            functionDeclarations: [...this.toolByName.values()].map(
              (tool) => tool.declaration,
            ),
          },
        ],
        thinkingConfig: { thinkingBudget: -1 }, // AUTOMATIC
      },
    });

    let text = '';
    const callsById = new Map<string, FunctionCall>();
    for await (const chunk of stream) {
      if (chunk.text) {
        text += chunk.text;
        yield { type: 'text', delta: chunk.text };
      }
      for (const call of chunk.functionCalls ?? []) {
        callsById.set(call.id ?? call.name ?? Math.random().toString(), call);
      }
    }

    const calls = [...callsById.values()];
    if (calls.length === 0) {
      await this.chatMessageModel.create({
        sessionId: session._id,
        role: 'assistant',
        content: text,
      });
      yield { type: 'done' };
      return;
    }

    const mutatingCalls = calls.filter(
      (call) => this.toolByName.get(call.name ?? '')?.mutating,
    );
    const assistantMessage = await this.chatMessageModel.create({
      sessionId: session._id,
      role: 'assistant',
      content: text || undefined,
      toolCalls: calls.map((call) => ({
        id: call.id,
        name: call.name,
        args: call.args,
      })),
      pendingConfirmation: mutatingCalls.length > 0,
    });

    if (mutatingCalls.length > 0) {
      yield {
        type: 'confirmation_required',
        messageId: assistantMessage.id,
        toolCalls: mutatingCalls.map((call) => ({
          name: call.name ?? '',
          args: call.args ?? {},
        })),
      };
      return;
    }

    // Every call this turn was read-only — execute now and loop so the
    // model can use the results to finish answering.
    const results = await Promise.all(
      calls.map((call) =>
        this.executeStoredCall(
          { id: call.id, name: call.name, args: call.args },
          ctx,
        ),
      ),
    );
    await this.chatMessageModel.create({
      sessionId: session._id,
      role: 'tool',
      toolResults: results,
    });

    const modelParts: Part[] = calls.map((call) => ({ functionCall: call }));
    const responseParts: Part[] = results.map((result) => ({
      functionResponse: {
        id: result.id,
        name: result.name,
        response: (result.response ?? {}) as Record<string, unknown>,
      },
    }));

    yield* this.runTurn(
      session,
      [
        ...contents,
        { role: 'model', parts: modelParts },
        { role: 'user', parts: responseParts },
      ],
      ctx,
      depth + 1,
    );
  }

  private async executeStoredCall(
    call: StoredToolCall,
    ctx: AssistantToolContext,
  ): Promise<StoredToolResult> {
    const tool = call.name ? this.toolByName.get(call.name) : undefined;
    if (!tool) {
      return {
        id: call.id,
        name: call.name,
        response: { error: `Unknown tool "${call.name}"` },
      };
    }
    try {
      const response = await tool.execute(call.args ?? {}, ctx);
      return { id: call.id, name: call.name, response };
    } catch (error) {
      return {
        id: call.id,
        name: call.name,
        response: {
          error:
            error instanceof Error ? error.message : 'Tool execution failed',
        },
      };
    }
  }

  /** Our own ChatMessage history, in Gemini's Content[] shape — see the class comment for why this replaces Chat/history rather than using ai.chats.create. */
  private async rehydrate(sessionId: string): Promise<Content[]> {
    const messages = await this.chatMessageModel
      .find({ sessionId: new Types.ObjectId(sessionId) })
      .sort({ createdAt: 1 })
      .exec();

    const contents: Content[] = [];
    for (const message of messages) {
      if (message.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: message.content ?? '' }],
        });
      } else if (message.role === 'assistant') {
        const parts: Part[] = [];
        if (message.content) parts.push({ text: message.content });
        for (const call of (message.toolCalls ?? []) as StoredToolCall[]) {
          parts.push({ functionCall: call });
        }
        if (parts.length > 0) contents.push({ role: 'model', parts });
      } else {
        const parts: Part[] = (
          (message.toolResults ?? []) as StoredToolResult[]
        ).map((result) => ({
          functionResponse: {
            id: result.id,
            name: result.name,
            response: (result.response ?? {}) as Record<string, unknown>,
          },
        }));
        if (parts.length > 0) contents.push({ role: 'user', parts });
      }
    }
    return contents;
  }

  private async findOwnedSession(
    sessionId: string,
    userId: string,
  ): Promise<ChatSessionDocument> {
    const session = await this.chatSessionModel.findById(sessionId).exec();
    if (!session) {
      throw new NotFoundException(`Chat session ${sessionId} not found`);
    }
    // 403, not 404 — unlike orders/returns' ownership convention, there's
    // no enumeration risk worth hiding here (chat session ids are never
    // shared/guessed against in a UI flow), and a 403 is more honest
    // about what actually happened.
    if (session.userId.toString() !== userId) {
      throw new ForbiddenException('This chat session belongs to another user');
    }
    return session;
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
