// B7 smoke: cluster-member response validation keeps malformed rows out of the UI.
import { assert } from './smoke-assert';
import { parseClusterMembers } from '../src/services/api-clusters';

const valid = { id: 'a1', title: 'A source', feedId: 'f1', publishedAt: 123 };
assert(parseClusterMembers({ items: [valid, null, { id: 'bad' }] }).length === 1, 'only complete member rows survive');
assert(parseClusterMembers({ items: [] }).length === 0, 'an empty cluster has no members');
assert(parseClusterMembers(null).length === 0, 'a null response yields no members');
assert(parseClusterMembers({ items: 'nope' }).length === 0, 'a malformed response yields no members');

console.log('ok: cluster member response validation');
