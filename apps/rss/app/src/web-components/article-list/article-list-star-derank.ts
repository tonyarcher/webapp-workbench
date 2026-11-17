import { noteDerank } from '../../mutations';
import { isDeranked } from '../../services/interesting-settings';
import { toggleStarAction } from './article-list-actions';
import type { Article } from '../../types';

/** The star ⇄ "not interesting" exclusivity, applied on both write paths. */
export interface StarDerankHost {
    items: Article[];
    requestUpdate(): void;
}

export async function onStarAction(host: StarDerankHost, e: Event, article: Article): Promise<void> {
    e.stopPropagation();
    if (!article.starred) {
        // Starring clears a "not interesting" mark.
        noteDerank(article.id, article.title, false);
    }
    await toggleStarAction(host as never, article);
}

export function onToggleDerankAction(host: StarDerankHost, e: Event): void {
    const { id, title } = (e as CustomEvent<{ id: string; title: string }>).detail;
    const next = !isDeranked(id);
    noteDerank(id, title, next);
    if (next) clearStarOnDerank(host, id);
    host.requestUpdate();
}

/** Deranking clears a star. */
function clearStarOnDerank(host: StarDerankHost, id: string): void {
    const item = host.items.find((a) => a.id === id);
    if (item?.starred) {
        void toggleStarAction(host as never, item);
    }
}
