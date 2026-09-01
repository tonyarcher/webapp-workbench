export type AiAvailability = 'readily' | 'after-download' | 'no' | 'unsupported';

interface AiSession {
    prompt(text: string): Promise<string> | ReadableStream;

    destroy(): void;
}

interface AiCreator {
    capabilities?: () => Promise<{ available?: string }>;
    create: (opts?: { systemPrompt?: string }) => Promise<AiSession>;
}

interface LanguageModelGlobal {
    availability?: (opts?: unknown) => Promise<string>;
    create: (opts?: {
        initialPrompts?: Array<{ role: string; content: string }>;
    }) => Promise<AiSession>;
}

type AiWindow = {
    LanguageModel?: LanguageModelGlobal;
    model?: AiCreator;
    ai?: {
        languageModel?: AiCreator;
        canCreateTextSession?: () => Promise<string>;
        createTextSession?: (opts?: { systemPrompt?: string }) => Promise<AiSession>;
    };
};

const aiWindow = globalThis as unknown as AiWindow;

function languageModel(): LanguageModelGlobal | undefined {
    return aiWindow.LanguageModel;
}

function hasCreator(): boolean {
    return Boolean(
        typeof languageModel()?.create === 'function' ||
        aiWindow.model?.create ||
        aiWindow.ai?.languageModel?.create ||
        typeof aiWindow.ai?.createTextSession === 'function',
    );
}

/** Human-readable guidance for each availability state. */
export function aiStatusMessage(status: AiAvailability): string {
    switch (status) {
        case 'readily':
            return '';
        case 'after-download':
            return 'The on-device model is still downloading in Chrome â€” it will be ready in a moment. Try again shortly.';
        case 'no':
            return 'On-device AI is not available on this device or Chrome profile. Check chrome://on-device-internals and chrome://components (Gemma / Gemini Nano).';
        case 'unsupported':
        default:
            return 'AI is not available on this page. Chromeâ€™s on-device Prompt API (`LanguageModel`) is separate from the cloud â€œAsk Geminiâ€ button and from models listed in chrome://components. The API is only exposed in a secure context (https:// or http://localhost) in Chrome 138+, with chrome://flags/#optimization-guide-on-device-model and chrome://flags/#prompt-api-for-gemini-nano enabled. Open this app on localhost or HTTPS, then run `await LanguageModel.availability()` in DevTools.';
    }
}

export interface AiDiagnostics {
    available: AiAvailability;
    hasLanguageModelGlobal: boolean;
    hasModelApi: boolean;
    hasAiApi: boolean;
    hasLanguageModelApi: boolean;
    capabilitiesValue?: string;
    hasCreator: boolean;
    isLocalhost: boolean;
    isSecureContext: boolean;
    origin: string;
}

const env = globalThis as unknown as {
    location?: { hostname?: string; origin?: string };
    isSecureContext?: boolean;
};

/**
 * Reports what Chrome actually exposes so users can debug why the on-device
 * model isn't available (flag / origin / download state).
 */
async function readCaps(fn?: AiCreator['capabilities']): Promise<string | undefined> {
    if (!fn) return undefined;
    try {
        return (await fn())?.available;
    } catch {
        return undefined;
    }
}

function localhostFlag(hostname: string): boolean {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.local');
}

async function lmAvailability(): Promise<string | undefined> {
    const lm = languageModel();
    if (typeof lm?.availability !== 'function') return undefined;
    try {
        return await lm.availability();
    } catch {
        return undefined;
    }
}

async function capsValue(): Promise<string | undefined> {
    const lmAv = await lmAvailability();
    if (lmAv) return lmAv;
    const a = await readCaps(aiWindow.model?.capabilities);
    if (a) return a;
    return (await readCaps(aiWindow.ai?.languageModel?.capabilities)) ?? undefined;
}

export async function aiDiagnostics(): Promise<AiDiagnostics> {
    const hostname = env.location?.hostname ?? '';
    const lm = languageModel();
    return {
        available: await aiAvailability(),
        hasLanguageModelGlobal: Boolean(lm),
        hasModelApi: Boolean(aiWindow.model),
        hasAiApi: Boolean(aiWindow.ai),
        hasLanguageModelApi: Boolean(aiWindow.ai?.languageModel),
        capabilitiesValue: await capsValue(),
        hasCreator: hasCreator(),
        isLocalhost: localhostFlag(hostname),
        isSecureContext: env.isSecureContext ?? false,
        origin: env.location?.origin ?? hostname,
    };
}

function normalizeAvailability(value: string | undefined): AiAvailability {
    if (value === 'readily' || value === 'available') return 'readily';
    if (value === 'after-download' || value === 'downloadable' || value === 'downloading') {
        return 'after-download';
    }
    if (value === 'no' || value === 'unavailable') return 'no';
    return 'unsupported';
}

let cachedAvailability: AiAvailability | undefined;

