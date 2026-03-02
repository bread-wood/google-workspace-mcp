import { z } from 'zod';
import type { ToolRegistrar } from '../types.js';
import { getGmailClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

export const registerGmailCreateFilter: ToolRegistrar = (server, context) => {
  server.tool(
    'gmail_create_filter',
    'Create a Gmail filter that automatically processes incoming messages matching specified criteria. Supports filtering by sender, recipient, subject, query, and more. Actions include labeling, archiving, marking as read, starring, and forwarding.',
    {
      from: z.string().optional().describe('Sender email or pattern to match'),
      to: z.string().optional().describe('Recipient email or pattern to match'),
      subject: z.string().optional().describe('Subject text to match'),
      query: z.string().optional().describe('Gmail search query for advanced matching'),
      negatedQuery: z.string().optional().describe('Query for messages to exclude'),
      hasAttachment: z.boolean().optional().describe('Match only messages with attachments'),
      addLabelIds: z
        .array(z.string())
        .optional()
        .describe('Label IDs to apply (use gmail_list_labels to find IDs)'),
      removeLabelIds: z.array(z.string()).optional().describe('Label IDs to remove'),
      archive: z.boolean().optional().describe('Archive matching messages (removes from inbox)'),
      markRead: z.boolean().optional().describe('Mark matching messages as read'),
      star: z.boolean().optional().describe('Star matching messages'),
      forward: z.string().optional().describe('Email address to forward matching messages to'),
      neverSpam: z
        .boolean()
        .optional()
        .describe('Never send matching messages to spam'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({
      from,
      to,
      subject,
      query,
      negatedQuery,
      hasAttachment,
      addLabelIds,
      removeLabelIds,
      archive,
      markRead,
      star,
      forward,
      neverSpam,
    }) => {
      try {
        context.rateLimiter.check('gmail_create_filter');

        const criteriaFields = [from, to, subject, query, negatedQuery, hasAttachment];
        const hasCriteria = criteriaFields.some((f) => f !== undefined);
        if (!hasCriteria) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: 'At least one filter criterion must be provided (from, to, subject, query, negatedQuery, or hasAttachment).',
              },
            ],
          };
        }

        const actionFields = [addLabelIds, removeLabelIds, archive, markRead, star, forward, neverSpam];
        const hasAction = actionFields.some((f) => f !== undefined);
        if (!hasAction) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: 'At least one filter action must be provided (addLabelIds, removeLabelIds, archive, markRead, star, forward, or neverSpam).',
              },
            ],
          };
        }

        const criteria: Record<string, unknown> = {};
        if (from !== undefined) criteria.from = from;
        if (to !== undefined) criteria.to = to;
        if (subject !== undefined) criteria.subject = subject;
        if (query !== undefined) criteria.query = query;
        if (negatedQuery !== undefined) criteria.negatedQuery = negatedQuery;
        if (hasAttachment !== undefined) criteria.hasAttachment = hasAttachment;

        const mergedAddLabelIds: string[] = [];
        const mergedRemoveLabelIds: string[] = [];

        if (star === true) mergedAddLabelIds.push('STARRED');
        if (archive === true) mergedRemoveLabelIds.push('INBOX');
        if (markRead === true) mergedRemoveLabelIds.push('UNREAD');
        if (neverSpam === true) mergedRemoveLabelIds.push('SPAM');

        if (addLabelIds) mergedAddLabelIds.push(...addLabelIds);
        if (removeLabelIds) mergedRemoveLabelIds.push(...removeLabelIds);

        const action: Record<string, unknown> = {};
        if (mergedAddLabelIds.length > 0) action.addLabelIds = mergedAddLabelIds;
        if (mergedRemoveLabelIds.length > 0) action.removeLabelIds = mergedRemoveLabelIds;
        if (forward !== undefined) action.forward = forward;

        const gmail = getGmailClient();
        const response = await gmail.users.settings.filters.create({
          userId: 'me',
          requestBody: { criteria, action },
        });

        const filter = response.data;

        const criteriaSummary = Object.entries(criteria)
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(', ');

        const actionSummary = Object.entries(action)
          .map(([k, v]) => `${k}=${Array.isArray(v) ? (v as string[]).join(',') : String(v)}`)
          .join(', ');

        return {
          content: [
            {
              type: 'text' as const,
              text: `Filter created successfully.\nID: ${filter.id}\nCriteria: ${criteriaSummary}\nActions: ${actionSummary}`,
            },
          ],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
