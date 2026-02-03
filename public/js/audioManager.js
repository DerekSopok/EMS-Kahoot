/**
 * AudioManager - Centralized audio control for the Kahoot Clone
 *
 * Handles all game sound effects and music playback with volume controls,
 * muting, and browser autoplay restriction handling.
 */
class AudioManager {
  constructor() {
    this.sounds = {};
    this.musicVolume = 0.3;
    this.sfxVolume = 0.5;
    this.muted = false;
    this.currentMusic = null;
    this.preloadAttempted = false;
  }

  /**
   * Preload all audio files
   * Should be called after user interaction to avoid autoplay restrictions
   */
  async preload() {
    if (this.preloadAttempted) {
      return;
    }

    const soundFiles = {
      lobbyMusic: '/audio/lobby-music.mp3',
      countdown: '/audio/countdown.wav',
      questionReveal: '/audio/question-reveal.wav',
      correct: '/audio/correct.mp3',
      wrong: '/audio/wrong.mp3',
      timesUp: '/audio/times-up.mp3',
      leaderboard: '/audio/leaderboard.mp3',
      winner: '/audio/winner.mp3'
    };

    for (const [name, path] of Object.entries(soundFiles)) {
      try {
        this.sounds[name] = new Audio(path);
        this.sounds[name].preload = 'auto';
      } catch (error) {
        console.warn(`Failed to load audio: ${name}`, error);
      }
    }

    // Configure music to loop
    if (this.sounds.lobbyMusic) {
      this.sounds.lobbyMusic.loop = true;
    }

    this.preloadAttempted = true;
  }

  /**
   * Play a sound effect
   * @param {string} soundName - Name of the sound to play
   */
  play(soundName) {
    if (this.muted || !this.sounds[soundName]) {
      return;
    }

    const sound = this.sounds[soundName];
    sound.volume = this.sfxVolume;
    sound.currentTime = 0;
    sound.play().catch((error) => {
      // Ignore autoplay errors - they're expected before user interaction
      if (error.name !== 'NotAllowedError') {
        console.warn(`Failed to play sound: ${soundName}`, error);
      }
    });
  }

  /**
   * Play background music
   * @param {string} musicName - Name of the music to play
   */
  playMusic(musicName) {
    if (this.currentMusic) {
      this.currentMusic.pause();
    }

    if (this.muted || !this.sounds[musicName]) {
      return;
    }

    this.currentMusic = this.sounds[musicName];
    this.currentMusic.volume = this.musicVolume;
    this.currentMusic.play().catch((error) => {
      // Ignore autoplay errors - they're expected before user interaction
      if (error.name !== 'NotAllowedError') {
        console.warn(`Failed to play music: ${musicName}`, error);
      }
    });
  }

  /**
   * Stop currently playing music
   */
  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic.currentTime = 0;
      this.currentMusic = null;
    }
  }

  /**
   * Toggle mute on/off
   * @returns {boolean} Current muted state
   */
  toggleMute() {
    this.muted = !this.muted;
    if (this.muted && this.currentMusic) {
      this.currentMusic.pause();
    } else if (!this.muted && this.currentMusic) {
      this.currentMusic.play().catch(() => {});
    }
    return this.muted;
  }

  /**
   * Set volume level for music or sound effects
   * @param {string} type - 'music' or 'sfx'
   * @param {number} level - Volume level (0.0 to 1.0)
   */
  setVolume(type, level) {
    const clampedLevel = Math.max(0, Math.min(1, level));

    if (type === 'music') {
      this.musicVolume = clampedLevel;
      if (this.currentMusic) {
        this.currentMusic.volume = clampedLevel;
      }
    } else {
      this.sfxVolume = clampedLevel;
    }
  }

  /**
   * Check if audio manager is muted
   * @returns {boolean} Muted state
   */
  isMuted() {
    return this.muted;
  }
}

// Create global instance
const audioManager = new AudioManager();

// Auto-preload on first user interaction
document.addEventListener('click', () => {
  audioManager.preload();
}, { once: true });

// Also try on any keypress
document.addEventListener('keydown', () => {
  audioManager.preload();
}, { once: true });
