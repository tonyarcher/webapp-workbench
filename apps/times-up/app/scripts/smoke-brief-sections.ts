// K3 smoke: briefing section expansion persists locally and toggles cleanly.
import { assert } from './smoke-assert';
import { memoryStorage } from './smoke-storage';
import {
    loadExpandedBriefSections,
    saveExpandedBriefSections,
    toggleBriefSection,
} from '../src/services/brief-section-state';

const store = memoryStorage();
assert(loadExpandedBriefSections(store).size === 0, 'sections start collapsed');
const opened = toggleBriefSection(new Set(), 's1');
saveExpandedBriefSections(opened, store);
assert(loadExpandedBriefSections(store).has('s1'), 'an opened section persists');
const closed = toggleBriefSection(opened, 's1');
assert(!closed.has('s1'), 'toggling again closes the section');
saveExpandedBriefSections(closed, store);
assert(loadExpandedBriefSections(store).size === 0, 'closed state persists');

store.setItem('times-up:brief-expanded-sections', '{');
assert(loadExpandedBriefSections(store).size === 0, 'malformed expansion JSON falls back to collapsed');
store.setItem('times-up:brief-expanded-sections', JSON.stringify(['s1', null, 2, 's2']));
const valid = loadExpandedBriefSections(store);
assert(valid.size === 2 && valid.has('s1') && valid.has('s2'), 'only string section ids survive');

console.log('ok: brief section expansion state');
