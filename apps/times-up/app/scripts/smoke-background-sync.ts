// S6 smoke: register both background-sync APIs when available, wake the tab's
// foreground loop from a worker message, and unregister on sign-out.
import { assert } from './smoke-assert';
import { startBackgroundSync, stopBackgroundSync } from '../src/services/background-sync';

type Listener = (event: MessageEvent) => void;

const registrations: string[] = [];
const unregistrations: string[] = [];
const events: string[] = [];
let registrationGate: Promise<void> | null = null;
let periodicInterval = 0;
let listener: Listener | null = null;
let wakes = 0;

const registration = {
    sync: {
        register: async (tag: string) => {
            registrations.push(tag);
            events.push(`register:${tag}`);
        },
        unregister: async (tag: string) => {
            unregistrations.push(tag);
            events.push(`unregister:${tag}`);
            return true;
        },
    },
    periodicSync: {
        register: async (tag: string, options: { minInterval: number }) => {
            registrations.push(tag);
            events.push(`register:${tag}`);
            periodicInterval = options.minInterval;
        },
        unregister: async (tag: string) => {
            unregistrations.push(tag);
            events.push(`unregister:${tag}`);
            return true;
        },
    },
};

const serviceWorker = {
    getRegistration: async () => {
        if (registrationGate) await registrationGate;
        return registration;
    },
    addEventListener: (_type: string, next: Listener) => {
        listener = next;
    },
    removeEventListener: (_type: string, next: Listener) => {
        if (listener === next) listener = null;
    },
};

const globals = globalThis as Record<string, unknown>;
const priorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
Object.defineProperty(globalThis, 'navigator', { value: { serviceWorker }, configurable: true });
Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });

await startBackgroundSync(() => {
    wakes += 1;
});
assert(registrations.includes('times-up-sync'), 'one-off sync is registered');
assert(registrations.includes('times-up-periodic'), 'periodic sync is registered');
assert(periodicInterval === 12 * 60 * 60 * 1000, 'periodic sync uses the documented interval');
const dispatch: Listener | null = listener as Listener | null;
if (!dispatch) throw new Error('worker wake listener missing');
console.log('ok: the tab listens for worker wakes');

dispatch(new MessageEvent('message', { data: { type: 'times-up:background-sync' } }));
assert(wakes === 1, 'a worker wake triggers the foreground sync');
dispatch(new MessageEvent('message', { data: { type: 'something-else' } }));
assert(wakes === 1, 'unrelated messages do not trigger a sync');

const before = registrations.length;
await startBackgroundSync(() => {
    wakes += 1;
});
assert(registrations.length === before, 'starting twice does not register twice');

await stopBackgroundSync();
assert(unregistrations.includes('times-up-sync'), 'one-off sync is removed on sign-out');
assert(unregistrations.includes('times-up-periodic'), 'periodic sync is removed on sign-out');
assert(listener === null, 'the message listener is removed');

// Sign-out during an in-flight registration must still unregister last.
let release!: () => void;
registrationGate = new Promise<void>((resolve) => {
    release = resolve;
});
const starting = startBackgroundSync(() => {});
const stopping = stopBackgroundSync();
release();
await Promise.all([starting, stopping]);
registrationGate = null;
assert(
    events.slice(-2).every((event) => event.startsWith('unregister:')),
    'sign-out unregisters after an in-flight start',
);
assert(listener === null, 'an interleaved sign-out leaves no listener');

Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
await startBackgroundSync(() => {});
assert(listener === null, 'an unsupported browser degrades quietly');

if (priorNavigator) Object.defineProperty(globalThis, 'navigator', priorNavigator);
else delete globals['navigator'];
if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow);
else delete globals['window'];

console.log('ok: background sync registration, wake, and teardown');
