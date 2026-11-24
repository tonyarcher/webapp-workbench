// Prompt smoke: summary length option threads into the article prompt.
import { summarizeArticle } from '../src/ai';
import { assert } from './smoke-assert';

// ---- summary length threads into the prompt ----
const prompts: string[] = [];
const g = globalThis as unknown as Record<string, unknown>;
(g as Record<string, unknown>)['model'] = {
    capabilities: async () => ({ available: 'readily' }),
    create: async () => ({
        prompt: async (text: string) => {
            prompts.push(text);
            return 'ok';
        },
        destroy: () => {},
    }),
};
await summarizeArticle('T', 'body', 'brief');
await summarizeArticle('T', 'body', 'standard');
await summarizeArticle('T', 'body', 'deep');
assert(prompts[0]?.includes('3 short bullet points') ?? false, 'brief summaries ask for 3 bullets');
assert(prompts[1]?.includes('4-6 short bullet points') ?? false, 'standard summaries ask for 4-6 bullets');
assert(prompts[2]?.includes('8-10 short bullet points') ?? false, 'deep summaries ask for 8-10 bullets');
delete (g as Record<string, unknown>)['model'];
