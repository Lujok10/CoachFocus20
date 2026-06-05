import { authFetch } from "./apiClient";

export async function uploadVoiceCheckin(input: {
  focusBlockId: string;
  audioBlob: Blob;
}) {
  const formData = new FormData();

  formData.append("focusBlockId", input.focusBlockId);
  formData.append("audio", input.audioBlob, "focus20-checkin.webm");

  const response = await authFetch("/api/voice/checkin", {
    method: "POST",
    body: formData,
    headers: {},
  });

  return response;
}