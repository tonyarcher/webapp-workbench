import {looksLikeCsv, parseSampleCsv} from './csv';
import {looksLikeHealthConnect, parseHealthConnectJson} from './health-connect';
import type {ParseResult} from './types';

export function parseImportText(text: string): ParseResult {
    const trimmed = text.trim();
    if (!trimmed) {
        return {samples: [], skipped: [{line: '', reason: 'empty'}], format: 'unknown'};
    }
    if (trimmed.charCodeAt(0) === 0x50 && trimmed.charCodeAt(1) === 0x4b) {
        return {samples: [], skipped: [{line: '', reason: 'zip not supported; export JSON or CSV'}], format: 'unknown'};
    }
    if (looksLikeCsv(trimmed)) return parseSampleCsv(trimmed);
    if (looksLikeHealthConnect(trimmed) || trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            return parseHealthConnectJson(JSON.parse(trimmed) as unknown);
        } catch {
            return {samples: [], skipped: [{line: trimmed.slice(0, 80), reason: 'invalid json'}], format: 'unknown'};
        }
    }
    if (trimmed.includes(',')) return parseSampleCsv(trimmed);
    return {samples: [], skipped: [{line: trimmed.slice(0, 80), reason: 'unrecognized format'}], format: 'unknown'};
}
