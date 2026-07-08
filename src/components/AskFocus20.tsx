import { useState } from "react";

import { getBestFocusWindow, optimizeDay } from "../services/aiScheduler";

import {
  getProductivityHistory,
  getWeeklyStats,
} from "../services/productivityMemory";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type AskFocus20Props = {
  events: any[];
  currentDate: Date;
};

export function AskFocus20({ events, currentDate }: AskFocus20Props) {
 const [messages, setMessages] = useState<ChatMessage[]>([
  {
    role: "assistant",
    content:
      "Ask me about your focus blocks, calendar, productivity, or what to work on next.",
    timestamp: new Date(),
  },
]);

  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  async function handleAsk(question?: string) {
    const prompt = (question ?? input).trim();

    if (!prompt || isThinking) return;

    const lower = prompt.toLowerCase();

    let response =
      "I'm still learning. Try asking about your focus windows, schedule, weekly progress, or what to work on next.";

    if (lower.includes("yesterday")) {
      const history = getProductivityHistory();
      const yesterday = history.at(-2);

      if (!yesterday) {
        response = "I don't have enough history yet to analyze yesterday.";
      } else {
        const completion =
          yesterday.scheduledFocusBlocks === 0
            ? 0
            : Math.round(
                (yesterday.completedFocusBlocks /
                  yesterday.scheduledFocusBlocks) *
                  100
              );

        response = `Yesterday you completed ${yesterday.completedFocusBlocks} focus blocks and achieved ${completion}% of your planned focus sessions.`;

        if (yesterday.interruptions > 5) {
          response +=
            "\n\nHigh interruptions may have reduced your productivity.";
        }
      }
    } else if (lower.includes("this week")) {
      const stats = getWeeklyStats();

      response = `This week you completed ${stats.focusBlocks} focus blocks and accumulated ${stats.focusMinutes} minutes of deep work.`;
    } else if (lower.includes("improving")) {
      const history = getProductivityHistory();

      if (history.length < 2) {
        response =
          "I need more productivity history before I can measure improvement.";
      } else {
        const last = history[history.length - 1];
        const previous = history[history.length - 2];

        response =
          last.completedFocusBlocks > previous.completedFocusBlocks
            ? "Yes. Your focus block completion improved compared to the previous day."
            : "Your productivity has remained stable. Try protecting more focus time tomorrow.";
      }
    } else if (lower.includes("optimize")) {
      const result = optimizeDay(events, currentDate);

      response = `I analyzed your schedule.\n\nPredicted productivity gain: +${result.predictedGain}%`;

      if (result.movedEvents.length > 0) {
        response +=
          "\n\nSuggested moves:\n" +
          result.movedEvents.map((event) => `• ${event.title}`).join("\n");
      }

      if (result.warnings.length > 0) {
        response += "\n\nWarnings:\n" + result.warnings.join("\n");
      }
    } else if (lower.includes("focus") || lower.includes("best window")) {
      const recommendation = getBestFocusWindow(events, currentDate);

      if (recommendation) {
        response = `Your best focus window is ${recommendation.start.toLocaleTimeString(
          [],
          {
            hour: "numeric",
            minute: "2-digit",
          }
        )} - ${recommendation.end.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}.\n\nConfidence: ${
          recommendation.confidence
        }%\n\n${recommendation.reasons.join("\n")}`;
      } else {
        response = "I couldn't find an open focus window today.";
      }
    } else if (lower.includes("work on") || lower.includes("next")) {
      const focusEvent = events.find(
        (event: any) => event.type === "focus" || event.protectAsFocus
      );

      response = focusEvent
        ? `Your next highest-priority focus block is "${
            focusEvent.title ?? focusEvent.summary ?? "Untitled"
          }".`
        : "You don't currently have a protected focus block scheduled.";
    }

    setMessages((current) => [
      ...current,
      {
      role: "user",
      content: prompt,
      timestamp: new Date(),
    }
    ]);

    setInput("");
    setIsThinking(true);

    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
       {
          role: "assistant",
          content: response,
          timestamp: new Date(),
        }
      ]);

      setIsThinking(false);
    }, 500);
  }

  const suggestions = [
    "What should I work on next?",
    "Find my best focus window",
    "Why was yesterday unproductive?",
    "How many focus blocks did I complete this week?",
    "Am I improving?",
    "Optimize my day",
  ];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-indigo-600">
          Ask Focus20
        </p>

        <h2 className="mt-2 text-xl font-black text-slate-900">
          Productivity Copilot
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Ask questions about your schedule, focus patterns, and next best move.
        </p>
      </div>

      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`whitespace-pre-line rounded-2xl p-3 text-sm leading-6 ${
              message.role === "user"
                ? "ml-8 bg-slate-900 text-white"
                : "mr-8 bg-slate-50 text-slate-700"
            }`}
          >
            {message.content}
            <p className="mt-1 text-[10px] opacity-60">
            {message.timestamp.toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          </div>
        ))}

        {isThinking && (
          <div className="mr-8 rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((item) => (
          <button
            key={item}
            type="button"
            disabled={isThinking}
            onClick={() => handleAsk(item)}
            className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          disabled={isThinking}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleAsk();
          }}
          placeholder="Ask Focus20..."
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
        />

        <button
          type="button"
          disabled={isThinking}
          onClick={() => handleAsk()}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isThinking ? "Thinking..." : "Ask"}
        </button>
      </div>
    </div>
  );
}