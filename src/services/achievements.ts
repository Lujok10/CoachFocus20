export type Achievement = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
};

export function getAchievements(history: any[]) {
  const completedBlocks = history.reduce(
    (sum, day) => sum + day.completedFocusBlocks,
    0
  );

  const focusMinutes = history.reduce(
    (sum, day) => sum + day.totalFocusMinutes,
    0
  );

  return [
    {
      id: "first-focus",
      title: "First Focus",
      description: "Complete your first focus block.",
      unlocked: completedBlocks >= 1,
    },
    {
      id: "ten-focus",
      title: "Deep Worker",
      description: "Complete 10 focus blocks.",
      unlocked: completedBlocks >= 10,
    },
    {
      id: "one-hour",
      title: "One Hour Club",
      description: "Complete 60 minutes of focus work.",
      unlocked: focusMinutes >= 60,
    },
    {
      id: "five-hours",
      title: "Flow State",
      description: "Complete 5 hours of deep work.",
      unlocked: focusMinutes >= 300,
    },
  ];
}