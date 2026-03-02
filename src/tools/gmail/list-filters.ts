import type { ToolRegistrar } from '../types.js';
import { getGmailClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';
import { sanitizeField } from '../../sanitize/pipeline.js';

export const registerGmailListFilters: ToolRegistrar = (server, context) => {
  server.tool(
    'gmail_list_filters',
    'List all Gmail filters. Returns each filter\'s matching criteria and actions.',
    {},
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    async () => {
      try {
        context.rateLimiter.check('gmail_list_filters');

        const gmail = getGmailClient();

        const [filtersResponse, labelsResponse] = await Promise.all([
          gmail.users.settings.filters.list({ userId: 'me' }),
          gmail.users.labels.list({ userId: 'me' }),
        ]);

        const filters = filtersResponse.data.filter || [];

        if (filters.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No filters found.' }],
          };
        }

        // Build label ID → name map for resolving label IDs to human-readable names
        const labelMap = new Map<string, string>();
        for (const label of labelsResponse.data.labels || []) {
          if (label.id && label.name) {
            labelMap.set(label.id, label.name);
          }
        }

        const resolveLabel = (id: string): string => labelMap.get(id) ?? id;

        const sections: string[] = [`Found ${filters.length} filter(s):\n`];

        for (const filter of filters) {
          const lines: string[] = [`Filter ID: ${filter.id ?? '(unknown)'}`];

          // Criteria
          const criteria = filter.criteria;
          if (criteria) {
            const criteriaLines: string[] = [];

            if (criteria.from) criteriaLines.push(`  from: ${sanitizeField(criteria.from)}`);
            if (criteria.to) criteriaLines.push(`  to: ${sanitizeField(criteria.to)}`);
            if (criteria.subject) criteriaLines.push(`  subject: ${sanitizeField(criteria.subject)}`);
            if (criteria.query) criteriaLines.push(`  query: ${sanitizeField(criteria.query)}`);
            if (criteria.negatedQuery) criteriaLines.push(`  negatedQuery: ${sanitizeField(criteria.negatedQuery)}`);
            if (criteria.hasAttachment != null) {
              criteriaLines.push(`  hasAttachment: ${criteria.hasAttachment}`);
            }
            if (criteria.size != null) {
              const comparison = criteria.sizeComparison ?? 'larger';
              criteriaLines.push(`  size: ${comparison} ${criteria.size} bytes`);
            }

            if (criteriaLines.length > 0) {
              lines.push('Criteria:');
              lines.push(...criteriaLines);
            }
          }

          // Actions
          const action = filter.action;
          if (action) {
            const actionLines: string[] = [];

            const addLabels = action.addLabelIds || [];
            const removeLabels = action.removeLabelIds || [];

            // Resolve known system label IDs to inferred action names where possible
            const addLabelNames: string[] = [];
            let markRead = false;
            let star = false;
            let neverSpam = false;

            for (const id of addLabels) {
              if (id === 'STARRED') {
                star = true;
              } else if (id === 'IMPORTANT') {
                addLabelNames.push('IMPORTANT');
              } else {
                addLabelNames.push(resolveLabel(id));
              }
            }

            let archive = false;

            for (const id of removeLabels) {
              if (id === 'INBOX') {
                archive = true;
              } else if (id === 'UNREAD') {
                markRead = true;
              } else if (id === 'SPAM') {
                neverSpam = true;
              }
            }

            if (addLabelNames.length > 0) {
              actionLines.push(`  apply labels: ${addLabelNames.map(sanitizeField).join(', ')}`);
            }
            if (archive) actionLines.push('  archive (skip inbox)');
            if (markRead) actionLines.push('  mark as read');
            if (star) actionLines.push('  star');
            if (neverSpam) actionLines.push('  never send to spam');

            if (action.forward) {
              actionLines.push(`  forward to: ${sanitizeField(action.forward)}`);
            }

            if (actionLines.length > 0) {
              lines.push('Actions:');
              lines.push(...actionLines);
            }
          }

          sections.push(lines.join('\n'));
        }

        return {
          content: [{ type: 'text' as const, text: sections.join('\n\n') }],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
