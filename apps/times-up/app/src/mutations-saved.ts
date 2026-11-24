import { deleteSavedArticle, putSavedArticle } from './db/db';
import { sharedSnapshot, type SharedLink } from './services/shared-links';
import {
    saveArticleForLater as apiSaveArticleForLater,
    unsaveArticleForLater as apiUnsaveArticleForLater,
} from './services/api';
import { invalidateSavedArticles } from './query';
import { toastApiError, toastError, toastInfo } from './services/toast';

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

export async function saveSharedSnapshot(link: SharedLink): Promise<boolean> {
    try {
        await putSavedArticle(sharedSnapshot(link));
        await invalidateSavedArticles();
        window.dispatchEvent(new CustomEvent('saved-articles-changed'));
        toastInfo('Link saved for later');
        return true;
    } catch {
        toastError('Could not save the link');
        return false;
    }
}

export async function removeSavedSnapshot(id: string): Promise<boolean> {
    try {
        await deleteSavedArticle(id);
        await invalidateSavedArticles();
        window.dispatchEvent(new CustomEvent('saved-articles-changed'));
        return true;
    } catch {
        toastError('Could not remove saved link.');
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
