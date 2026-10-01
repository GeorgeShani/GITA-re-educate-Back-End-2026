import { z } from 'zod';
import { OffsetQueryDto } from '#/common/pagination/offset-query.dto.js';
import { CursorQueryDto } from '#/common/pagination/cursor-query.dto.js';
import { mapPageData } from '#/common/pagination/paginate.js';
import { toDto } from '#/common/response/to-dto.js';
import { CommentDto, CommentPageDto } from '#/comments/dto/comment.dto.js';
import { FILE_VISIBILITIES } from '#/files/file-asset.entity.js';
import { FileDto, FilePageDto, FileVersionPageDto } from '#/files/dto/file.dto.js';
import { FILE_SORTS, FilesQueryDto } from '#/files/dto/files-query.dto.js';
import { ComparisonDto, PreviewDto, ReportDto } from '#/files/dto/report.dto.js';
import { UploadFileDto } from '#/files/dto/upload-file.dto.js';
import { SPREADSHEET_MIME_TYPES } from '#/files/spreadsheet-types.js';
import { SubscriptionDto } from '#/subscriptions/dto/subscription.dto.js';
import { defineTool, validated, type Tool } from '../tool.js';
import { idempotently, incomingFrom } from '../uploads.js';

const ANY = ['admin', 'employee'] as const;
const fileId = z.uuid().describe('The file’s id, from `list_files`.');
const page = z.number().int().min(1).optional().describe('Page number, from 1.');
const limit = (max: number) => z.number().int().min(1).max(max).optional();

const uploadFields = {
  name: z.string().min(1).max(255).describe('The file name, e.g. `sales-q3.csv`. Shown to colleagues.'),
  text: z.string().optional().describe('The file’s content, for a CSV. Send this or `base64`, not both.'),
  base64: z.string().optional().describe('The file’s bytes, base64-encoded. Use this for .xlsx and .xls.'),
  idempotencyKey: z
    .uuid()
    .optional()
    .describe('A UUID you make up. If a call times out, repeat it with the SAME key and it cannot upload twice.'),
};

