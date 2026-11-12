// Shortcuts smoke: the single-key tables the list, the overlay, and the
// cheatsheet all read from, so a key cannot work without being documented.
import { LIST_SHORTCUTS_HELP, OVERLAY_SHORTCUTS_HELP, listShortcut, overlayShortcut } from '../src/services/shortcuts';
import { assert } from './smoke-assert';

// ---- the list table ----
const listCases: Array<[string, ReturnType<typeof listShortcut>]> = [
    ['s', 'star'],
    ['u', 'unread'],
    ['r', 'refresh'],
    ['1', 'view-detailed'],
    ['2', 'view-headline'],
    ['3', 'view-cards'],
    ['x', 'select'],
    ['?', 'help'],
];
for (const [key, action] of listCases) {
    assert(listShortcut(key) === action, `list key ${key} maps to ${action}`);
}
assert(listShortcut('j') === null, 'cursor keys stay out of the shortcut table');
assert(listShortcut('k') === null, 'cursor keys stay out of the shortcut table');
assert(listShortcut('Escape') === null, 'unknown list keys map to nothing');

// ---- the overlay table ----
assert(overlayShortcut('s') === 'star', 'overlay s stars');
assert(overlayShortcut('d') === 'derank', 'overlay d deranks');
assert(overlayShortcut('o') === 'original', 'overlay o opens the original');
assert(overlayShortcut('?') === 'help', 'overlay ? opens the cheatsheet');
assert(overlayShortcut('r') === null, 'refresh is list-only');

// ---- modal dialogs silence every shortcut ----
{
    const { isModalOpen, modalClosed, modalOpened } = await import('../src/services/modal-guard');
    assert(isModalOpen() === false, 'no modal is open by default');
    modalOpened();
    assert(isModalOpen() === true, 'an open dialog suppresses shortcuts');
    modalOpened();
    modalClosed();
    assert(isModalOpen() === true, 'nested dialogs stack instead of cancelling out');
    modalClosed();
    assert(isModalOpen() === false, 'the last close re-arms shortcuts');
    modalClosed();
    assert(isModalOpen() === false, 'extra closes clamp at zero');
}

// ---- the cheatsheet documents every mapped action ----
const listed = new Set(listCases.map(([, action]) => action));
assert(LIST_SHORTCUTS_HELP.length >= listed.size, 'the list cheatsheet covers every mapped list action');
assert(
    OVERLAY_SHORTCUTS_HELP.some((row) => row.keys.includes('?')),
    'the overlay cheatsheet documents the help key',
);
