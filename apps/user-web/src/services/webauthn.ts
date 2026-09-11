function b64urlToBytes(value: string): Uint8Array {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/')
        + '='.repeat((4 - (value.length % 4)) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function bytesToB64url(bytes: ArrayBuffer): string {
    const arr = new Uint8Array(bytes);
    let bin = '';
    for (const b of arr) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function b64urlRoundTrip(value: string): string {
    return bytesToB64url(copyBuffer(b64urlToBytes(value)));
}

export function decodeCreateOptions(options: unknown): CredentialCreationOptions {
    if (typeof options !== 'object' || options === null) {
        throw new Error('invalid create options');
    }
    const clone = structuredClone(options) as CredentialCreationOptions;
    const pk = clone.publicKey;
    if (!pk) throw new Error('missing publicKey');
    pk.challenge = toBuffer(pk.challenge);
    if (pk.user) pk.user.id = toBuffer(pk.user.id);
    pk.excludeCredentials = (pk.excludeCredentials ?? []).map((c) => ({...c, id: toBuffer(c.id)}));
    return clone;
}

export function decodeRequestOptions(options: unknown): CredentialRequestOptions {
    if (typeof options !== 'object' || options === null) {
        throw new Error('invalid request options');
    }
    const clone = structuredClone(options) as CredentialRequestOptions;
    const pk = clone.publicKey;
    if (!pk) throw new Error('missing publicKey');
    pk.challenge = toBuffer(pk.challenge);
    pk.allowCredentials = (pk.allowCredentials ?? []).map((c) => ({...c, id: toBuffer(c.id)}));
    return clone;
}

export function credentialToJson(cred: PublicKeyCredential): Record<string, unknown> {
    const att = cred.response as AuthenticatorAttestationResponse;
    const assn = cred.response as AuthenticatorAssertionResponse;
    const response: Record<string, unknown> = {
        clientDataJSON: bytesToB64url(cred.response.clientDataJSON),
    };
    if (att.attestationObject) response.attestationObject = bytesToB64url(att.attestationObject);
    if (assn.authenticatorData) response.authenticatorData = bytesToB64url(assn.authenticatorData);
    if (assn.signature) response.signature = bytesToB64url(assn.signature);
    if (assn.userHandle) response.userHandle = bytesToB64url(assn.userHandle);
    return {
        type: cred.type,
        id: cred.id,
        rawId: bytesToB64url(cred.rawId),
        response,
        clientExtensionResults: cred.getClientExtensionResults(),
    };
}

function toBuffer(value: BufferSource | string): ArrayBuffer {
    if (typeof value === 'string') return copyBuffer(b64urlToBytes(value));
    if (value instanceof ArrayBuffer) return value;
    return copyBuffer(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
}

function copyBuffer(bytes: Uint8Array): ArrayBuffer {
    const out = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(out).set(bytes);
    return out;
}
