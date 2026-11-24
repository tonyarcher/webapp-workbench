import type { Article } from '../types';
import { domainOf, stripTags } from '../util';

export type NotesFormat = 'obsidian' | 'notion' | 'bear' | 'generic';

export interface NotesExportOptions {
    format: NotesFormat;
    title: string;
}

export function buildNotesExport(articles: Article[], options: NotesExportOptions): string {
    const { format, title } = options;
    const lines: string[] = [];
    lines.push(`# ${title}`);
    lines.push('');
    lines.push(`Exported ${articles.length} article${articles.length === 1 ? '' : 's'} from Times Up.`);
    lines.push('');
    for (const a of articles) {
        const link = a.link ? `[${a.title}](${a.link})` : a.title;
        const date = a.published ? new Date(a.published).toISOString().slice(0, 10) : '';
        const source = domainOf(a.link) || a.author || '';
        if (format === 'obsidian') {
            lines.push('---');
            lines.push(`title: "${a.title.replace(/"/g, '\\"')}"`);
            if (source) lines.push(`source: ${source}`);
            if (date) lines.push(`date: ${date}`);
            if (a.link) lines.push(`url: ${a.link}`);
            lines.push('tags: [rss-reader]');
            lines.push('---');
            lines.push('');
        }
        lines.push(`## ${a.title}`);
        lines.push('');
        if (source || date) lines.push(`*${[source, date].filter(Boolean).join(' · ')}*`);
        if (a.link) lines.push(`\n${link}`);
        lines.push('');
        if (a.summary) lines.push(a.summary);
        if (a.content) lines.push(stripTags(a.content).slice(0, 500));
        lines.push('');
        if (format === 'bear') lines.push('#rss-reader #reading');
        lines.push('');
    }
    return lines.join('\n');
}

export function downloadNotesExport(articles: Article[], format: NotesFormat, filename = 'rss-reader-export.md'): void {
    const content = buildNotesExport(articles, { format, title: 'Times Up Export' });
    const blob = new Blob([content], { type: 'text/markdown' });
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
