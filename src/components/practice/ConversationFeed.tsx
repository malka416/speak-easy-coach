import { useEffect, useRef } from "react";

export type FeedMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tag?: string;
};

export function ConversationFeed({ messages, children }: { messages: FeedMessage[]; children?: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Scroll only this container, never the document.
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, lastId]);

  return (
    <div
      ref={scrollRef}
      className="flex h-full flex-col gap-4 overflow-y-auto overscroll-contain"
    >
      {messages.map((m) =>
        m.role === "assistant" ? (
          <div key={m.id} className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl [background-image:var(--gradient-primary)] font-display text-base font-extrabold text-white">
              A
            </div>
            <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-muted px-4 py-3">
              {m.tag && (
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{m.tag}</p>
              )}
              <p className="mt-1 text-sm font-medium text-foreground whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ) : (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-tutor px-4 py-3 text-sm font-medium text-white whitespace-pre-wrap">
              {m.content}
            </div>
          </div>
        ),
      )}
      {children}
    </div>
  );
}