import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '#/common/auth/roles.decorator.js';
import { OffsetQueryDto } from '#/common/pagination/offset-query.dto.js';
import { mapPageData } from '#/common/pagination/paginate.js';
import { toDto } from '#/common/response/to-dto.js';
import { ApiKeysService } from './api-keys.service.js';
import { ApiKeyDto, ApiKeyPageDto, CreatedApiKeyDto } from './dto/api-key.dto.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';

/**
 * Personal API keys. Managed with a SESSION only: no route here declares `@RequireScopes`,
 * so a key can never mint, list or revoke keys (see `ScopesGuard`).
 */
@ApiTags('api-keys')
@ApiBearerAuth()
@Roles('admin', 'employee')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Post()
  @ApiCreatedResponse({ type: CreatedApiKeyDto })
  async create(@Body() dto: CreateApiKeyDto): Promise<CreatedApiKeyDto> {
    const { key, plaintext } = await this.keys.create(dto);
    return CreatedApiKeyDto.fromCreated(key, plaintext);
  }

  @Get()
  @ApiOkResponse({ type: ApiKeyPageDto })
  async list(@Query() query: OffsetQueryDto): Promise<ApiKeyPageDto> {
    return toDto(ApiKeyPageDto, mapPageData(await this.keys.list(query), ApiKeyDto.from));
  }

  @Delete(':id')
  @ApiOkResponse({ type: ApiKeyDto })
  async revoke(@Param('id', ParseUUIDPipe) id: string): Promise<ApiKeyDto> {
    return ApiKeyDto.from(await this.keys.revoke(id));
  }
}
