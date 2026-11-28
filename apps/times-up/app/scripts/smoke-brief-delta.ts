// K2 smoke: first visit, new/growing topic deltas, snapshot round-trip, and
// malformed stored snapshots.
import { assert } from './smoke-assert';
import { memoryStorage } from './smoke-storage';
import {
    diffBriefClusters,
    loadBriefClusterSnapshot,
    parseBriefClusterSnapshot,
    saveBriefClusterSnapshot,
} from '../src/services/brief-delta';
import { parseTopicClusters, type TopicCluster } from '../src/services/api-clusters';

function cluster(id: string, memberCount: number): TopicCluster {
    return { id, label: id, memberCount, growthRate: 0, firstSeen: 0, lastSeen: 0 };
}

const store = memoryStorage();
const current = [cluster('new', 2), cluster('growing', 5), cluster('same', 3), cluster('shrunk', 1)];
const first = diffBriefClusters(current, null);
assert(
    first.newClusters.length === 4 && first.growingClusters.length === 0,
    'the first visit treats every topic as new',
);

const previous = { visitedAt: 1, clusters: { growing: 2, same: 3, shrunk: 4, gone: 9 } };
const delta = diffBriefClusters(current, previous);
assert(delta.newClusters.map((c) => c.id).join(',') === 'new', 'only unseen topics are new');
assert(delta.growingClusters.map((c) => c.id).join(',') === 'growing', 'only topics with more members are growing');

saveBriefClusterSnapshot(current, store, 123);
const loaded = loadBriefClusterSnapshot(store);
assert(loaded?.visitedAt === 123 && loaded.clusters['growing'] === 5, 'the snapshot round-trips');
assert(parseBriefClusterSnapshot('{') === null, 'malformed snapshot JSON is rejected');
assert(parseBriefClusterSnapshot('null') === null, 'null snapshots are rejected');
assert(
    parseBriefClusterSnapshot('{"visitedAt":1,"clusters":{"a":-2}}')?.clusters['a'] === undefined,
    'invalid counts are dropped',
);

const parsed = parseTopicClusters({ clusters: [current[0], null, { id: 'bad' }] });
assert(parsed.length === 1, 'only complete cluster rows survive response parsing');
assert(parseTopicClusters(null).length === 0, 'a null cluster response yields no topics');

console.log('ok: brief overnight cluster delta');
