let completionAudio: HTMLAudioElement | null = null;
let timerCompleteAudio: HTMLAudioElement | null = null;

function getCompletionAudio() {
  if (!completionAudio) {
    completionAudio = new Audio("/sounds/glass-chime.mp3");
    completionAudio.preload = "auto";
    completionAudio.volume = 0.8;
    completionAudio.load();
  }

  return completionAudio;
}

function getTimerCompleteAudio() {
  if (!timerCompleteAudio) {
    timerCompleteAudio = new Audio("/sounds/timer-complete.mp3");
    timerCompleteAudio.preload = "auto";
    timerCompleteAudio.volume = 1;
    timerCompleteAudio.load();
  }

  return timerCompleteAudio;
}

/**
 * Must be called from a real user gesture.
 *
 * This prepares both completion sounds so Android WebView / mobile browsers
 * allow them to play later when a timer callback fires.
 */
export function unlockAudio() {
  const sounds = [
    getCompletionAudio(),
    getTimerCompleteAudio(),
  ];

  sounds.forEach((audio) => {
    try {
      const previousVolume = audio.volume;

      audio.muted = true;
      audio.currentTime = 0;

      void audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
          audio.volume = previousVolume;
        })
        .catch((error) => {
          audio.muted = false;
          audio.volume = previousVolume;

          console.warn(
            "Audio unlock attempt failed:",
            error
          );
        });
    } catch (error) {
      console.warn(
        "Unable to prepare audio:",
        error
      );
    }
  });

  console.log("Focus20 sounds prepared.");
}

export async function playTimerCompleteSound() {
  const audio = getTimerCompleteAudio();

  try {
    audio.pause();
    audio.muted = false;
    audio.volume = 1;
    audio.currentTime = 0;

    await audio.play();

    console.log("Timer completion sound played.");
  } catch (error) {
    console.warn(
      "Timer completion sound failed:",
      error
    );
  }
}

export function playTaskCompletedSound() {
  try {
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    const audio = getCompletionAudio();

    audio.pause();
    audio.muted = false;
    audio.currentTime = 0;

    void audio.play().catch((error) => {
      console.warn(
        "Task completion sound failed:",
        error
      );
    });
  } catch (error) {
    console.warn(
      "Task completion sound failed:",
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
        "Achievement sound failed:",
        error
      );
    });
  } catch (error) {
    console.warn(
      "Achievement sound failed:",
      error
    );
  }
}

export function playLevelUpSound() {
  try {
    const audio = new Audio(
      "/sounds/duolingo-reward.mp3"
    );

    audio.volume = 0.85;

    void audio.play().catch((error) => {
      console.warn(
        "Level-up sound failed:",
        error
      );
    });
  } catch (error) {
    console.warn(
      "Level-up sound failed:",
      error
    );
  }
}