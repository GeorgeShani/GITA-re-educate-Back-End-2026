import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Observable } from 'rxjs';

import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AssistantService } from './assistant.service';
import { ConfirmToolCallDto } from './dto/confirm-tool-call.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { toSseObservable } from './to-sse-observable.util';

// Every route resolves the caller from the JWT, never from the request
// body or a route param — SCOPE.md Phase 8's security invariant (a tool
// call, and every session/message lookup here, only ever runs as the
// authenticated caller).
@ApiTags('assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assistant/sessions')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get()
  @ApiOperation({ summary: "The current user's chat sessions" })
  findSessions(@CurrentUser('userId') userId: string) {
    return this.assistantService.findSessions(userId);
  }

  @Throttle(WRITE_THROTTLE)
  @Post()
  @ApiOperation({ summary: 'Start a new chat session' })
  createSession(@CurrentUser('userId') userId: string) {
    return this.assistantService.createSession(userId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Full transcript of one session' })
  findMessages(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.assistantService.findMessages(id, userId);
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/messages')
  @Sse()
  @ApiOperation({
    summary:
      'Send a message and stream the reply — text deltas, then either "done" or "confirmation_required"',
  })
  sendMessage(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser('userId') userId: string,
  ): Observable<MessageEvent> {
    return toSseObservable(
      this.assistantService.sendMessage(id, userId, dto.message),
    );
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/messages/:messageId/confirm')
  @Sse()
  @ApiOperation({
    summary:
      'Approve or decline a pending mutating tool call and stream the continuation',
  })
  confirmToolCall(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('messageId', ParseObjectIdPipe) messageId: string,
    @Body() dto: ConfirmToolCallDto,
    @CurrentUser('userId') userId: string,
  ): Observable<MessageEvent> {
    return toSseObservable(
      this.assistantService.confirmToolCall(id, messageId, userId, dto.approve),
    );
  }
}
