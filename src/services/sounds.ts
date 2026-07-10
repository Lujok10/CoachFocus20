let completionAudio: HTMLAudioElement | null = null;

export function unlockAudio() {
  completionAudio = new Audio(
    "/sounds/glass-chime.mp3"
  );

  completionAudio.volume = 0.8;
  completionAudio.load();

  console.log("Audio unlocked.");
}

export function playTaskCompletedSound() {
  try {
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    if (!completionAudio) {
      completionAudio = new Audio(
        "/sounds/glass-chime.mp3"
      );

      completionAudio.volume = 0.8;
    }

    completionAudio.currentTime = 0;

    void completionAudio.play().catch((error) => {
      console.warn(
        "Audio playback failed",
        error
      );
    });
  } catch (error) {
    console.warn(
      "Task completion sound failed",
      error
    );
  }
}

export function playAchievementSound() {
  try {
    const audio = new Audio(
      "/sounds/game-achievement.mp3"
    );

    audio.volume = 0.8;

    void audio.play().catch((error) => {
      console.warn(
        "Achievement sound failed",
        error
      );
    });
  } catch (error) {
    console.warn(
      "Achievement sound failed",
      error
    );
  }
}

export function playLevelUpSound() {
  try {
    const audio = new Audio("/sounds/duolingo-reward.mp3");
    audio.volume = 0.85;

    void audio.play().catch((error) => {
      console.warn("Level-up sound failed", error);
    });
  } catch (error) {
    console.warn("Level-up sound failed", error);
  }
}