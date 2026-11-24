-- Supporting indexes for poller eligibility, due ordering, and article-state lookups.
create index if not exists idx_subscriptions_feed_id on subscriptions (feed_id);
create index if not exists idx_feed_sync_due on feed_sync (next_attempt_at, last_fetched_at);
create index if not exists idx_article_state_article_id on article_state (article_id);
