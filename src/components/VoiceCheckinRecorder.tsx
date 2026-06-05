import { useRef, useState } from "react";
import { Mic, Square, Upload } from "lucide-react";
import { uploadVoiceCheckin } from "../services/voiceCheckin";

export function VoiceCheckinRecorder({
  focusBlockId,
  onComplete,
}: {
  focusBlockId: string;
  onComplete?: (result: any) => void;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");

  const startRecording = async () => {
    setMessage("");

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm",
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());

      const audioBlob = new Blob(chunksRef.current, {
        type: "audio/webm",
      });

      setIsUploading(true);

      try {
        const result = await uploadVoiceCheckin({
          focusBlockId,
          audioBlob,
        });

        setMessage("Voice check-in saved.");
        onComplete?.(result);
      } catch (error) {
        console.error(error);
        setMessage("Voice upload failed.");
      } finally {
        setIsUploading(false);
      }
    };

    recorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-800">
        Voice Check-in
      </p>

      <p className="mt-1 text-xs text-slate-500">
        Record 5–10 seconds. Focus20 will transcribe and update your pattern.
      </p>

      <div className="mt-4 flex gap-3">
        {!isRecording ? (
          <button
            disabled={isUploading}
            onClick={startRecording}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Mic className="h-4 w-4" />
            Record
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white"
          >
            <Square className="h-4 w-4" />
            Stop
          </button>
        )}

        {isUploading && (
          <span className="inline-flex items-center gap-2 text-sm text-slate-500">
            <Upload className="h-4 w-4 animate-pulse" />
            Uploading...
          </span>
        )}
      </div>

      {message && (
        <p className="mt-3 text-sm text-slate-600">{message}</p>
      )}
    </div>
  );
}