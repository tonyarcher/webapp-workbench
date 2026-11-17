import {
    saveArticleForLater as apiSaveArticleForLater,
    unsaveArticleForLater as apiUnsaveArticleForLater,
} from './services/api';
import { invalidateSavedArticles } from './query';
import { toastApiError } from './services/toast';

export async function saveForLater(articleId: string): Promise<boolean> {
    try {
        await apiSaveArticleForLater(articleId);
        await invalidateSavedArticles();
        window.dispatchEvent(new CustomEvent('saved-articles-changed'));
        return true;
    } catch (err) {
        toastApiError(err, 'Could not save article for later.');
        return false;
    }
}

export async function unsaveForLater(articleId: string): Promise<boolean> {
    try {
        await apiUnsaveArticleForLater(articleId);
        await invalidateSavedArticles();
        window.dispatchEvent(new CustomEvent('saved-articles-changed'));
        return true;
    } catch (err) {
        toastApiError(err, 'Could not remove saved article.');
        return false;
    }
}
