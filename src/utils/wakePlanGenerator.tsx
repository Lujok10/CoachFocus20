import { refreshWakePlan } from "../services/deploymentCoach";

export async function generateWakePlan() {
  return refreshWakePlan(true);
}
