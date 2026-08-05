/** Session-wide video sound preference, shared by every scroll video. */
let soundOn = false

const listeners = new Set<(sound: boolean) => void>()

export function getSoundOn(): boolean {
    return soundOn
}

export function setSoundOn(sound: boolean): void {
    if (soundOn === sound) return
    soundOn = sound
    listeners.forEach((listener) => listener(sound))
}

export function subscribeSound(listener: (sound: boolean) => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}
