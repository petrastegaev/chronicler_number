import { Howl } from 'howler'

export type SoundName = 'tick' | 'tick_fast' | 'end_round' | 'winner'

class SoundManager {
  private sounds: Map<SoundName, Howl> = new Map()
  private soundIds: Map<SoundName, number> = new Map()
  private preloaded = false
  private _errors: Set<SoundName> = new Set()

  preload(): void {
    if (this.preloaded) return

    const configs: Array<{ name: SoundName; src: string }> = [
      { name: 'tick', src: '/sounds/tick.mp3' },
      { name: 'tick_fast', src: '/sounds/tick_fast.mp3' },
      { name: 'end_round', src: '/sounds/end_round.mp3' },
      { name: 'winner', src: '/sounds/winner.mp3' },
    ]

    for (const { name, src } of configs) {
      this.sounds.set(
        name,
        new Howl({
          src: [src],
          preload: true,
          volume: name === 'tick' || name === 'tick_fast' ? 0.5 : 1.0,
          onloaderror: (_id: number, error: unknown) => {
            console.warn(`[Audio] Failed to load ${name}:`, error)
            this._errors.add(name)
          },
        })
      )
    }

    this.preloaded = true
  }

  get errors(): ReadonlySet<SoundName> {
    return this._errors
  }

  hasError(name: SoundName): boolean {
    return this._errors.has(name)
  }

  play(name: SoundName): number | undefined {
    const sound = this.sounds.get(name)
    if (!sound) {
      console.warn(`[Audio] Sound "${name}" not found`)
      return undefined
    }
    const id = sound.play()
    this.soundIds.set(name, id)
    return id
  }

  stopAll(): void {
    for (const sound of this.sounds.values()) {
      sound.stop()
    }
    this.soundIds.clear()
  }

  stop(name: SoundName): void {
    const sound = this.sounds.get(name)
    const id = this.soundIds.get(name)
    if (sound && id !== undefined) {
      sound.stop(id)
    } else {
      sound?.stop()
    }
  }
}

export const soundManager = new SoundManager()
