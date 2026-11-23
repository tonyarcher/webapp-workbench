import type { ArticleProvenance, EvidenceItem } from './api-provenance';
import { safeHttpUrl } from './url';

/**
 * Portable evidence export. Only verbatim slices and the source row leave the
 * app; untrusted URLs are checked before they become markdown links.
 */
export function provenanceToMarkdown(provenance: ArticleProvenance): string {
    const source = provenance.source;
    const link = safeHttpUrl(source.canonicalUrl) ?? safeHttpUrl(source.sourceUrl);
    const lines: string[] = [
        `## Evidence — ${source.feedTitle}`,
        '',
        `- Article: \`${source.articleId}\``,
        `- Feed: \`${source.feedId}\``,
    ];
    if (source.sourceKind) {
        lines.push(`- Origin: ${source.sourceKind}${source.fetchMode ? ` / ${source.fetchMode}` : ''}`);
    }
    if (source.connectorId) {
        lines.push(`- Connector: ${source.connectorId}${source.connectorVersion ? ` ${source.connectorVersion}` : ''}`);
    }
    if (link) lines.push(`- Source: ${link}`);
    lines.push('');
    lines.push('### Quotes', '');
    appendEvidence(lines, provenance.quotes, 'No quotes found.');
    lines.push('### Figures', '');
    appendEvidence(lines, provenance.figures, 'No figures found.');
    return `${lines.join('\n')}\n`;
}

function appendEvidence(lines: string[], items: EvidenceItem[], empty: string): void {
    if (items.length === 0) {
        lines.push(empty, '');
        return;
    }
    for (const item of items) {
        lines.push(`> ${item.text}`, '', `\`${item.id}\``, '');
    }
}
