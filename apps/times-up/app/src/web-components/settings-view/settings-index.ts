import type { SettingsSection } from '../../types';

/**
 * One searchable setting. `target` is a CSS selector resolved inside the
 * panel's own root, so a result can jump to the control rather than only to
 * the tab. General's targets reuse the `data-focus-key` the section builders
 * already stamp for focus restoration; the other panels carry `data-setting`.
 */
export interface SettingEntry {
    id: string;
    section: SettingsSection;
    label: string;
    /** Lowercase extra words, so "dark mode" reaches the Lights out theme. */
    keywords: string;
    target: string;
}

export const SETTINGS_INDEX: readonly SettingEntry[] = [
    // General — appearance and reading
    {
        id: 'theme-light',
        section: 'general',
        label: 'Light theme',
        keywords: 'appearance theme bright',
        target: '[data-theme="light"]',
    },
    {
        id: 'theme-dark',
        section: 'general',
        label: 'Dark grey theme',
        keywords: 'appearance theme dark night mode',
        target: '[data-theme="dark"]',
    },
    {
        id: 'theme-oled',
        section: 'general',
        label: 'Lights out theme',
        keywords: 'appearance theme oled black dark night mode',
        target: '[data-theme="oled"]',
    },
    {
        id: 'reader-font',
        section: 'general',
        label: 'Reader font',
        keywords: 'reader article font sans serif dyslexia',
        target: '[data-focus-key="select:Font"]',
    },
    {
        id: 'reader-size',
        section: 'general',
        label: 'Reader text size',
        keywords: 'reader article text size small medium large',
        target: '[data-focus-key="select:Size"]',
    },
    {
        id: 'reader-line',
        section: 'general',
        label: 'Reader line spacing',
        keywords: 'reader article line spacing compact normal relaxed',
        target: '[data-focus-key="select:Line spacing"]',
    },
    {
        id: 'reader-width',
        section: 'general',
        label: 'Reader width',
        keywords: 'reader article width narrow medium wide measure',
        target: '[data-focus-key="select:Width"]',
    },
    {
        id: 'share-buttons',
        section: 'general',
        label: 'Share buttons',
        keywords: 'share facebook x mastodon instagram article',
        target: '[aria-label="Share buttons"]',
    },
    {
        id: 'mastodon-host',
        section: 'general',
        label: 'Mastodon instance',
        keywords: 'share mastodon instance host domain',
        target: '#mastodon-host',
    },
    {
        id: 'add-feed',
        section: 'general',
        label: 'Add feed',
        keywords: 'feeds subscribe rss atom url import',
        target: '[data-focus-key="action:Add feed"]',
    },
    {
        id: 'mute-filters',
        section: 'general',
        label: 'Mute filters',
        keywords: 'feeds mute hide filter words rules',
        target: '[data-focus-key="action:Mute filters"]',
    },
    {
        id: 'import-opml',
        section: 'general',
        label: 'Import OPML',
        keywords: 'feeds import restore subscriptions backup opml',
        target: '[data-focus-key="action:Import OPML"]',
    },
    {
        id: 'export-opml',
        section: 'general',
        label: 'Export OPML',
        keywords: 'feeds export backup subscriptions opml',
        target: '[data-focus-key="action:Export OPML"]',
    },
    {
        id: 'upload-library',
        section: 'general',
        label: 'Upload local library',
        keywords: 'feeds migrate local indexeddb server library',
        target: '[data-focus-key="action:Upload local library"]',
    },
    {
        id: 'notification-permission',
        section: 'general',
        label: 'Browser surfaces',
        keywords: 'notifications alerts briefings permission allow browser test quiet hours install badge app icon',
        target: '[data-setting="notifications"]',
    },
    {
        id: 'version-history',
        section: 'general',
        label: 'Version history',
        keywords: 'about version history what is new changelog',
        target: '[data-setting="version-history"]',
    },
    // Organize
    {
        id: 'new-folder',
        section: 'organize',
        label: 'New folder',
        keywords: 'organize folder create add',
        target: '[data-setting="new-folder"]',
    },
    {
        id: 'folders',
        section: 'organize',
        label: 'Folders',
        keywords: 'organize folders uncategorized move feeds',
        target: '[data-setting="folders"]',
    },
    // Mute filters
    {
        id: 'add-mute-rule',
        section: 'mute-filters',
        label: 'Add mute rule',
        keywords: 'mute filters add rule hide words',
        target: '[data-setting="add-rule"]',
    },
    {
        id: 'mute-rules',
        section: 'mute-filters',
        label: 'Mute rules',
        keywords: 'mute filters rules list hide words',
        target: '[data-setting="mute-rules"]',
    },
    // Privacy
    {
        id: 'learning-signals',
        section: 'privacy',
        label: 'What the reader learns from',
        keywords: 'privacy learning signals switches',
        target: '[data-setting="signals"]',
    },
    {
        id: 'learned-words',
        section: 'privacy',
        label: 'Learned words',
        keywords: 'privacy learned words weights profile',
        target: '[aria-label="Learned word weights"]',
    },
    {
        id: 'signal-star',
        section: 'privacy',
        label: 'Stars learning',
        keywords: 'privacy learning stars likes',
        target: '#learning-signal-star',
    },
    {
        id: 'signal-open',
        section: 'privacy',
        label: 'Time in an article learning',
        keywords: 'privacy learning open time dwell',
        target: '#learning-signal-open',
    },
    {
        id: 'signal-dwell',
        section: 'privacy',
        label: 'Headline dwell learning',
        keywords: 'privacy learning headline dwell hover',
        target: '#learning-signal-dwell',
    },
    {
        id: 'signal-share',
        section: 'privacy',
        label: 'Shares learning',
        keywords: 'privacy learning shares',
        target: '#learning-signal-share',
    },
    {
        id: 'signal-summary',
        section: 'privacy',
        label: 'AI summaries learning',
        keywords: 'privacy learning ai summaries summarize',
        target: '#learning-signal-summary',
    },
    {
        id: 'signal-original',
        section: 'privacy',
        label: 'Visit original learning',
        keywords: 'privacy learning visit original publisher site',
        target: '#learning-signal-original',
    },
    {
        id: 'signal-derank',
        section: 'privacy',
        label: 'Not interesting learning',
        keywords: 'privacy learning not interesting derank',
        target: '#learning-signal-derank',
    },
    {
        id: 'signal-decay',
        section: 'privacy',
        label: 'Daily decay',
        keywords: 'privacy learning daily decay halve weights',
        target: '#learning-signal-decay',
    },
    {
        id: 'export-profile',
        section: 'privacy',
        label: 'Export learned profile',
        keywords: 'privacy export download profile json',
        target: '[data-action="export"]',
    },
    {
        id: 'forget-profile',
        section: 'privacy',
        label: 'Forget everything',
        keywords: 'privacy forget clear reset learned data',
        target: '[data-action="forget"]',
    },
    {
        id: 'purge-bodies',
        section: 'privacy',
        label: 'Purge old body data',
        keywords: 'privacy storage purge old cold bodies object store articles',
        target: '[data-setting="purge"]',
    },
    // Stats
    {
        id: 'mastery-stats',
        section: 'stats',
        label: 'Mastery stats',
        keywords: 'stats mastery minutes read finish rate streak',
        target: '[data-setting="stats"]',
    },
    {
        id: 'topic-mix',
        section: 'stats',
        label: 'Topic mix',
        keywords: 'stats topic mix subjects read',
        target: '[data-setting="topic-mix"]',
    },
    // Glossary
    {
        id: 'glossary',
        section: 'glossary',
        label: 'Glossary',
        keywords: 'glossary terms vocabulary',
        target: '[data-setting="glossary"]',
    },
    {
        id: 'glossary-search',
        section: 'glossary',
        label: 'Glossary search',
        keywords: 'glossary search filter terms',
        target: '[data-setting="glossary-search"]',
    },
];

/**
 * Every query word must appear in the label or the keywords. Results are
 * ranked so a word at the start of a label beats one only in the keywords,
 * which is what makes "page" find Page size rather than a page of hints.
 */
export function searchSettings(query: string, limit = 8): SettingEntry[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    const matches: Array<{ entry: SettingEntry; score: number }> = [];
    for (const entry of SETTINGS_INDEX) {
        const label = entry.label.toLowerCase();
        const haystack = `${label} ${entry.keywords}`;
        let score = 0;
        let everyTerm = true;
        for (const term of terms) {
            if (!haystack.includes(term)) {
                everyTerm = false;
                break;
            }
            score += label.startsWith(term) ? 3 : label.includes(term) ? 2 : 1;
        }
        if (everyTerm) matches.push({ entry, score });
    }
    matches.sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label));
    return matches.slice(0, limit).map((match) => match.entry);
}
