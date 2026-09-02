export const PORT = Number(process.env.PORT ?? 3002);
export const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://rss:rss@localhost:5432/radio';
export const WEEK_MS = 7 * 24 * 60 * 60 * 1_000;
