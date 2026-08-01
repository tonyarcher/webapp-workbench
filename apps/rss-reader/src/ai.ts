export type AiAvailability = 'readily' | 'after-download' | 'no' | 'unsupported';

interface AiSession {
    prompt(text: string): Promise<string> | ReadableStream;

    destroy(): void;
}

interface AiCreator {
    capabilities?: () => Promise<{ available?: string }>;
    create: (opts?: { systemPrompt?: string }) => Promise<AiSession>;
}

type AiWindow = {
    model?: AiCreator;
    ai?: {
        languageModel?: AiCreator;
        canCreateTextSession?: () => Promise<string>;
        createTextSession?: (opts?: { systemPrompt?: string }) => Promise<AiSession>;
    };
};

const aiWindow = globalThis as unknown as AiWindow;

function hasCreator(): boolean {
    return Boolean(
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
            return 'Gemini Nano is still downloading in Chrome — it will be ready in a moment. Try again shortly.';
        case 'no':
            return 'Gemini Nano is not available on this device or Chrome profile. Make sure the on-device model is downloaded (chrome://settings/ai or the optimization guide flag).';
        case 'unsupported':
        default:
            return 'AI is not available in this browser. This app uses Chrome’s built-in Gemini Nano (the Prompt / Model Execution API) — a separate feature from the "Ask Gemini" button, which is cloud-based. The API is only exposed to pages served from localhost or an HTTPS origin with a Prompt API origin-trial token, and it must be enabled in Chrome flags.';
    }
}

export interface AiDiagnostics {
    available: AiAvailability;
    hasModelApi: boolean;
    hasAiApi: boolean;
    hasLanguageModelApi: boolean;
    capabilitiesValue?: string;
    hasCreator: boolean;
    isLocalhost: boolean;
    isSecureContext: boolean;
}

const env = globalThis as unknown as {
    location?: { hostname?: string };
    isSecureContext?: boolean;
};

/**
 * Reports what Chrome actually exposes so users can debug why the on-device
 * model isn't available (flag / origin-trial / download state).
 */
export async function aiDiagnostics(): Promise<AiDiagnostics> {
    const readCaps = async (fn?: AiCreator['capabilities']): Promise<string | undefined> => {
        if (!fn) return undefined;
        try {
            return (await fn())?.available;
        } catch {
            return undefined;
        }
    };

    const hostname = env.location?.hostname ?? '';
    const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]' ||
        hostname.endsWith('.local');

    return {
        available: await aiAvailability(),
        hasModelApi: Boolean(aiWindow.model),
        hasAiApi: Boolean(aiWindow.ai),
        hasLanguageModelApi: Boolean(aiWindow.ai?.languageModel),
        capabilitiesValue:
            (await readCaps(aiWindow.model?.capabilities)) ??
            (await readCaps(aiWindow.ai?.languageModel?.capabilities)) ??
            undefined,
        hasCreator: hasCreator(),
        isLocalhost,
        isSecureContext: env.isSecureContext ?? false,
    };
}

function normalizeAvailability(value: string | undefined): AiAvailability {
    if (value === 'readily' || value === 'after-download') return value;
    if (value === 'no' || value === 'unavailable') return 'no';
    return 'unsupported';
}

let cachedAvailability: AiAvailability | undefined;

function setAvailability(value: AiAvailability): AiAvailability {
    cachedAvailability = value;
    return value;
}

/** Clears the cached availability probe (used by tests). */
export function resetAiAvailability() {
    cachedAvailability = undefined;
}

/** Whether Chrome's built-in Gemini Nano is usable on this origin. */
export async function aiAvailability(): Promise<AiAvailability> {
    if (cachedAvailability) return cachedAvailability;

    const model = aiWindow.model;
    if (model?.capabilities) {
        try {
            const result = await model.capabilities();
            const status = normalizeAvailability(result?.available);
            if (status === 'readily' && !hasCreator()) return setAvailability('unsupported');
            return setAvailability(status);
        } catch {
            return setAvailability('unsupported');
        }
    }

    const languageModel = aiWindow.ai?.languageModel;
    if (languageModel?.capabilities) {
        try {
            const result = await languageModel.capabilities();
            const status = normalizeAvailability(result?.available);
            if (status === 'readily' && !hasCreator()) return setAvailability('unsupported');
            return setAvailability(status);
        } catch {
            return setAvailability('unsupported');
        }
    }

    const legacy = aiWindow.ai;
    if (legacy && typeof legacy.createTextSession === 'function') {
        try {
            const status = legacy.canCreateTextSession ? await legacy.canCreateTextSession() : 'readily';
            return setAvailability(normalizeAvailability(status));
        } catch {
            return setAvailability('unsupported');
        }
    }

    return setAvailability('unsupported');
}

async function createAiSession(systemPrompt?: string): Promise<AiSession> {
    const model = aiWindow.model;
    if (model?.create) return model.create({systemPrompt});
    const languageModel = aiWindow.ai?.languageModel;
    if (languageModel?.create) return languageModel.create({systemPrompt});
    if (aiWindow.ai?.createTextSession) return aiWindow.ai.createTextSession({systemPrompt});
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
 * Runs a text prompt through Chrome's built-in Gemini Nano.
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
