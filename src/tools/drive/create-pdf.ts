import { z } from 'zod';
import { Readable } from 'stream';
import PDFDocument from 'pdfkit';
import type { ToolRegistrar } from '../types.js';
import { getDriveClient } from '../../google/client.js';
import { mapError } from '../../errors/index.js';

// Font paths — macOS system fonts
const FONTS = {
  body: '/System/Library/Fonts/Supplemental/Georgia.ttf',
  bodyBold: '/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
  head: '/System/Library/Fonts/Supplemental/Trebuchet MS Bold.ttf',
  headRegular: '/System/Library/Fonts/Supplemental/Trebuchet MS.ttf',
} as const;

type Margins = { top: number; bottom: number; left: number; right: number };

interface TextSegment {
  text: string;
  bold: boolean;
}

interface HeadingBlock {
  type: 'heading1' | 'heading2' | 'heading3';
  text: string;
}

interface ListItemBlock {
  type: 'list-item';
  segments: TextSegment[];
}

interface ParagraphBlock {
  type: 'paragraph';
  segments: TextSegment[];
}

interface NumberedItemBlock {
  type: 'numbered-item';
  number: number;
  segments: TextSegment[];
}

interface PageBreakBlock {
  type: 'page-break';
}

interface TableBlock {
  type: 'table';
  rows: string[][];
  hasHeader: boolean;
}

type ContentBlock =
  | HeadingBlock
  | ListItemBlock
  | NumberedItemBlock
  | ParagraphBlock
  | PageBreakBlock
  | TableBlock;

function parseInline(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }

  return segments.length > 0 ? segments : [{ text, bold: false }];
}

function stripBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1');
}

function isTableSeparator(row: string): boolean {
  const cells = row.split('|').slice(1, -1);
  return cells.length > 0 && cells.every(c => /^[\s\-:]+$/.test(c));
}

function parseContent(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trimEnd();

    if (trimmed === '') {
      i++;
      continue;
    }

    if (trimmed === '---') {
      blocks.push({ type: 'page-break' });
      i++;
      continue;
    }

    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trimEnd().startsWith('|')) {
        tableLines.push(lines[i].trimEnd());
        i++;
      }

      const allRows: string[][] = [];
      for (const line of tableLines) {
        if (isTableSeparator(line)) continue;
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        allRows.push(cells);
      }

      if (allRows.length > 0) {
        blocks.push({ type: 'table', rows: allRows, hasHeader: allRows.length > 1 });
      }
      continue;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'heading3', text: stripBold(trimmed.slice(4)) });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'heading2', text: stripBold(trimmed.slice(3)) });
    } else if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'heading1', text: stripBold(trimmed.slice(2)) });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({ type: 'list-item', segments: parseInline(trimmed.slice(2)) });
    } else {
      const numMatch = /^(\d+)\.\s+(.*)/.exec(trimmed);
      if (numMatch) {
        blocks.push({
          type: 'numbered-item',
          number: parseInt(numMatch[1], 10),
          segments: parseInline(numMatch[2]),
        });
      } else {
        blocks.push({ type: 'paragraph', segments: parseInline(trimmed) });
      }
    }

    i++;
  }

  return blocks;
}

function renderInlineText(
  doc: PDFKit.PDFDocument,
  segments: TextSegment[],
  fontSize: number,
  firstCallOptions: Record<string, unknown> = {},
): void {
  if (segments.length === 1 && !segments[0].bold) {
    doc.fontSize(fontSize).font('Body').text(segments[0].text, firstCallOptions as never);
    return;
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    const font = seg.bold ? 'Body-Bold' : 'Body';
    const opts: Record<string, unknown> = {
      continued: !isLast,
      ...(i === 0 ? firstCallOptions : {}),
    };
    doc.fontSize(fontSize).font(font).text(seg.text, opts as never);
  }
}

/** Ensure there is at least `needed` points of vertical space remaining; if not, add a page. */
function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const margins = (doc as any).page.margins as Margins;
  const pageBottom = doc.page.height - margins.bottom;
  if ((doc as any).y + needed > pageBottom) {
    doc.addPage();
  }
}

/** True when the cursor is at the very top of a fresh page (nothing rendered yet). */
function isAtTopOfPage(doc: PDFKit.PDFDocument): boolean {
  const margins = (doc as any).page.margins as Margins;
  return (doc as any).y <= margins.top + 2;
}

function cellHeight(
  doc: PDFKit.PDFDocument,
  text: string,
  font: string,
  fontSize: number,
  colWidth: number,
  pad: number,
): number {
  const inner = colWidth - pad * 2;
  doc.fontSize(fontSize).font(font);
  const h = (doc as any).heightOfString(text || ' ', { width: inner });
  return Math.max(20, h + pad * 2);
}

