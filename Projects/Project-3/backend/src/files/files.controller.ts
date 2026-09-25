import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { RequireScopes } from '#/common/auth/require-scopes.decorator.js';
import { Roles } from '#/common/auth/roles.decorator.js';
import { OffsetQueryDto } from '#/common/pagination/offset-query.dto.js';
import { mapPageData } from '#/common/pagination/paginate.js';
import { MessageResponseDto } from '#/common/response/message-response.dto.js';
import { toDto } from '#/common/response/to-dto.js';
import { IdempotencyInterceptor } from '#/core/idempotency/idempotency.interceptor.js';
import { RequiresSubscription } from '#/subscriptions/requires-subscription.decorator.js';
import { FileDownloadDto, FileDto, FilePageDto, FileVersionPageDto } from './dto/file.dto.js';
import { ComparisonDto, PreviewDto, ReportDto } from './dto/report.dto.js';
import { FilesQueryDto } from './dto/files-query.dto.js';
import { UpdateFileDto } from './dto/update-file.dto.js';
import { UploadFileBodyDoc, UploadFileDto, UploadVersionBodyDoc, UploadVersionDto } from './dto/upload-file.dto.js';
import { FilesService } from './files.service.js';
import { ReportsService } from './quality/reports.service.js';
import { MAX_UPLOAD_BYTES } from './spreadsheet-types.js';
import { SpreadsheetFileValidator } from './validation/spreadsheet-file.validator.js';

/** The header a Premium upload past its included quota carries. */
const QUOTA_WARNING_HEADER = 'X-Gridline-Quota-Warning';

/**
 * Every route needs a plan (402 otherwise) and a signed-in user; WHICH files a user
 * can reach is decided by the one visibility rule in the service, not here. A file
 * the caller cannot see is a 404 everywhere below.
 */
@ApiTags('files')
@ApiBearerAuth()
@RequiresSubscription()
@Roles('admin', 'employee')
// Reads by default; the handlers that change something override with `files:write`.
@RequireScopes('files:read')
@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly reports: ReportsService,
  ) {}

  /**
   * `FileInterceptor` runs first (it parses the multipart body), then
   * `IdempotencyInterceptor`, which needs the parsed file to tell a retry from a
   * different upload that reused a key.
   */
  @Post()
  @RequireScopes('files:write')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }),
    IdempotencyInterceptor,
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFileBodyDoc })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'A UUID. A retry with the same key and the same file replays the first response instead of uploading twice.',
  })
  @ApiCreatedResponse({ type: FileDto })
  async upload(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addValidator(new SpreadsheetFileValidator())
        .build({ fileIsRequired: true, errorHttpStatusCode: 400 }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<FileDto> {
    const uploaded = await this.files.upload(file, dto);
    if (uploaded.quotaWarning) res.setHeader(QUOTA_WARNING_HEADER, uploaded.quotaWarning);
    return FileDto.from(uploaded.file, uploaded.grantedUserIds);
  }

  /** A new version of an existing file: the same upload path, quota and idempotency as `POST /files`. */
  @Post(':id/versions')
  @RequireScopes('files:write')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }),
    IdempotencyInterceptor,
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadVersionBodyDoc })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'A UUID. A retry with the same key and the same file replays the first response instead of uploading twice.',
  })
  @ApiCreatedResponse({ type: FileDto })
  async uploadVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addValidator(new SpreadsheetFileValidator())
        .build({ fileIsRequired: true, errorHttpStatusCode: 400 }),
    )
    file: Express.Multer.File,
    @Body() _body: UploadVersionDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<FileDto> {
    const uploaded = await this.files.uploadVersion(id, file);
    if (uploaded.quotaWarning) res.setHeader(QUOTA_WARNING_HEADER, uploaded.quotaWarning);
    return FileDto.from(uploaded.file, uploaded.grantedUserIds);
  }

  @Get(':id/versions')
  @ApiOkResponse({ type: FileVersionPageDto })
  async versions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: OffsetQueryDto,
  ): Promise<FileVersionPageDto> {
    return toDto(FileVersionPageDto, mapPageData(await this.files.listVersions(id, query), (file) => FileDto.from(file)));
  }

  @Get(':id/compare/:otherId')
  @ApiOkResponse({ type: ComparisonDto })
  async compare(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('otherId', ParseUUIDPipe) otherId: string,
  ): Promise<ComparisonDto> {
    return toDto(ComparisonDto, await this.reports.compare(id, otherId));
  }

  @Get()
  @ApiOkResponse({ type: FilePageDto })
  async list(@Query() query: FilesQueryDto): Promise<FilePageDto> {
    const page = await this.files.list(query);
    return toDto(FilePageDto, mapPageData(page, (file) => FileDto.from(file)));
  }

  @Get(':id')
  @ApiOkResponse({ type: FileDto })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<FileDto> {
    const { file, grantedUserIds } = await this.files.get(id);
    return FileDto.from(file, grantedUserIds);
  }

  @Get(':id/download')
  @ApiOkResponse({ type: FileDownloadDto })
  async download(@Param('id', ParseUUIDPipe) id: string): Promise<FileDownloadDto> {
    return toDto(FileDownloadDto, await this.files.downloadLink(id));
  }

  @Get(':id/report')
  @ApiOkResponse({ type: ReportDto })
  async report(@Param('id', ParseUUIDPipe) id: string): Promise<ReportDto> {
    return toDto(ReportDto, await this.reports.report(id));
  }

  @Post(':id/report/rebuild')
  @HttpCode(200)
  @RequireScopes('files:write')
  @ApiOkResponse({ type: ReportDto })
  async rebuildReport(@Param('id', ParseUUIDPipe) id: string): Promise<ReportDto> {
    return toDto(ReportDto, await this.reports.rebuild(id));
  }

  @Get(':id/preview')
  @ApiOkResponse({ type: PreviewDto })
  async preview(@Param('id', ParseUUIDPipe) id: string): Promise<PreviewDto> {
    return toDto(PreviewDto, await this.reports.preview(id));
  }

  @Patch(':id')
  @RequireScopes('files:write')
  @ApiOkResponse({ type: FileDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFileDto,
  ): Promise<FileDto> {
    const { file, grantedUserIds } = await this.files.update(id, dto);
    return FileDto.from(file, grantedUserIds);
  }

  @Delete(':id')
  @RequireScopes('files:write')
  @HttpCode(200)
  @ApiOkResponse({ type: MessageResponseDto })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<MessageResponseDto> {
    await this.files.remove(id);
    return toDto(MessageResponseDto, { message: 'File deleted.' });
  }
}
