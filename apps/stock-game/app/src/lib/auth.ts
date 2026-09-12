import {authorizeUrl, challengeS256, parseJwtPayload, randomVerifier} from 'user-client'

const CLIENT_ID = 'stock-game'
const TOKENS_KEY = 'sg.auth.tokens'
const VERIFIER_KEY = 'sg.auth.verifier'
const STATE_KEY = 'sg.auth.state'

export interface AuthTokens {
    access: string
    refresh: string
    exp: number
}

function identityBase(): string {
    return `${location.origin}/user-api`
}

function tokenEndpoint(): string {
    return `${identityBase()}/oauth/token`
}

export function redirectUri(): string {
    return new URL(import.meta.env.BASE_URL, location.origin).toString()
}

export function isTokenFresh(exp: number, nowSec: number = Date.now() / 1000): boolean {
    return exp - nowSec > 60
}

function loadTokens(): AuthTokens | null {
    try {
        const raw = localStorage.getItem(TOKENS_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<AuthTokens>
        if (typeof parsed.access !== 'string' || typeof parsed.refresh !== 'string') return null
        if (typeof parsed.exp !== 'number') return null
        return {access: parsed.access, refresh: parsed.refresh, exp: parsed.exp}
    } catch {
        return null
    }
}

function storeTokens(tokens: AuthTokens): void {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
}

function clearTokens(): void {
    localStorage.removeItem(TOKENS_KEY)
}

function toTokens(body: unknown): AuthTokens | null {
    if (typeof body !== 'object' || body === null) return null
    const {access_token: access, refresh_token: refresh, expires_in: expiresIn} = body as Record<string, unknown>
    if (typeof access !== 'string' || typeof refresh !== 'string') return null
    if (typeof expiresIn !== 'number') return null
    return {access, refresh, exp: Math.floor(Date.now() / 1000) + expiresIn}
}

async function postToken(form: Record<string, string>): Promise<AuthTokens | null> {
    const res = await fetch(tokenEndpoint(), {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams(form),
    })
    if (!res.ok) return null
    return toTokens((await res.json()) as unknown)
}

export function hasSession(): boolean {
    return loadTokens() !== null
}

export function currentUsername(): string | null {
    const tokens = loadTokens()
    if (!tokens) return null
    const name = parseJwtPayload(tokens.access)?.['preferred_username']
    return typeof name === 'string' ? name : null
}

export async function startLogin(): Promise<void> {
    const verifier = randomVerifier()
    const state = randomVerifier(32)
    sessionStorage.setItem(VERIFIER_KEY, verifier)
    sessionStorage.setItem(STATE_KEY, state)
    location.assign(
        authorizeUrl({
            authorizeEndpoint: `${identityBase()}/oauth/authorize`,
            clientId: CLIENT_ID,
            redirectUri: redirectUri(),
            challenge: await challengeS256(verifier),
            state,
        }),
    )
}

function takeCallbackParams(): { code: string; state: string } | null {
    const params = new URLSearchParams(location.search)
    const code = params.get('code')
    const state = params.get('state')
    if (!code || !state) return null
    history.replaceState(null, '', redirectUri())
    return {code, state}
}

export async function finishLoginFromCallback(): Promise<boolean> {    const params = takeCallbackParams()
    if (!params) return false
    const expected = sessionStorage.getItem(STATE_KEY)
    const verifier = sessionStorage.getItem(VERIFIER_KEY)
    sessionStorage.removeItem(STATE_KEY)
    sessionStorage.removeItem(VERIFIER_KEY)
    if (!expected || expected !== params.state || !verifier) {
        throw new Error('Sign-in reply did not match this browser session. Try signing in again.')
    }
    const tokens = await postToken({
        grant_type: 'authorization_code',
        code: params.code,
        client_id: CLIENT_ID,
        redirect_uri: redirectUri(),
        code_verifier: verifier,
    })
    if (!tokens) throw new Error('Sign-in was refused. Try signing in again.')
    storeTokens(tokens)
    return true
}

export async function refreshTokens(): Promise<AuthTokens | null> {
    if (!inflightRefresh) {
        inflightRefresh = doRefresh().finally(() => {
            inflightRefresh = null
        })
    }
    return inflightRefresh
}

async function doRefresh(): Promise<AuthTokens | null> {
    const current = loadTokens()
    if (!current) return null
    const epoch = sessionEpoch
    const next = await postToken({grant_type: 'refresh_token', refresh_token: current.refresh})
    if (epoch !== sessionEpoch) return null
    if (!next) {
        if (loadTokens()?.refresh === current.refresh) clearTokens()
        return null
    }
    storeTokens(next)
    return next
}

let inflightRefresh: Promise<AuthTokens | null> | null = null

export async function getAccessToken(): Promise<string | null> {
    const current = loadTokens()
    if (!current) return null
    if (isTokenFresh(current.exp)) return current.access
    return (await refreshTokens())?.access ?? null
}

export function logout(): void {
    clearTokens()
    sessionEpoch += 1
}

let sessionEpoch = 0
