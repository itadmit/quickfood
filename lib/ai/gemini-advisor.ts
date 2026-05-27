import { GoogleGenerativeAI, SchemaType, type Content, type FunctionDeclaration } from "@google/generative-ai";
import type { ShortIdMap } from "./menu-snapshot";
import { ADVISOR_TOOLS } from "./prompt";
import type { ChatMessage, StreamEvent, ToolProperty, ToolSpec } from "./types";
import { humanizeProviderError, stripMarkdown, translateToolArgs } from "./text-utils";

function toGeminiTools(tools: ToolSpec[]): FunctionDeclaration[] {
  const mapType = (t: ToolProperty["type"]): SchemaType => {
    switch (t) {
      case "string":
        return SchemaType.STRING;
      case "integer":
        return SchemaType.INTEGER;
      case "number":
        return SchemaType.NUMBER;
      case "boolean":
        return SchemaType.BOOLEAN;
      case "array":
        return SchemaType.ARRAY;
    }
  };
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties: Object.fromEntries(
        Object.entries(t.parameters.properties).map(([k, v]) => [
          k,
          {
            type: mapType(v.type),
            description: v.description,
            ...(v.items ? { items: { type: mapType(v.items.type) } } : {}),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        ]),
      ),
      required: t.parameters.required,
    },
  }));
}

export function toGeminiHistory(messages: ChatMessage[]): Content[] {
  return messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));
}

export async function* streamGeminiChat(opts: {
  apiKey: string;
  systemInstruction: string;
  history: Content[];
  message: string;
  idMap: ShortIdMap;
}): AsyncGenerator<StreamEvent> {
  try {
    const genAI = new GoogleGenerativeAI(opts.apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      systemInstruction: opts.systemInstruction,
      tools: [{ functionDeclarations: toGeminiTools(ADVISOR_TOOLS) }],
    });
    const chat = model.startChat({ history: opts.history });
    const result = await chat.sendMessageStream(opts.message);

    for await (const chunk of result.stream) {
      const text = chunk.text?.();
      if (text) yield { kind: "text", text: stripMarkdown(text) };
      const calls = chunk.functionCalls?.();
      if (calls && calls.length > 0) {
        for (const call of calls) {
          const args = (call.args as Record<string, unknown>) ?? {};
          yield {
            kind: "tool",
            toolName: call.name,
            toolArgs: translateToolArgs(args, opts.idMap),
          };
        }
      }
    }
    yield { kind: "done" };
  } catch (err) {
    yield { kind: "error", error: humanizeProviderError(err, "Gemini") };
  }
}

export async function pingGemini(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
    const res = await model.generateContent("Reply with the single word: OK");
    const text = res.response.text();
    return { ok: text.trim().toUpperCase().includes("OK") };
  } catch (err) {
    return { ok: false, error: humanizeProviderError(err, "Gemini") };
  }
}
