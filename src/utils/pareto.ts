export function calculateParetoScore(
  impact: number,
  confidence: number,
  effortMinutes: number
) {
  return (
    (impact * confidence) /
    Math.sqrt(effortMinutes + 1)
  );
}