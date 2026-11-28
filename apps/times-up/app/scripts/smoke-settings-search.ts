// Settings search smoke: the index and its ranking. The component test mounts
// the page; this pins the pure matching, which is where a typo in a keyword
// list or a duplicated id shows up.
import { SETTINGS_INDEX, searchSettings } from '../src/web-components/settings-view/settings-index';
import { assert } from './smoke-assert';

// ---- the index is well formed ----
{
    const ids = new Set<string>();
    const sections = new Set(['general', 'organize', 'mute-filters', 'privacy', 'stats', 'glossary']);
    for (const entry of SETTINGS_INDEX) {
        assert(!ids.has(entry.id), `setting id ${entry.id} is unique`);
        ids.add(entry.id);
        assert(sections.has(entry.section), `${entry.id} names a real settings tab`);
        assert(entry.label.length > 0, `${entry.id} has a label`);
        assert(
            entry.target.startsWith('#') || entry.target.startsWith('['),
            `${entry.id} targets an id or an attribute selector`,
        );
        assert(entry.keywords === entry.keywords.toLowerCase(), `${entry.id} keywords are lowercase`);
    }
}

// ---- matching ----
{
    assert(searchSettings('').length === 0, 'an empty query matches nothing');
    assert(searchSettings('   ').length === 0, 'a blank query matches nothing');
    assert(searchSettings('zzzz').length === 0, 'an unknown word matches nothing');

    const font = searchSettings('reader font');
    assert(font.length > 0 && font[0]!.id === 'reader-font', '"reader font" finds the reader font control');
    assert(searchSettings('page size').length === 0, 'per-view list controls are not in the settings index');

    const dark = searchSettings('dark');
    assert(
        dark.some((entry) => entry.id === 'theme-dark'),
        '"dark" finds the dark theme',
    );
    assert(
        dark.some((entry) => entry.id === 'theme-oled'),
        '"dark" finds the lights-out theme',
    );

    const mastodon = searchSettings('mastodon');
    assert(mastodon[0]!.id === 'mastodon-host', 'a word at the start of a label outranks one buried in keywords');

    assert(
        searchSettings('notifications').some((entry) => entry.id === 'notification-permission'),
        '"notifications" finds the permission control',
    );

    assert(
        searchSettings('quiet hours').some((entry) => entry.id === 'notification-permission'),
        '"quiet hours" finds the shared quiet-hours control',
    );

    assert(
        searchSettings('forget').some((entry) => entry.id === 'forget-profile'),
        '"forget" finds the forget control',
    );
    assert(
        searchSettings('glossary filter').some((entry) => entry.id === 'glossary-search'),
        'two words must both match',
    );

    // Every tab owns at least one entry, so the search is not a shortcut for
    // one panel.
    for (const section of ['general', 'organize', 'mute-filters', 'privacy', 'stats', 'glossary']) {
        assert(
            SETTINGS_INDEX.some((entry) => entry.section === section),
            `the index has a setting on the ${section} tab`,
        );
    }

    assert(searchSettings('theme', 1).length === 1, 'the limit is honoured');
}
