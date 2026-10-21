"use client";

import { MessageCircle, SendHorizontal } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ChatDTO } from "@/lib/gallery";
import { EmptyState, cx } from "../ui";

type Props = {
  messages: ChatDTO[];
  mySession: string;
  input: string;
  onInput: (v: string) => void;
  onSend: (text: string) => void;
};

const QUICK = ["Hello everyone!", "Love this piece", "Meet by the sculpture", "Great collection"];

export default function ChatPanel({ messages, mySession, input, onInput, onSend }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <div className="flex h-full flex-col">
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="pt-10">
            <EmptyState
              icon={<MessageCircle className="h-6 w-6" />}
              title="Start the conversation"
              body="Messages appear instantly for everyone walking this room."
            />
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.sessionId === mySession;
            const grouped = messages[i - 1]?.sessionId === m.sessionId;
            return (
              <div
                key={m.id}
                className={cx("flex items-end gap-2", mine && "flex-row-reverse", grouped ? "mt-1" : "mt-4 first:mt-0")}
              >
                {!grouped ? (
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: m.color }}
                    aria-hidden
                  >
                    {m.name.slice(0, 1).toUpperCase()}
                  </span>
                ) : (
                  <span className="w-6 shrink-0" />
                )}

                <div className={cx("max-w-[76%]", mine && "flex flex-col items-end")}>
                  {!grouped && (
                    <p className="mb-1 px-1 text-[10.5px] font-semibold text-ink-400">{mine ? "You" : m.name}</p>
                  )}
                  <div
                    className={cx(
                      "rounded-2xl px-3.5 py-2 text-[13px] leading-snug",
                      mine
                        ? "rounded-br-sm bg-ink-900 text-white"
                        : "rounded-bl-sm bg-ink-100 text-ink-800",
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-ink-200/70 px-5 py-3.5">
        <div className="no-scrollbar mb-2.5 flex gap-1.5 overflow-x-auto">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => onSend(q)}
              className="shrink-0 rounded-full bg-ink-100 px-3 py-1.5 text-[11.5px] font-medium text-ink-500 transition hover:bg-ink-900 hover:text-white"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSend(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => onInput(e.target.value)}
            placeholder="Message the room…"
            maxLength={300}
            className="field"
            aria-label="Message the room"
          />
          <button
            type="submit"
            aria-label="Send"
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-ink-900 text-white transition hover:bg-ink-700"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
