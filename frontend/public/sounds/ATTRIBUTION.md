# Audio File Attribution

All sound files in this directory were generated programmatically for the "Дуэль чисел" (Number Duel) game.

## Generation Method

Generated using Python (pydub, numpy) and ffmpeg with sine wave synthesis and noise shaping. No existing sound recordings were used.

| File | Description | Generation |
|------|-------------|------------|
| `tick.mp3` | Short click (800Hz sine + pink noise, 120ms) | Custom generated |
| `tick_fast.mp3` | Higher-pitch tick (1200Hz sine + pink noise, 80ms) | Custom generated |
| `end_round.mp3` | Bell-like gong (C major chord: C4-E4-G4 with noise, 1.5s, long fade-out) | Custom generated |
| `winner.mp3` | Triumphant fanfare (ascending C-E-G-C arpeggio with final power chord, ~3s) | Custom generated |

## License

All sound files are original works created for this project. No attribution required.

## Tools Used

- Python 3.13 with pydub 0.25.1 and numpy 2.2.6
- ffmpeg 7.0.2 (libmp3lame encoder, 192 kbps, mono, 44100 Hz)
