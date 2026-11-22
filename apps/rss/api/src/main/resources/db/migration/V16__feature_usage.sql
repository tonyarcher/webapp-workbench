-- Q2: coarse, privacy-preserving feature counters. No user id, no payload,
-- no title, no URL. Day buckets only; pruned after 90 days.
create table if not exists feature_usage (
    feature text not null,
    day date not null,
    count bigint not null default 0 check (count >= 0),
    primary key (feature, day)
);

create index if not exists feature_usage_day_idx on feature_usage (day);
