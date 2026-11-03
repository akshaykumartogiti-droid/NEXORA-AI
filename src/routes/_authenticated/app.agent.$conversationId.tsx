import { useChat } from "@ai-sdk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { Copy, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageAction, MessageActions, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { supabase } from "@/integrations/supabase/client";
import { AI_LIMITS } from "@/lib/limits";

export const Route = createFileRoute("/_authenticated/app/agent/$conversationId")({ component: ChatPage });

function ChatPage() {
  const { conversationId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const [{ data: convo }, { data: rows, error }] = await Promise.all([
        supabase.from("conversations").select("id, title, projects(name)").eq("id", conversationId).maybeSingle(),
        supabase.from("messages").select("ui_id, role, parts").eq("conversation_id", conversationId).order("created_at"),
      ]);
      if (error) throw error;
      return {
        convo,
        messages: (rows ?? []).map((r) => ({ id: r.ui_id, role: r.role as UIMessage["role"], parts: r.parts as UIMessage["parts"] })),
      };
    },
    staleTime: Infinity,
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading conversation…</div>;
  if (error) return <div className="p-6 text-sm text-destructive">Could not load this conversation.</div>;
  if (!data?.convo)
    return (
      <div className="p-6 text-sm">
        Conversation not found. <Link to="/app/agent" className="text-primary">Back to agent</Link>
      </div>
    );
  const project = (data.convo as { projects?: { name: string } | null }).projects;
  return <ChatWindow key={conversationId} id={conversationId} initial={data.messages} title={data.convo.title} projectName={project?.name} />;
}

const suggestions = ["Break my goal into a step-by-step plan", "Draft a project brief", "Summarise the text I paste next"];

function ChatWindow({ id, initial, title, projectName }: { id: string; initial: UIMessage[]; title: string; projectName: string | undefined }) {
  const qc = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { conversationId: id },
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [id],
  );
  const { messages, sendMessage, status, stop, regenerate, error } = useChat({
    id,
    messages: initial,
    transport,
    onError: (e) => {
      let msg = e.message;
      try {
        msg = JSON.parse(e.message).error ?? msg;
      } catch {}
      toast.error(msg || "Request failed");
    },
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["usage"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["runs"] });
    },
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    if (t.length > AI_LIMITS.maxMessageChars) { toast.error(`Message too long (max ${AI_LIMITS.maxMessageChars} characters).`); return; }
    sendMessage({ text: t });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-6 py-3">
        <h1 className="truncate font-display font-medium">{title}</h1>
        {projectName && <span className="rounded-full bg-accent px-2 py-0.5 text-xs">Project: {projectName}</span>}
      </div>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState title="Start the conversation" description="Ask anything, or try a suggestion below." />
          ) : (
            messages.map((m, i) => {
              const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
              return (
                <Message key={m.id} from={m.role}>
                  <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                    {m.parts.map((p, j) =>
                      p.type === "text" ? (
                        m.role === "assistant" ? <MessageResponse key={j}>{p.text}</MessageResponse> : <p key={j} className="whitespace-pre-wrap">{p.text}</p>
                      ) : isToolUIPart(p) ? (
                        <Tool key={j} defaultOpen={false}>
                          <ToolHeader type="dynamic-tool" state={p.state} toolName={p.type === "dynamic-tool" ? "tool" : p.type.replace(/^tool-/, "").replace(/_/g, " ")} />
                          <ToolContent>
                            <ToolInput input={p.input} />
                            <ToolOutput output={p.output} errorText={p.errorText} />
                          </ToolContent>
                        </Tool>
                      ) : null,
                    )}
                  </MessageContent>
                  {m.role === "assistant" && text && !(busy && i === messages.length - 1) && (
                    <MessageActions>
                      <MessageAction tooltip="Copy" label="Copy" onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied"); }}>
                        <Copy className="size-3.5" />
                      </MessageAction>
                      {i === messages.length - 1 && (
                        <MessageAction tooltip="Retry" label="Retry" onClick={() => regenerate()}>
                          <RefreshCw className="size-3.5" />
                        </MessageAction>
                      )}
                    </MessageActions>
                  )}
                </Message>
              );
            })
          )}
          {status === "submitted" && <Shimmer className="text-sm">Thinking…</Shimmer>}
          {error && !busy && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              The last request failed. <button className="underline" onClick={() => regenerate()}>Try again</button>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        {messages.length === 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent">{s}</button>
            ))}
          </div>
        )}
        <PromptInput onSubmit={(msg) => send(msg.text)}>
          <PromptInputTextarea ref={textareaRef} placeholder="Describe your goal…" maxLength={AI_LIMITS.maxMessageChars} autoFocus />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-center text-xs text-muted-foreground">The agent can manage your tasks; deletions need your approval. It can't send messages, browse or touch outside services yet.</p>
      </div>
    </div>
  );
}
