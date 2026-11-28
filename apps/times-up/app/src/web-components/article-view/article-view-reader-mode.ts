import {
    applyReaderMode,
    clearFeedReaderMode,
    loadFeedReaderMode,
    loadReaderMode,
    readerModeForFeed,
    saveFeedReaderMode,
} from '../../services/reader-mode';
import { isSnapshotArticle } from '../../services/saved-queue';
import { toastInfo } from '../../services/toast';
import type { Article } from '../../types';

export function applyArticleReaderMode(article: Article | null): void {
    const feedId = article?.feedId;
    applyReaderMode(feedId ? readerModeForFeed(feedId) : loadReaderMode());
}

export function toggleArticleReaderMode(article: Article | null): void {
    if (!article || isSnapshotArticle(article)) return;
    if (loadFeedReaderMode(article.feedId)) {
        clearFeedReaderMode(article.feedId);
        applyReaderMode(loadReaderMode());
        toastInfo('Feed reader mode cleared');
    } else {
        saveFeedReaderMode(article.feedId, loadReaderMode());
        toastInfo('Reader mode saved for this feed');
    }
}
