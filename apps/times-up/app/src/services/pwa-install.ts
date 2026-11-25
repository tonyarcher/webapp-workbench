// PWA install affordance: captures beforeinstallprompt and exposes it.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function installAvailable(): boolean {
    return deferredPrompt !== null && !installed;
}

export function isInstalled(): boolean {
    return installed;
}

export function captureInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e as BeforeInstallPromptEvent;
    });
    window.addEventListener('appinstalled', () => {
        installed = true;
        deferredPrompt = null;
    });
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (choice.outcome === 'accepted') installed = true;
    return choice.outcome;
}
