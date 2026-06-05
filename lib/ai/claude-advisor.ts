import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import type { ShortIdMap } from "./menu-snapshot";
import { ADVISOR_TOOLS } from "./prompt";
import type { ChatMessage, StreamEvent, ToolProperty, ToolSpec } from "./types";
import { humanizeProviderError, stripMarkdown, translateToolArgs } from "./text-utils";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

function toClaudeTools(tools: ToolSpec[]): Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(t.parameters.properties).map(([k, v]) => [
          k,
          mapPropToClaude(v),
        ]),
      ),
      required: t.parameters.required,
    } as Tool["input_schema"],
  }));
}

function mapPropToClaude(p: ToolProperty): Record<string, unknown> {
  return {
    type: p.type,
    ...(p.description ? { description: p.description } : {}),
    ...(p.items ? { items: { type: p.items.type } } : {}),
  };
}

export function toClaudeMessages(messages: ChatMessage[]): MessageParam[] {
  return messages.map((m) => ({
    role: m.role === "model" ? "assistant" : "user",
    content: m.text,
  }));
}

export async function* streamClaudeChat(opts: {
  apiKey: string;
  systemInstruction: string;
  history: MessageParam[];
  message: string;
  idMap: ShortIdMap;
}): AsyncGenerator<StreamEvent> {
  try {
    const client = new Anthropic({ apiKey: opts.apiKey });
    const stream = client.messages.stream({
      model: process.env.CLAUDE_MODEL || DEFAULT_MODEL,
      max_tokens: 1024,
      system: opts.systemInstruction,
      tools: toClaudeTools(ADVISOR_TOOLS),
      messages: [...opts.history, { role: "user", content: opts.message }],
    });

    const blocks = new Map<number, { type: "text" | "tool_use"; name?: string; json: string }>();

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        const block = event.content_block;
        if (block.type === "text") {
          blocks.set(event.index, { type: "text", json: "" });
        } else if (block.type === "tool_use") {
          blocks.set(event.index, { type: "tool_use", name: block.name, json: "" });
        }
      } else if (event.type === "content_block_delta") {
        const tracked = blocks.get(event.index);
        if (!tracked) continue;
        if (event.delta.type === "text_delta") {
          yield { kind: "text", text: stripMarkdown(event.delta.text) };
        } else if (event.delta.type === "input_json_delta") {
          tracked.json += event.delta.partial_json;
        }
      } else if (event.type === "content_block_stop") {
        const tracked = blocks.get(event.index);
        if (!tracked) continue;
        if (tracked.type === "tool_use" && tracked.name) {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = tracked.json.length > 0 ? JSON.parse(tracked.json) : {};
          } catch {
            /* incomplete JSON - skip */
          }
          yield {
            kind: "tool",
            toolName: tracked.name,
            toolArgs: translateToolArgs(parsed, opts.idMap),
          };
        }
        blocks.delete(event.index);
      }
    }
    yield { kind: "done" };
  } catch (err) {
    yield { kind: "error", error: humanizeProviderError(err, "Claude") };
  }
}

export async function pingClaude(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: process.env.CLAUDE_MODEL || DEFAULT_MODEL,
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with the single word: OK" }],
    });
    const textBlock = res.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text : "";
    return { ok: text.trim().toUpperCase().includes("OK") };
  } catch (err) {
    return { ok: false, error: humanizeProviderError(err, "Claude") };
  }
}
