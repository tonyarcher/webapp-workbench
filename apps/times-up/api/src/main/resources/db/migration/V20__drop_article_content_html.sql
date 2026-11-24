-- V20: bodies live in article_bodies; search_text uses excerpt (V19).
alter table articles drop column if exists content_html;
