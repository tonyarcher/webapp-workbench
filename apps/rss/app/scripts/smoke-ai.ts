// Built-in model AI smoke: availability detection, prompt routing, diagnostics.
import {
    aiAvailability,
    aiDiagnostics,
    aiStatusMessage,
    resetAiAvailability,
    runAiPrompt,
    summarizeArticle,
} from '../src/ai';
import { assert } from './smoke-assert';

// ---- AI module (mock Chrome's built-in model) ----
const g = globalThis as unknown as Record<string, unknown>;
const encoder = new TextEncoder();

resetAiAvailability();
assert((await aiAvailability()) === 'unsupported', 'ai unavailable when no model API present');

let capturedSystem: string | undefined;
g.model = {
    capabilities: async () => ({ available: 'readily' }),
    create: async ({ systemPrompt }: { systemPrompt?: string }) => {
        capturedSystem = systemPrompt;
        return {
            prompt: async (text: string) => `SUMMARY[${text.slice(0, 59)}]`,
            destroy: () => {},
        };
    },
};
resetAiAvailability();
assert((await aiAvailability()) === 'readily', 'ai availability detects model.capabilities');
const out = await runAiPrompt('hello world body');
assert(out === 'SUMMARY[hello world body]', 'runAiPrompt routes through model.create');
const articleSummary = await summarizeArticle('My Article', 'body text here');
assert(
    articleSummary === 'SUMMARY[Summarize the following article in 4-6 short bullet points.]',
    'summarizeArticle builds an article prompt',
);
assert(typeof capturedSystem === 'string' && capturedSystem.length > 0, 'summarizeArticle sends a system prompt');

g.model = {
    capabilities: async () => ({ available: 'readily' }),
    create: async () => {
        return {
            prompt: async () =>
                new ReadableStream({
                    start(c) {
                        c.enqueue(encoder.encode('streamed '));
                        c.enqueue(encoder.encode('result'));
                        c.close();
                    },
                }),
            destroy: () => {},
        };
    },
};
const streamed = await runAiPrompt('x');
assert(streamed === 'streamed result', 'runAiPrompt consumes a streaming response');

g.model = {
    capabilities: async () => ({ available: 'after-download' }),
    create: async () => {
        throw new Error('should not be called');
    },
};
resetAiAvailability();
assert((await aiAvailability()) === 'after-download', 'ai availability reports after-download');
delete g.model;

// capabilities reports readily but no create() exists -> must be treated as unsupported
g.model = {
    capabilities: async () => ({ available: 'readily' }),
};
resetAiAvailability();
assert((await aiAvailability()) === 'unsupported', 'readily without a create() is reported as unsupported');
delete g.model;

assert(
    aiStatusMessage('unsupported').includes('LanguageModel') && aiStatusMessage('unsupported').includes('localhost'),
    'aiStatusMessage gives actionable guidance for unsupported',
);
assert(aiStatusMessage('after-download').includes('downloading'), 'aiStatusMessage covers after-download');
assert(aiStatusMessage('readily') === '', 'aiStatusMessage empty when readily');

// diagnostics surface what Chrome exposes
g.model = {
    capabilities: async () => ({ available: 'readily' }),
    create: async () => ({
        prompt: async (t: string) => t,
        destroy: () => {},
    }),
};
resetAiAvailability();
const diag = await aiDiagnostics();
assert(diag.hasModelApi === true, 'diagnostics detect window.model');
assert(diag.capabilitiesValue === 'readily', 'diagnostics report capabilities value');
assert(diag.available === 'readily', 'diagnostics available is readily');
delete g.model;
resetAiAvailability();
const diag2 = await aiDiagnostics();
assert(diag2.hasModelApi === false && diag2.hasAiApi === false, 'diagnostics report absent APIs');
assert(diag2.hasLanguageModelGlobal === false, 'diagnostics report absent LanguageModel');

// Chrome 138+ Prompt API: global LanguageModel.availability() / create()
g.LanguageModel = {
    availability: async () => 'available',
    create: async ({ initialPrompts }: { initialPrompts?: Array<{ role: string; content: string }> } = {}) => {
        capturedSystem = initialPrompts?.[0]?.content;
        return {
            prompt: async (text: string) => `LM[${text.slice(0, 20)}]`,
            destroy: () => {},
        };
    },
};
resetAiAvailability();
assert((await aiAvailability()) === 'readily', 'LanguageModel.availability available maps to readily');
const lmOut = await runAiPrompt('hello from prompt api', 'be concise');
assert(lmOut === 'LM[hello from prompt ap]', 'runAiPrompt routes through LanguageModel.create');
assert(capturedSystem === 'be concise', 'LanguageModel.create receives system prompt as initialPrompts');
const lmDiag = await aiDiagnostics();
assert(lmDiag.hasLanguageModelGlobal === true, 'diagnostics detect LanguageModel');
assert(lmDiag.capabilitiesValue === 'available', 'diagnostics report LanguageModel availability');
g.LanguageModel = {
    availability: async () => 'downloadable',
    create: async () => {
        throw new Error('should not be called');
    },
};
resetAiAvailability();
assert((await aiAvailability()) === 'after-download', 'LanguageModel downloadable maps to after-download');
g.LanguageModel = {
    availability: async () => 'unavailable',
    create: async () => {
        throw new Error('should not be called');
    },
};
resetAiAvailability();
assert((await aiAvailability()) === 'no', 'LanguageModel unavailable maps to no');
delete g.LanguageModel;
resetAiAvailability();
