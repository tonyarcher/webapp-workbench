import { apiFetch } from './api-client';

/** One verbatim evidence slice; the id is stable across re-extractions. */
export interface EvidenceItem {
    id: string;
    articleId: string;
    kind: string;
    text: string;
}

/** The row the evidence rests on, including P12 connector provenance. */
export interface ProvenanceSource {
    articleId: string;
    feedId: string;
    feedTitle: string;
    sourceKind: string | null;
    connectorId: string | null;
    connectorVersion: string | null;
    fetchMode: string | null;
    canonicalUrl: string | null;
    sourceUrl: string | null;
    fetchedAt: number;
}

export interface ArticleProvenance {
    articleId: string;
    source: ProvenanceSource;
    quotes: EvidenceItem[];
    figures: EvidenceItem[];
}

/** Narrow provenance read for the open article. Never fetches a body. */
export async function fetchArticleProvenance(articleId: string): Promise<ArticleProvenance | null> {
    const res = (await apiFetch(`/articles/${encodeURIComponent(articleId)}/provenance`)) as ArticleProvenance;
    return typeof res?.articleId === 'string' ? res : null;
}
