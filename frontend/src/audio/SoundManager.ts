import { Howl } from 'howler'

export type SoundName = 'tick' | 'tick_fast' | 'end_round' | 'winner'

class SoundManager {
  private sounds: Map<SoundName, Howl> = new Map()
  private preloaded = false

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
          },
        })
      )
    }

    this.preloaded = true
  }

  play(name: SoundName): void {
    const sound = this.sounds.get(name)
    if (!sound) {
      console.warn(`[Audio] Sound "${name}" not found`)
      return
    }
    sound.play()
  }

  stopAll(): void {
    for (const sound of this.sounds.values()) {
      sound.stop()
    }
  }

  stop(name: SoundName): void {
    this.sounds.get(name)?.stop()
  }
}

export const soundManager = new SoundManager()