function setAvailability(value: AiAvailability): AiAvailability {
    // 'after-download' is transient â€” re-probe on the next call instead of
    // caching it forever, so the UI can retry once the model finishes.
    if (value !== 'after-download') cachedAvailability = value;
    return value;
}

/** Clears the cached availability probe (used by tests). */
export function resetAiAvailability() {
    cachedAvailability = undefined;
}

async function probeCreatorAvailability(
    available: string | undefined,
): Promise<AiAvailability> {
    const status = normalizeAvailability(available);
    if (status === 'readily' && !hasCreator()) return setAvailability('unsupported');
    return setAvailability(status);
}

async function probeLm(): Promise<AiAvailability | undefined> {
    const lm = languageModel();
    if (typeof lm?.availability !== 'function') return undefined;
    try {
        return await probeCreatorAvailability(await lm.availability());
    } catch {
        return setAvailability('unsupported');
    }
}

async function probeModel(): Promise<AiAvailability | undefined> {
    const model = aiWindow.model;
    if (!model?.capabilities) return undefined;
    try {
        const result = await model.capabilities();
        return await probeCreatorAvailability(result?.available);
    } catch {
        return setAvailability('unsupported');
    }
}

async function probeAiLm(): Promise<AiAvailability | undefined> {
    const api = aiWindow.ai?.languageModel;
    if (!api?.capabilities) return undefined;
    try {
        const result = await api.capabilities();
        return await probeCreatorAvailability(result?.available);
    } catch {
        return setAvailability('unsupported');
    }
}

async function probeLegacy(): Promise<AiAvailability | undefined> {
    const legacy = aiWindow.ai;
    if (!legacy || typeof legacy.createTextSession !== 'function') return undefined;
    try {
        const status = legacy.canCreateTextSession ? await legacy.canCreateTextSession() : 'readily';
        return setAvailability(normalizeAvailability(status));
    } catch {
        return setAvailability('unsupported');
    }
}

export async function aiAvailability(): Promise<AiAvailability> {
    if (cachedAvailability) return cachedAvailability;
    const a = await probeLm();
    if (a) return a;
    const b = await probeModel();
    if (b) return b;
    const c = await probeAiLm();
    if (c) return c;
    const d = await probeLegacy();
    if (d) return d;
    return setAvailability('unsupported');
}

async function lmCreator(prompt?: string): Promise<AiSession | undefined> {
    const lm = languageModel();
    if (typeof lm?.create === 'function') return lm.create(prompt ? {initialPrompts: [{role: 'system', content: prompt}]} : undefined);
    return undefined;
}

async function modelCreator(prompt?: string): Promise<AiSession | undefined> {
    if (aiWindow.model?.create) return aiWindow.model.create({systemPrompt: prompt});
    return undefined;
}

async function aiLmCreator(prompt?: string): Promise<AiSession | undefined> {
    if (aiWindow.ai?.languageModel?.create) return aiWindow.ai.languageModel.create({systemPrompt: prompt});
    return undefined;
}

async function legacyCreator(prompt?: string): Promise<AiSession | undefined> {
    if (aiWindow.ai?.createTextSession) return aiWindow.ai.createTextSession({systemPrompt: prompt});
    return undefined;
}

async function tryCreators(systemPrompt?: string): Promise<AiSession | undefined> {
    const a = await lmCreator(systemPrompt);
    if (a) return a;
    const b = await modelCreator(systemPrompt);
    if (b) return b;
    const c = await aiLmCreator(systemPrompt);
    if (c) return c;
    return legacyCreator(systemPrompt);
}

async function createAiSession(systemPrompt?: string): Promise<AiSession> {
    const s = await tryCreators(systemPrompt);
    if (s) return s;
    const status = await aiAvailability();
    throw new Error(aiStatusMessage(status));
}

async function resolvePrompt(result: string | ReadableStream): Promise<string> {
    if (typeof result === 'string') return result;
    const reader = result.getReader();
    const decoder = new TextDecoder();
    let out = '';
    for (; ;) {
        const {done, value} = await reader.read();
        if (done) break;
        out += decoder.decode(value, {stream: true});
    }
    return out + decoder.decode();
}

/**
 * Runs a text prompt through Chrome's built-in on-device language model.
 * Throws if the model is unavailable.
 */
export async function runAiPrompt(prompt: string, systemPrompt?: string): Promise<string> {
    const session = await createAiSession(systemPrompt);
    try {
        return await resolvePrompt(await session.prompt(prompt));
    } finally {
        try {
            session.destroy();
        } catch {
            // ignore teardown errors
        }
    }
}

/** Summarizes an article body into concise bullets. */
export async function summarizeArticle(title: string, body: string): Promise<string> {
    const systemPrompt =
        'You summarize news articles concisely and neutrally. Never invent facts.';
    const prompt = [
        `Summarize the following article in 4-6 short bullet points.`,
        `Write in the same language as the article itself.`,
        `Include the key facts, any notable figures, and the conclusion.`,
        ``,
        `Title: ${title}`,
        ``,
        body,
    ].join('\n');
    return runAiPrompt(prompt, systemPrompt);
}
