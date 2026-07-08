export function playTaskCompletedSound() {
  try {
    const audio = new Audio("/sounds/task-complete.mp3");
    audio.volume = 0.7;
    void audio.play();
  } catch (error) {
    console.warn("Task completion sound failed", error);
  }
}

export function playAchievementSound() {
  try {
    const audio = new Audio("/sounds/achievement.mp3");
    audio.volume = 0.8;
    void audio.play();
  } catch (error) {
    console.warn("Achievement sound failed", error);
  }
}