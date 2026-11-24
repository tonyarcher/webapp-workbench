import { domainOf, formatDate, stripTags } from '../util';
import type { Article } from '../types';

export function safeCitationLink(article: Article): string | undefined {
    if (!article.link) return undefined;
    try {
        const url = new URL(article.link);
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
    } catch {
        return undefined;
    }
    return undefined;
}

/** Clean markdown citation for pasting into notes/docs. */
export function formatMarkdownCitation(article: Article, link?: string): string {
    const href = link ?? safeCitationLink(article);
    const title = (article.title || 'Untitled').replace(/[[\]]/g, '').trim();
    const source = domainOf(article.link) || article.author || '';
    const date = article.published ? formatDate(article.published) : '';
    const meta = [source, date].filter(Boolean).join(' · ');
    const titleLine = href ? `[${title}](${href})` : title;
    return meta ? `${titleLine}  \n${meta}` : titleLine;
}

function excerptForCard(article: Article, max = 220): string {
    const text = stripTags(article.summary || article.content || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return '';
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const space = cut.lastIndexOf(' ');
    return `${(space > 80 ? cut.slice(0, space) : cut).trim()}…`;
}

function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number,
): number {
    const words = text.split(/\s+/).filter(Boolean);
    let line = '';
    let lines = 0;
    const ellipsis = '…';

    const fitWithEllipsis = (value: string): string => {
        let trimmed = value.trimEnd();
        while (trimmed && ctx.measureText(`${trimmed}${ellipsis}`).width > maxWidth) {
            trimmed = trimmed.slice(0, -1).trimEnd();
        }
        return trimmed ? `${trimmed}${ellipsis}` : ellipsis;
    };

    for (let i = 0; i < words.length; i++) {
        const word = words[i] ?? '';
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
            if (lines === maxLines - 1) {
                ctx.fillText(fitWithEllipsis(line), x, y + lines * lineHeight);
                return maxLines;
            }
            ctx.fillText(line, x, y + lines * lineHeight);
            lines++;
            line = word;
        } else if (ctx.measureText(test).width > maxWidth && !line) {
            if (lines === maxLines - 1) {
                ctx.fillText(fitWithEllipsis(word), x, y + lines * lineHeight);
                return maxLines;
            }
            ctx.fillText(fitWithEllipsis(word), x, y + lines * lineHeight);
            lines++;
            line = '';
        } else {
            line = test;
        }
    }

    if (line) {
        if (lines === maxLines - 1 && ctx.measureText(line).width > maxWidth) {
            ctx.fillText(fitWithEllipsis(line), x, y + lines * lineHeight);
        } else {
            ctx.fillText(line, x, y + lines * lineHeight);
        }
        lines++;
    }
    return lines;
}

/** Render a quote/citation card locally and return a PNG blob. */
export async function renderQuoteCard(article: Article, link?: string): Promise<Blob> {
    const width = 1200;
    const height = 630;
    const pad = 64;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 46px system-ui, -apple-system, Segoe UI, sans-serif';
    const title = (article.title || 'Untitled').trim();
    const titleLines = wrapText(ctx, title, pad, pad + 52, width - pad * 2, 58, 4);
    let y = pad + 52 + titleLines * 58 + 18;

    const excerpt = excerptForCard(article);
    if (excerpt) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '28px system-ui, -apple-system, Segoe UI, sans-serif';
        const exLines = wrapText(ctx, excerpt, pad, y + 30, width - pad * 2, 40, 4);
        y += 30 + exLines * 40 + 24;
    }

    const source = domainOf(article.link) || article.author || '';
    const date = article.published ? formatDate(article.published) : '';
    const meta = [source, date].filter(Boolean).join(' · ');
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px system-ui, -apple-system, Segoe UI, sans-serif';
    if (meta) ctx.fillText(meta, pad, height - pad - 34);

    const href = link ?? safeCitationLink(article) ?? '';
    if (href) {
        ctx.fillStyle = '#60a5fa';
        ctx.font = '22px system-ui, -apple-system, Segoe UI, sans-serif';
        const shown = href.length > 70 ? `${href.slice(0, 67)}…` : href;
        ctx.fillText(shown, pad, height - pad);
    }

    return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not render image'))), 'image/png');
    });
}

export async function copyImageBlob(blob: Blob): Promise<boolean> {
    try {
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
            await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
            return true;
        }
    } catch {
        // fall through
    }
    return false;
}

export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
