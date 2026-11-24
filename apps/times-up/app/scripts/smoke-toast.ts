// Toast notice smoke: the pub/sub store behind user-facing API errors.
import { AuthError } from '../src/services/api';
import {
    clearToasts,
    dismissToast,
    onToast,
    toastApiError,
    toastError,
    toastInfo,
    type ToastNotice,
} from '../src/services/toast';
import { assert } from './smoke-assert';

// Earlier phases exercise failing mutations, which now emit notices into the
// shared store. Start clean so this phase asserts its own emissions only;
// the suite must stay order-independent.
clearToasts();

function lastText(seen: ToastNotice[][]): string | undefined {
    const batch = seen.at(-1) ?? [];
    return batch.at(-1)?.message;
}

function lastCount(seen: ToastNotice[][]): number {
    return seen.at(-1)?.length ?? 0;
}

const seen: ToastNotice[][] = [];
const unsubscribe = onToast((notices) => {
    seen.push(notices);
});
toastError('first');
assert(lastCount(seen) === 1 && lastText(seen) === 'first', 'subscriber receives the emitted notice');
const firstId = seen.at(-1)?.at(0)?.id;
assert(typeof firstId === 'number', 'notices carry numeric ids');
toastError('second');
assert(lastCount(seen) === 2, 'notices accumulate');
if (firstId !== undefined) dismissToast(firstId);
assert(lastCount(seen) === 1 && lastText(seen) === 'second', 'dismiss removes one notice by id');
dismissToast(424242);
assert(lastCount(seen) === 1, 'dismissing an unknown id notifies nobody');
unsubscribe();
toastError('third');
assert(lastCount(seen) === 1, 'an unsubscribed listener hears nothing more');

clearToasts();
const capped: ToastNotice[][] = [];
const stopCapped = onToast((notices) => {
    capped.push(notices);
});
toastError('a');
toastError('b');
toastError('c');
toastError('d');
assert(lastCount(capped) === 3 && lastText(capped) === 'd', 'the notice list caps at three, newest kept');
stopCapped();

clearToasts();
const gated: ToastNotice[][] = [];
const stopGated = onToast((notices) => {
    gated.push(notices);
});
toastApiError(new AuthError(), 'auth trouble');
assert(lastCount(gated) === 0, 'auth errors do not toast (sign-out owns that surface)');
toastApiError(new Error('boom'), 'api trouble');
assert(lastCount(gated) === 1 && lastText(gated) === 'api trouble', 'non-auth API errors toast');
stopGated();
clearToasts();

const info: ToastNotice[][] = [];
const stopInfo = onToast((notices) => {
    info.push(notices);
});
toastInfo('working on it');
assert(lastCount(info) === 1 && lastText(info) === 'working on it', 'info notices emit like errors');
assert(info.at(-1)?.at(-1)?.kind === 'info', 'info notices carry their kind');
stopInfo();
clearToasts();
