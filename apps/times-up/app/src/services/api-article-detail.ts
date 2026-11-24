import type { Article } from '../types';
import { apiFetch } from './api-client';

export async function fetchArticleById(id: string): Promise<Article> {
    return apiFetch(`/articles/${encodeURIComponent(id)}`) as Promise<Article>;
}
