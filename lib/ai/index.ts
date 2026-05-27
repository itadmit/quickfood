import type { ShortIdMap } from "./menu-snapshot";
import type { AIProviderKind, ChatMessage, StreamEvent } from "./types";
import { streamGeminiChat, pingGemini, toGeminiHistory } from "./gemini-advisor";
import { streamClaudeChat, pingClaude, toClaudeMessages } from "./claude-advisor";

export async function* streamAdvisorChat(opts: {
  provider: AIProviderKind;
  apiKey: string;
  systemInstruction: string;
  messages: ChatMessage[];
  message: string;
  idMap: ShortIdMap;
}): AsyncGenerator<StreamEvent> {
  if (opts.provider === "claude") {
    yield* streamClaudeChat({
      apiKey: opts.apiKey,
      systemInstruction: opts.systemInstruction,
      history: toClaudeMessages(opts.messages),
      message: opts.message,
      idMap: opts.idMap,
    });
  } else {
    yield* streamGeminiChat({
      apiKey: opts.apiKey,
      systemInstruction: opts.systemInstruction,
      history: toGeminiHistory(opts.messages),
      message: opts.message,
      idMap: opts.idMap,
    });
  }
}

export function pingAdvisor(provider: AIProviderKind, apiKey: string) {
  return provider === "claude" ? pingClaude(apiKey) : pingGemini(apiKey);
}

export const PROVIDER_LABEL: Record<AIProviderKind, string> = {
  gemini: "Google Gemini",
  claude: "Anthropic Claude",
};
