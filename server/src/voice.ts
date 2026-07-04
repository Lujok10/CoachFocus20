import fs from "fs";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type VoiceAnalysis = {
  transcript: string;
  mood: "positive" | "neutral" | "frustrated" | "tired" | "unclear";
  context: string;
  suggestedResult: "crushed" | "meh" | "missed";
  suggestedNeedleMover: "yes" | "somewhat" | "no" | "unconfirmed";
};

function fallbackAnalyze(transcript: string): VoiceAnalysis {
  const lower = transcript.toLowerCase();

  const missed =
    lower.includes("missed") ||
    lower.includes("didn't") ||
    lower.includes("couldn't") ||
    lower.includes("failed");

  const crushed =
    lower.includes("finished") ||
    lower.includes("done") ||
    lower.includes("completed") ||
    lower.includes("great") ||
    lower.includes("crushed");

  const tired =
    lower.includes("tired") ||
    lower.includes("exhausted") ||
    lower.includes("drained");

  const frustrated =
    lower.includes("frustrated") ||
    lower.includes("stuck") ||
    lower.includes("annoyed");

  return {
    transcript,
    mood: frustrated ? "frustrated" : tired ? "tired" : crushed ? "positive" : "neutral",
    context: transcript.slice(0, 240),
    suggestedResult: missed ? "missed" : crushed ? "crushed" : "meh",
    suggestedNeedleMover: crushed ? "yes" : missed ? "no" : "somewhat",
  };
}

export async function transcribeAndAnalyzeAudio(
  filePath: string,
  mimeType = "audio/webm",
  originalName = "focus20-checkin.webm"
): Promise<VoiceAnalysis> {
  if (!openai) {
    return fallbackAnalyze(
      "Voice note received. OpenAI transcription is not configured."
    );
  }

  const fileBuffer = await fs.promises.readFile(filePath);

  const transcription = await openai.audio.transcriptions.create({
    file: await OpenAI.toFile(
      fileBuffer,
      originalName || "focus20-checkin.webm",
      {
        type: mimeType || "audio/webm",
      }
    ),
    model: "whisper-1",
  });

  const transcript = transcription.text?.trim() || "";

  if (!transcript) {
    return fallbackAnalyze("No clear speech detected.");
  }

  // ...keep the rest of your existing function unchanged...


  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Analyze a short Focus20 voice check-in. Return JSON only. Infer result, needle mover status, mood, and concise context. Be conservative.",
        },
        {
          role: "user",
          content: transcript,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "voice_checkin_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "transcript",
              "mood",
              "context",
              "suggestedResult",
              "suggestedNeedleMover",
            ],
            properties: {
              transcript: { type: "string" },
              mood: {
                type: "string",
                enum: ["positive", "neutral", "frustrated", "tired", "unclear"],
              },
              context: { type: "string" },
              suggestedResult: {
                type: "string",
                enum: ["crushed", "meh", "missed"],
              },
              suggestedNeedleMover: {
                type: "string",
                enum: ["yes", "somewhat", "no", "unconfirmed"],
              },
            },
          },
        },
      },
    });

    return JSON.parse(response.output_text) as VoiceAnalysis;
  } catch {
    return fallbackAnalyze(transcript);
  }
}