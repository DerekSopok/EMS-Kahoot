# Audio Files for EMS Kahoot

This directory contains audio files for the Kahoot-style game experience.

## Required Audio Files

The following audio files are needed for the complete audio experience:

| File | Purpose | Specifications |
|------|---------|----------------|
| `lobby-music.mp3` | Background music for waiting lobby | Upbeat, loopable, ~30-60 seconds |
| `countdown.mp3` | 3-2-1-GO countdown beeps | Short, attention-grabbing, ~3 seconds |
| `question-reveal.mp3` | Sound when question appears | Quick reveal sound, ~1 second |
| `correct.mp3` | Correct answer chime | Positive, satisfying chime, ~1-2 seconds |
| `wrong.mp3` | Wrong answer buzz | Negative buzz sound, ~1-2 seconds |
| `times-up.mp3` | Time's up alarm | Urgent alarm sound, ~2 seconds |
| `leaderboard.mp3` | Leaderboard reveal fanfare | Dramatic reveal fanfare, ~3 seconds |
| `winner.mp3` | Winner celebration | Victory celebration music, ~5-10 seconds |

## Recommended Sources for Royalty-Free Audio

### 1. Freesound.org (CC0/CC-BY)
- Website: https://freesound.org/
- License: Creative Commons (check individual sounds)
- Search tips:
  - "game correct" for correct answer sounds
  - "game wrong" for wrong answer sounds
  - "countdown beep" for countdown sounds
  - "upbeat loop" for lobby music

### 2. Pixabay
- Website: https://pixabay.com/sound-effects/
- License: Pixabay License (free for commercial use)
- Large collection of game sound effects and music

### 3. Mixkit
- Website: https://mixkit.co/free-sound-effects/
- License: Free for commercial use
- High-quality game sounds and music loops

### 4. ZapSplat
- Website: https://www.zapsplat.com/
- License: Free with attribution for standard license
- Extensive game sound effects library

### 5. OpenGameArt.org
- Website: https://opengameart.org/
- License: Various (CC0, CC-BY, etc.)
- Game-focused audio assets

## File Format Requirements

- **Format**: MP3
- **Bitrate**: 128-192 kbps (balance quality and file size)
- **Sample Rate**: 44.1 kHz
- **File Size**: Keep individual files under 500KB for fast loading

## How to Add Audio Files

1. Download audio files from one of the recommended sources above
2. Ensure the file names match exactly as listed in the table above
3. Place the files in this directory (`public/audio/`)
4. Test the audio in the game by:
   - Starting a game as host (lobby music should play)
   - Playing through a question (sounds for reveal, countdown, time's up)
   - Submitting answers as player (correct/wrong sounds)
   - Viewing leaderboard (leaderboard and winner sounds)

## Compression Tips

If your audio files are too large:

```bash
# Using ffmpeg to compress MP3 files
ffmpeg -i input.mp3 -b:a 128k -ar 44100 output.mp3
```

## Testing Audio

The audio system includes:
- Automatic preloading after first user interaction
- Volume controls (separate for music and SFX)
- Mute button with localStorage persistence
- Browser autoplay restriction handling

## License Compliance

When using audio from external sources:
- Always check the license requirements
- Provide attribution if required by the license
- Keep a record of source URLs and licenses in your project documentation
- Do not use copyrighted music without permission

## Current Status

🔴 **Audio files need to be added** - The audio system is implemented but requires audio files to be placed in this directory.

Once audio files are added, the status will be: ✅ **Audio system ready**
