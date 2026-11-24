import type { View } from '../../types';
import type { SourceListRenderHost } from './source-list-render';
import { openTodayMenuAction } from './source-list-menus';
import { append, el } from './source-list-dom';

function itemClass(host: SourceListRenderHost, view: View): string {
    return host.isActive(view) ? 'item active' : 'item';
}

/** A plain static nav row: one glyph, one label, one navigation target. */
function navRow(
    host: SourceListRenderHost,
    view: View,
    glyph: string,
    label: string,
    hideGlyph: boolean,
): HTMLButtonElement {
    const button = el('button', itemClass(host, view));
    const glyphEl = el('span', 'icon', glyph);
    if (hideGlyph) glyphEl.setAttribute('aria-hidden', 'true');
    append(button, glyphEl, el('span', 'label', label));
    button.addEventListener('click', () => host.select(view));
    return button;
}

function allRow(host: SourceListRenderHost): HTMLButtonElement {
    const view: View = { kind: 'all' };
    const button = el('button', itemClass(host, view));
    append(button, host.icon('all'), el('span', 'label', 'All'));
    if (host.totalUnread > 0) append(button, el('span', 'badge', host.totalUnread));
    button.addEventListener('click', () => host.select(view));
    return button;
}

/** Today carries a menu button, so it is a row with an inner open button. */
function todayRow(host: SourceListRenderHost): HTMLElement {
    const view: View = { kind: 'today' };
    const row = el('div', itemClass(host, view));
    row.addEventListener('click', () => host.select(view));
    const open = el('button', 'item-open');
    open.addEventListener('click', (e) => {
        e.stopPropagation();
        host.select(view);
    });
    append(open, el('span', 'icon', '🗓'), el('span', 'label', 'Today'));
    const menu = el('button', 'menu-btn');
    menu.title = 'Today options';
    append(menu, host.menuIcon());
    menu.addEventListener('click', (e) => openTodayMenuAction(host, e));
    append(row, open, menu);
    return row;
}

export function renderStaticNav(host: SourceListRenderHost): DocumentFragment {
    const fragment = document.createDocumentFragment();
    append(
        fragment,
        allRow(host),
        todayRow(host),
        navRow(host, { kind: 'alerts' }, '🔔', 'Alerts', true),
        navRow(host, { kind: 'frontpage' }, '📰', 'Front Page', false),
        navRow(host, { kind: 'brief' }, '✨', 'Daily Brief', false),
        navRow(host, { kind: 'focus' }, '⏱', 'Focus session', true),
        navRow(host, { kind: 'saved' }, '🔖', 'Saved for later', true),
        navRow(host, { kind: 'listen' }, '🎧', 'Listen queue', true),
        navRow(host, { kind: 'backgrounder' }, '📰', 'Catch me up', true),
        navRow(host, { kind: 'boards' }, '📋', 'Boards', true),
        navRow(host, { kind: 'coverage' }, '⚖', 'Coverage', true),
        navRow(host, { kind: 'health' }, '💚', 'Feed health', true),
    );
    return fragment;
}

/**
 * The one entry to the settings area. The five panels it holds (Organize,
 * Mute filters, Privacy, Stats, Glossary) used to be sidebar rows, ahead of
 * the feeds the reader actually opens.
 */
export function renderSettingsRow(host: SourceListRenderHost): HTMLButtonElement {
    const view: View = { kind: 'settings', section: 'general' };
    const button = el('button', itemClass(host, view));
    const glyph = el('span', 'icon', '\u2699');
    glyph.setAttribute('aria-hidden', 'true');
    append(button, glyph, el('span', 'label', 'Settings'));
    button.addEventListener('click', () => host.select(view));
    return button;
}