export const FILES_TOOLS: readonly Tool[] = [
  defineTool(
    {
      name: 'list_files',
      title: 'List files',
      description:
        'Lists the spreadsheets this person can see, newest first, one entry per file (its latest version). ' +
        'Returns `data` and `meta.nextCursor`: pass that back as `cursor` for the next page.',
      scope: 'files:read',
      roles: ANY,
      write: false,
      needsPlan: true,
    },
    {
      cursor: z.string().max(200).optional(),
      limit: limit(100),
      sort: z.enum(FILE_SORTS).optional(),
      mimeType: z.enum(SPREADSHEET_MIME_TYPES).optional(),
      visibility: z.enum(FILE_VISIBILITIES).optional(),
      uploaderId: z.uuid().optional(),
      uploadedAfter: z.iso.datetime().optional().describe('ISO 8601; uploaded at or after this instant.'),
      uploadedBefore: z.iso.datetime().optional().describe('ISO 8601; uploaded before this instant.'),
      allVersions: z.boolean().optional().describe('List every version, not just the latest of each file.'),
    },
    async (input, s) => {
      const page = await s.files.list(await validated(FilesQueryDto, input));
      return toDto(FilePageDto, mapPageData(page, (file) => FileDto.from(file)));
    },
  ),

  defineTool(
    {
      name: 'get_file',
      title: 'Get a file',
      description:
        'One file: name, type, size, version, visibility and uploader. Who it is shared with is included only for its ' +
        'uploader and admins. A file this person may not see is reported as not found.',
      scope: 'files:read',
      roles: ANY,
      write: false,
      needsPlan: true,
    },
    { id: fileId },
    async ({ id }, s) => {
      const { file, grantedUserIds } = await s.files.get(id);
      return FileDto.from(file, grantedUserIds);
    },
  ),

  defineTool(
    {
      name: 'list_file_versions',
      title: 'List a file’s versions',
      description: 'Every version of the same dataset that this person may see, newest first.',
      scope: 'files:read',
      roles: ANY,
      write: false,
      needsPlan: true,
    },
    { id: fileId, page, limit: limit(100) },
    async ({ id, ...query }, s) => {
      const versions = await s.files.listVersions(id, await validated(OffsetQueryDto, query));
      return toDto(FileVersionPageDto, mapPageData(versions, (file) => FileDto.from(file)));
    },
  ),

  defineTool(
    {
      name: 'get_quality_report',
      title: 'Get a file’s data-quality report',
      description:
        'The report built for a file: rows, columns, empty cells, types, duplicates, the company’s rules checked ' +
        'against it, a quality score, and a plain-language summary. `status` says whether it is ready yet ' +
        '(`queued` and `profiling` mean try again shortly).',
      scope: 'files:read',
      roles: ANY,
      write: false,
      needsPlan: true,
    },
    { id: fileId },
    async ({ id }, s) => toDto(ReportDto, await s.reports.report(id)),
  ),

  defineTool(
    {
      name: 'preview_file',
      title: 'Preview a file’s first rows',
      description: 'The first rows and columns of a file (up to 50 × 50, long cells cut), from its finished report.',
      scope: 'files:read',
      roles: ANY,
      write: false,
      needsPlan: true,
    },
    { id: fileId },
    async ({ id }, s) => toDto(PreviewDto, await s.reports.preview(id)),
  ),

  defineTool(
    {
      name: 'compare_versions',
      title: 'Compare two versions of a file',
      description:
        'What changed between two versions of the same dataset: columns added, removed or retyped, empty-cell ' +
        'shifts, and row-count and quality-score changes. Both reports must be ready.',
      scope: 'files:read',
      roles: ANY,
      write: false,
      needsPlan: true,
    },
    { id: fileId.describe('The earlier version.'), otherId: z.uuid().describe('The later version.') },
    async ({ id, otherId }, s) => toDto(ComparisonDto, await s.reports.compare(id, otherId)),
  ),

  defineTool(
    {
      name: 'list_comments',
      title: 'List a file’s comments',
      description: 'The discussion on a file, oldest first, with replies one level deep. Deleted comments are tombstones.',
      scope: 'files:read',
      roles: ANY,
      write: false,
      needsPlan: true,
    },
    { id: fileId, cursor: z.string().max(200).optional(), limit: limit(100) },
    async ({ id, ...query }, s) => {
      const comments = await s.comments.list(id, await validated(CursorQueryDto, query));
      return toDto(CommentPageDto, mapPageData(comments, CommentDto.from));
    },
  ),

  defineTool(
    {
      name: 'get_plan_and_quota',
      title: 'Get the plan and quota',
      description:
        'The company’s current plan, its limits, and how much of them is used this period (files, seats, rules, ' +
        'versions). Check this before a large upload.',
      scope: 'files:read',
      roles: ANY,
      write: false,
      // This is how an agent learns it has no plan, so it answers instead of refusing.
      needsPlan: false,
    },
    {},
    async (_input, s) => toDto(SubscriptionDto, await s.subscriptions.view()),
  ),

  defineTool(
    {
      name: 'upload_file',
      title: 'Upload a file',
      description:
        'Uploads a new CSV, XLS or XLSX file for the company. Counts against the plan’s file quota (a refusal says ' +
        'so, with 402). A data-quality report is built in the background: call `get_quality_report` shortly after. ' +
        'The type is decided from the content, not the name. Up to 8 MB; larger files go through the REST API. ' +
        'Returns the file; with a repeated `idempotencyKey` it returns `{ replayed: true, result }` instead of ' +
        'uploading again.',
      scope: 'files:write',
      roles: ANY,
      write: true,
      needsPlan: true,
    },
    {
      ...uploadFields,
      visibility: z
        .enum(FILE_VISIBILITIES)
        .optional()
        .describe('`company` (default): everyone in the company. `restricted`: the uploader, admins and `grantedUserIds`.'),
      grantedUserIds: z.array(z.uuid()).max(100).optional().describe('With `restricted`: colleagues who may also see it.'),
    },
    async (input, s, caller) => {
      const { name, text, base64, idempotencyKey, ...access } = input;
      const incoming = incomingFrom({ name, ...(text !== undefined && { text }), ...(base64 !== undefined && { base64 }) });
      const dto = await validated(UploadFileDto, access);
      return idempotently({
        store: s.idempotency,
        companyId: caller.companyId,
        key: idempotencyKey,
        route: 'MCP upload_file',
        userId: s.context.userId,
        body: { name: incoming.name, ...access },
        file: incoming.buffer,
        run: async () => {
          const uploaded = await s.files.upload(incoming, dto);
          return {
            ...FileDto.from(uploaded.file, uploaded.grantedUserIds),
            quotaWarning: uploaded.quotaWarning,
          };
        },
      });
    },
  ),

  defineTool(
    {
      name: 'upload_file_version',
      title: 'Upload a new version of a file',
      description:
        'Adds a new version to an existing file you uploaded (or any file, for an admin). It keeps the file’s ' +
        'visibility and sharing, uses a quota slot, and gets its own report. Compare it with `compare_versions` ' +
        'once both reports are ready. Same input and limits as `upload_file`.',
      scope: 'files:write',
      roles: ANY,
      write: true,
      needsPlan: true,
    },
    { id: fileId.describe('Any version of the file to add to.'), ...uploadFields },
    async ({ id, name, text, base64, idempotencyKey }, s, caller) => {
      const incoming = incomingFrom({ name, ...(text !== undefined && { text }), ...(base64 !== undefined && { base64 }) });
      return idempotently({
        store: s.idempotency,
        companyId: caller.companyId,
        key: idempotencyKey,
        route: 'MCP upload_file_version',
        userId: s.context.userId,
        body: { id, name: incoming.name },
        file: incoming.buffer,
        run: async () => {
          const uploaded = await s.files.uploadVersion(id, incoming);
          return {
            ...FileDto.from(uploaded.file, uploaded.grantedUserIds),
            quotaWarning: uploaded.quotaWarning,
          };
        },
      });
    },
  ),

  defineTool(
    {
      name: 'rebuild_quality_report',
      title: 'Rebuild a file’s report',
      description:
        'Re-checks a file against the company’s rules as they are now (after a rule changed). Only the uploader or ' +
        'an admin. Answers 409 if a build is already queued or running. Then call `get_quality_report`.',
      scope: 'files:write',
      roles: ANY,
      write: true,
      needsPlan: true,
      idempotent: true,
    },
    { id: fileId },
    async ({ id }, s) => toDto(ReportDto, await s.reports.rebuild(id)),
  ),
];
