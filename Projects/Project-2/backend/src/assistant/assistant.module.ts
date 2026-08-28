import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { CartModule } from '@/cart/cart.module';
import { CatalogModule } from '@/catalog/catalog.module';
import { InventoryModule } from '@/inventory/inventory.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import {
  createGeminiClient,
  GEMINI_CLIENT_TOKEN,
} from './gemini-client.provider';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { ChatSession, ChatSessionSchema } from './schemas/chat-session.schema';
import { ASSISTANT_TOOL_PROVIDERS, ASSISTANT_TOOLS_TOKEN } from './tools';
import type { AssistantTool } from './tools';

@Module({
  imports: [
    CartModule,
    CatalogModule,
    InventoryModule,
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
  ],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    ...ASSISTANT_TOOL_PROVIDERS,
    {
      provide: ASSISTANT_TOOLS_TOKEN,
      inject: ASSISTANT_TOOL_PROVIDERS,
      useFactory: (...tools: AssistantTool[]) => tools,
    },
    {
      // Only constructed when GEMINI_API_KEY is set, same conditional
      // shape as STRIPE_CLIENT_TOKEN/RESEND_CLIENT_TOKEN — a dev/test
      // boot never needs a real Gemini key.
      provide: GEMINI_CLIENT_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createGeminiClient(configService.get<string>('GEMINI_API_KEY')),
    },
  ],
})
export class AssistantModule {}
