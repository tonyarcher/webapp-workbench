// Folder order smoke: moving a folder in Organize must swap with its neighbour
// and never invent a row or drift out of range.
import { movedFolderOrder } from '../src/web-components/organize-view/organize-view-helpers';
import { assert } from './smoke-assert';

const ids = ['a', 'b', 'c'];

assert(movedFolderOrder(ids, 0, 1).join('') === 'bac', 'move first folder down');
assert(movedFolderOrder(ids, 2, -1).join('') === 'acb', 'move last folder up');
assert(movedFolderOrder(ids, 1, 1).join('') === 'acb', 'move middle folder down');
assert(movedFolderOrder(ids, 1, -1).join('') === 'bac', 'move middle folder up');
assert(movedFolderOrder(ids, 0, -1).join('') === 'abc', 'moving above the first is a no-op');
assert(movedFolderOrder(ids, 2, 1).join('') === 'abc', 'moving below the last is a no-op');
assert(movedFolderOrder(ids, 9, 1).join('') === 'abc', 'an out-of-range index is a no-op');
assert(movedFolderOrder(ids, 0, 1) !== ids, 'a move returns a new array');
