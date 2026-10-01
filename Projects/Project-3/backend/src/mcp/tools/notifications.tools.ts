import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { mapPageData } from '#/common/pagination/paginate.js';
import { toDto } from '#/common/response/to-dto.js';
import { MarkedReadDto, NotificationDto, NotificationPageDto, UnreadCountDto } from '#/notifications/dto/notification.dto.js';
import { NotificationsQueryDto } from '#/notifications/dto/notifications-query.dto.js';
import { defineTool, validated, type Tool } from '../tool.js';

const ANY = ['admin', 'employee'] as const;

/** Only ever the caller's OWN inbox: the service scopes by tenant and person, and someone else's id is a 404. */
export const NOTIFICATION_TOOLS: readonly Tool[] = [
  defineTool(
    {
      name: 'list_notifications',
      title: 'List my notifications',
      description:
        'The signed-in person’s inbox, newest first: quota alerts, shared files, finished reports, failed rules, ' +
        'schema changes, invoices.',
      scope: 'notifications:read',
      roles: ANY,
      write: false,
      needsPlan: false,
    },
    {
      cursor: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      unread: z.boolean().optional().describe('Only the ones not read yet.'),
    },
    async (input, s) => {
      const page = await s.notifications.list(await validated(NotificationsQueryDto, input));
      return toDto(NotificationPageDto, mapPageData(page, NotificationDto.from));
    },
  ),

  defineTool(
    {
      name: 'get_unread_count',
      title: 'Count unread notifications',
      description: 'How many notifications the signed-in person has not read.',
      scope: 'notifications:read',
      roles: ANY,
      write: false,
      needsPlan: false,
    },
    {},
    async (_input, s) => toDto(UnreadCountDto, { count: await s.notifications.unreadCount() }),
  ),

  defineTool(
    {
      name: 'mark_notifications_read',
      title: 'Mark notifications as read',
      description:
        'Marks ONE notification (`id`) or ALL of the signed-in person’s notifications (`all: true`) as read. Send ' +
        'exactly one of them. Only their own inbox can be touched.',
      scope: 'notifications:read',
      roles: ANY,
      write: true,
      needsPlan: false,
      idempotent: true,
    },
    {
      id: z.uuid().optional().describe('One notification, from `list_notifications`.'),
      all: z.boolean().optional().describe('`true` marks every unread notification read.'),
    },
    async ({ id, all }, s) => {
      if ((id !== undefined) === (all === true)) {
        throw new BadRequestException('Send exactly one of `id` or `all: true`.');
      }
      if (id !== undefined) return NotificationDto.from(await s.notifications.markRead(id));
      return toDto(MarkedReadDto, { updated: await s.notifications.markAllRead() });
    },
  ),
];
