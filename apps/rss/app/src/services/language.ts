export function detectLanguage(text: string): string {
    const sample = text.slice(0, 500);
    if (!sample) return 'en';
    const latin = (sample.match(/[a-zA-Z]/g) || []).length;
    const total = sample.replace(/\s/g, '').length || 1;
    const ratio = latin / total;
    if (ratio < 0.5) {
        // Non-Latin script; crude bucketing
        if (/[а-яА-Я]/.test(sample)) return 'ru';
        if (/[一-龯]/.test(sample)) return 'zh';
        if (/[ぁ-んァ-ン]/.test(sample)) return 'ja';
        if (/[가-힣]/.test(sample)) return 'ko';
        if (/[α-ωΑ-Ω]/.test(sample)) return 'el';
        if (/[א-ת]/.test(sample)) return 'he';
        if (/[ء-ي]/.test(sample)) return 'ar';
        return 'non-Latin';
    }
    return 'en';
}

export const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English',
    ru: 'Russian',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    el: 'Greek',
    he: 'Hebrew',
    ar: 'Arabic',
    'non-Latin': 'Non-English',
};
