// Auth smoke: Authorization headers on feed fetches, Lemmy/PieFed login flows.
import { ApiError, fetchPosts, loginLemmy } from '../src/services/lemmy';
import { loginPiefed } from '../src/services/piefed';
import {
    assert,
    assertRejects,
    capturingAuthFetchImpl,
    lastBody,
    lastHeaders,
    lastRequestDetails,
    query,
} from './smoke-helpers';

// ---- auth headers on feed fetches ----

export async function runAuthHeaderTests(): Promise<void> {
    await fetchPosts(
        { instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 1, limit: 20, auth: 'tok123' },
        capturingAuthFetchImpl({ posts: [] }),
    );
    assert(lastHeaders().get('Authorization') === 'Bearer tok123', 'logged-in feed sends Authorization header');
    await fetchPosts(
        { instance: 'lemmy.ml', feedType: 'All', sort: 'Hot', page: 1, limit: 20 },
        capturingAuthFetchImpl({ posts: [] }),
    );
    assert(lastHeaders().get('Authorization') === null, 'anonymous feed sends no Authorization header');
    await fetchPosts(
        { instance: 'lemmy.ml', feedType: 'Subscribed', sort: 'Hot', page: 1, limit: 20, auth: 'tok123' },
        capturingAuthFetchImpl({ posts: [] }),
    );
    assert(query().get('type_') === 'Subscribed', 'Subscribed listing forwarded as type_');
}

// ---- login ----

export async function runLoginTests(): Promise<void> {
    const lemmyLogin = await loginLemmy(
        'lemmy.ml',
        'bob',
        'secret',
        undefined,
        capturingAuthFetchImpl({ jwt: 'jwtA' }),
    );
    assert(lastRequestDetails!.method === 'POST', 'login uses POST');
    assert(new URL(lastRequestDetails!.url).pathname === '/api/v3/user/login', 'lemmy login hits user/login');
    assert(lastHeaders().get('Authorization') === null, 'login itself sends no auth header');
    const loginBody = lastBody();
    assert(
        loginBody['username_or_email'] === 'bob' && loginBody['password'] === 'secret',
        'login body carries username and password',
    );
    assert(loginBody['stay_logged_in'] === true, 'lemmy login stays logged in');
    assert(lemmyLogin.jwt === 'jwtA' && lemmyLogin.username === 'bob', 'lemmy login returns session');

    await loginLemmy('lemmy.ml', 'bob', 'secret', '123456', capturingAuthFetchImpl({ jwt: 'jwtB' }));
    assert(lastBody()['totp_2fa_token'] === '123456', 'totp token forwarded when provided');

    const objJwt = await loginLemmy(
        'lemmy.ml',
        'bob',
        'secret',
        undefined,
        capturingAuthFetchImpl({ jwt: { jwt: 'jwtC', registration_created: false } }),
    );
    assert(objJwt.jwt === 'jwtC', 'object-shaped jwt parsed');

    await assertRejects(
        () =>
            loginLemmy('lemmy.ml', 'bob', 'secret', undefined, capturingAuthFetchImpl({ registration_created: true })),
        (e) => e instanceof ApiError && /approved/.test(e.message),
        'pending registration surfaces as an ApiError',
    );
    await assertRejects(
        () => loginLemmy('lemmy.ml', 'bob', 'secret', undefined, capturingAuthFetchImpl({ verify_email_sent: true })),
        (e) => e instanceof ApiError && /email/i.test(e.message),
        'unverified email surfaces as an ApiError',
    );
    await assertRejects(
        () => loginLemmy('lemmy.ml', 'bob', 'secret', undefined, capturingAuthFetchImpl({})),
        (e) => e instanceof ApiError && e.status === 401 && /username and password/.test(e.message),
        'missing jwt maps to bad credentials',
    );
    await assertRejects(
        () =>
            loginLemmy(
                'lemmy.ml',
                'bob',
                'wrong',
                undefined,
                capturingAuthFetchImpl({ error: 'incorrect_password' }, 401),
            ),
        (e) => e instanceof ApiError && e.status === 401,
        'login 401 keeps the status',
    );

    const piefedLogin = await loginPiefed('piefed.social', 'bob', 'secret', capturingAuthFetchImpl({ jwt: 'pjwt' }));
    assert(new URL(lastRequestDetails!.url).pathname === '/api/alpha/user/login', 'piefed login hits alpha user/login');
    assert(lastBody()['username_or_email'] === 'bob', 'piefed login accepts username_or_email');
    assert(piefedLogin.jwt === 'pjwt' && piefedLogin.username === 'bob', 'piefed login returns session');
}