function renderTable(
  doc: PDFKit.PDFDocument,
  rows: string[][],
  hasHeader: boolean,
): void {
  if (rows.length === 0) return;

  const margins = (doc as any).page.margins as Margins;
  const pageWidth = doc.page.width - margins.left - margins.right;
  const colCount = rows[0].length;
  const colWidth = pageWidth / colCount;
  const pad = 5;
  const fontSize = 9;
  const pageBottom = doc.page.height - margins.bottom;

  // Space before table
  (doc as any).y += 4;
  let currentY = (doc as any).y;

  for (let r = 0; r < rows.length; r++) {
    const isHeader = hasHeader && r === 0;
    const font = isHeader ? 'Head' : 'Body';

    // Calculate auto row height from the tallest cell
    let rowHeight = 20;
    for (let c = 0; c < rows[r].length; c++) {
      const h = cellHeight(doc, rows[r][c] ?? '', font, fontSize, colWidth, pad);
      if (h > rowHeight) rowHeight = h;
    }

    if (currentY + rowHeight > pageBottom) {
      doc.addPage();
      currentY = (doc as any).page.margins.top;
    }

    for (let c = 0; c < rows[r].length; c++) {
      const x = margins.left + c * colWidth;

      if (isHeader) {
        doc.rect(x, currentY, colWidth, rowHeight).fillAndStroke('#E8E8E8', '#BBBBBB');
      } else {
        doc
          .rect(x, currentY, colWidth, rowHeight)
          .strokeColor('#BBBBBB')
          .stroke();
      }

      const cellText = rows[r][c] ?? '';
      doc
        .fontSize(fontSize)
        .font(font)
        .fillColor('black')
        .strokeColor('black')
        .text(cellText, x + pad, currentY + pad, {
          width: colWidth - pad * 2,
          lineBreak: true,
        });
    }

    currentY += rowHeight;
  }

  // Reset both x and y after table so following content starts at the left margin
  (doc as any).x = margins.left;
  (doc as any).y = currentY + 10;
}


function renderPdf(title: string, blocks: ContentBlock[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 72 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Register fonts
    doc.registerFont('Body', FONTS.body);
    doc.registerFont('Body-Bold', FONTS.bodyBold);
    doc.registerFont('Head', FONTS.head);
    doc.registerFont('Head-Regular', FONTS.headRegular);

    // Render all content blocks
    for (const block of blocks) {
      switch (block.type) {
        case 'page-break':
          doc.addPage();
          break;

        case 'heading1': {
          const atTop1 = isAtTopOfPage(doc);
          if (!atTop1) ensureSpace(doc, 60);
          if (!atTop1) doc.moveDown(0.5);
          doc.fontSize(22).font('Head').text(block.text);
          doc.moveDown(0.4);
          break;
        }

        case 'heading2': {
          const atTop2 = isAtTopOfPage(doc);
          if (!atTop2) ensureSpace(doc, 45);
          if (!atTop2) doc.moveDown(0.8);
          doc.fontSize(16).font('Head').text(block.text);
          doc.moveDown(0.3);
          break;
        }

        case 'heading3': {
          const atTop3 = isAtTopOfPage(doc);
          const h3margins = (doc as any).page.margins as Margins;
          if (!atTop3) doc.moveDown(0.6);
          const hY = (doc as any).y;
          // Accent bar: 3pt wide, 13pt tall, dark slate
          doc.rect(h3margins.left, hY + 1, 3, 13).fill('#334155');
          doc
            .fontSize(13)
            .font('Head')
            .fillColor('#334155')
            .text(block.text, h3margins.left + 8, hY);
          doc.fillColor('black');
          doc.moveDown(0.3);
          break;
        }

        case 'list-item':
          if (block.segments.length === 1 && !block.segments[0].bold) {
            doc
              .fontSize(11)
              .font('Body')
              .text(`\u2022  ${block.segments[0].text}`, { indent: 18 });
          } else {
            doc
              .fontSize(11)
              .font('Body')
              .text('\u2022  ', { continued: true, indent: 18 } as never);
            renderInlineText(doc, block.segments, 11);
          }
          doc.moveDown(0.2);
          break;

        case 'numbered-item': {
          const numStr = `${block.number}.  `;
          if (block.segments.length === 1 && !block.segments[0].bold) {
            doc
              .fontSize(11)
              .font('Body-Bold')
              .text(`${numStr}${block.segments[0].text}`, { indent: 24 });
          } else {
            doc
              .fontSize(11)
              .font('Body-Bold')
              .text(numStr, { continued: true, indent: 24 } as never);
            renderInlineText(doc, block.segments, 11);
          }
          doc.moveDown(0.3);
          break;
        }

        case 'paragraph':
          renderInlineText(doc, block.segments, 11);
          doc.moveDown(0.55);
          break;

        case 'table':
          renderTable(doc, block.rows, block.hasHeader);
          break;
      }
    }

    doc.end();
  });
}

export const registerDriveCreatePdf: ToolRegistrar = (server, context) => {
  server.tool(
    'drive_create_pdf',
    'Generate a formatted PDF from text content and upload it to Google Drive. Supports markdown: headings (#, ##, ###), bullet lists (- or *), pipe tables (| col | col |), page breaks (---), inline bold (**text**), and body text.',
    {
      title: z
        .string()
        .max(500)
        .describe('PDF filename (.pdf appended if missing)'),
      content: z
        .string()
        .max(100_000)
        .describe(
          'Text content with markdown formatting (max 100,000 characters)',
        ),
      folderId: z
        .string()
        .optional()
        .describe('Optional Google Drive folder ID to upload into'),
    },
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    async ({ title, content, folderId }) => {
      try {
        context.rateLimiter.check('drive_create_pdf');

        const fileName = title.endsWith('.pdf') ? title : `${title}.pdf`;
        const blocks = parseContent(content);
        const pdfBuffer = await renderPdf(title, blocks);

        const drive = getDriveClient();

        const fileMetadata: {
          name: string;
          mimeType: string;
          parents?: string[];
        } = {
          name: fileName,
          mimeType: 'application/pdf',
        };

        if (folderId) {
          fileMetadata.parents = [folderId];
        }

        const response = await drive.files.create({
          requestBody: fileMetadata,
          media: {
            mimeType: 'application/pdf',
            body: Readable.from(pdfBuffer),
          },
          fields: 'id,name,webViewLink',
        });

        const file = response.data;

        const lines = [
          'PDF created and uploaded successfully.',
          `ID: ${file.id}`,
          `Name: ${file.name}`,
          `Web Link: ${file.webViewLink || 'N/A'}`,
        ];

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (err) {
        return mapError(err);
      }
    },
  );
};
