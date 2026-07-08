let completionAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;

export function unlockAudio() {
  try {
    const audio = new Audio("/sounds/task-complete.mp3");

    audio.volume = 0.8;
    audio.muted = true;

    completionAudio = audio;

    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        audioUnlocked = true;
        completionAudio = audio;
      })
      .catch(() => {
        audioUnlocked = false;
      });
  } catch {
    audioUnlocked = false;
  }
}

export function playTaskCompletedSound() {
  try {
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    if (!audioUnlocked || !completionAudio) {
      console.warn("Audio not unlocked yet.");
      return;
    }

    completionAudio.pause();
    completionAudio.currentTime = 0;

    void completionAudio.play().catch((error) => {
      console.warn("Audio playback failed", error);
    });
  } catch (error) {
    console.warn("Task completion sound failed", error);
  }
}

export function playAchievementSound() {
  try {
    const audio = new Audio("/sounds/achievement.mp3");
    audio.volume = 0.8;

    void audio.play().catch((error) => {
      console.warn("Achievement sound failed", error);
    });
  } catch (error) {
    console.warn("Achievement sound failed", error);
  }
}