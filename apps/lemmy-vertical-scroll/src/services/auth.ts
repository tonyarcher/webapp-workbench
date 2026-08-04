import type {AuthSession, Software} from '../types'
import {loginLemmy} from './lemmy'
import type {LoginResult} from './lemmy'
import {loginPiefed} from './piefed'

/**
 * Logs into the current instance's software and returns a session to persist.
 * The password is sent once over HTTPS and never stored anywhere.
 */
export async function login(
    instance: string,
    software: Software,
    usernameOrEmail: string,
    password: string,
    totpToken?: string,
): Promise<AuthSession> {
    const result: LoginResult =
        software === 'piefed'
            ? await loginPiefed(instance, usernameOrEmail, password)
            : await loginLemmy(instance, usernameOrEmail, password, totpToken)
    return {jwt: result.jwt, username: result.username}
}
