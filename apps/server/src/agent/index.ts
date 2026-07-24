import { GoogleGenAI, type Content, type Part, type GenerateContentResponse } from "@google/genai";
import { createCardDecl, RESEARCH_PROMPT, SYNTHESIS_PROMPT } from "./tools";

// The key is loaded by `import "dotenv/config"` at the very top of src/index.ts,
// which runs before this module is ever imported. Fail loud if it's missing —
// same pattern as lib/jwt.ts with JWT_SECRET.
const KEY = process.env.GEMINI_API_KEY ?? "";
if (!KEY) throw new Error("GEMINI_API_KEY is not set");

const ai = new GoogleGenAI({ apiKey: KEY });

// gemini-2.5-flash: the free-tier workhorse. (gemini-3.x flash is premium — no free
// quota, it 429s immediately.) 2.5 can't run Google Search + a custom tool in ONE
// request, so we split the work into two phases below.
const MODEL = "gemini-2.5-flash";

// Safety cap on the phase-2 card loop: never spin forever (runaway cost/time).
const MAX_CARD_TURNS = 6;

type Source = { url: string; title: string };

type RunOpts = {
  question: string;
  // called for every card the model decides to add — persists + broadcasts it
  onCard: (card: { text: string; sourceUrl?: string; sourceTitle?: string }) => Promise<void>;
  // called for status/summary lines shown in the room's chat (ephemeral)
  onNotice: (text: string) => void;
};

export async function runAgent({ question, onCard, onNotice }: RunOpts): Promise<void> {
  // ── PHASE 1 — GATHER: research with Google Search grounding, no custom tools ──
  const research = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: question }] }],
    config: { systemInstruction: RESEARCH_PROMPT, tools: [{ googleSearch: {} }] },
  });

  const briefing = research.text?.trim() ?? "";
  const sources = extractSources(research); // real URLs Google actually grounded on

  if (!briefing) {
    onNotice("⚠️ Couldn't find anything to research.");
    return;
  }
  onNotice(`🔎 Read ${sources.length} source${sources.length === 1 ? "" : "s"} — writing cards…`);

  // ── PHASE 2 — SYNTHESIZE: turn the briefing into sourced cards (create_card only) ──
  // Seed the transcript with the briefing + the source list the model may cite from.
  const sourceList = sources.length
    ? sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`).join("\n")
    : "(no sources captured — you may omit sourceUrl)";

  const contents: Content[] = [
    {
      role: "user",
      parts: [
        {
          text:
            `Question: ${question}\n\n` +
            `Research briefing:\n${briefing}\n\n` +
            `Available sources:\n${sourceList}`,
        },
      ],
    },
  ];

  // Short observe→act loop: the model calls create_card N times, then finishes with text.
  for (let turn = 0; turn < MAX_CARD_TURNS; turn++) {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction: SYNTHESIS_PROMPT, tools: [{ functionDeclarations: [createCardDecl] }] },
    });

    const calls = res.functionCalls ?? [];

    // No tool calls => the model is done. Its text is the wrap-up.
    if (calls.length === 0) {
      const summary = res.text?.trim();
      onNotice(summary ? `✅ ${summary}` : "✅ Research complete.");
      return;
    }

    // Record the model's turn verbatim — it holds the functionCall parts we must answer.
    const modelTurn = res.candidates?.[0]?.content;
    if (modelTurn) contents.push(modelTurn);

    // Run each create_card, and build one functionResponse per call (one-to-one, required).
    const replies: Part[] = [];
    for (const call of calls) {
      if (call.name === "create_card") {
        const args = call.args ?? {};
        const text = typeof args.text === "string" ? args.text.trim() : "";
        if (text) {
          await onCard({
            text,
            sourceUrl: typeof args.sourceUrl === "string" ? args.sourceUrl : undefined,
            sourceTitle: typeof args.sourceTitle === "string" ? args.sourceTitle : undefined,
          });
        }
      }
      replies.push({
        functionResponse: { name: call.name ?? "create_card", response: { output: "saved" } },
      });
    }

    contents.push({ role: "user", parts: replies });
  }

  onNotice("✅ Research complete (reached step limit).");
}

// Pull the web sources Google grounded its answer on, deduped by URL.
function extractSources(res: GenerateContentResponse): Source[] {
  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const ch of chunks) {
    const uri = ch.web?.uri;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      out.push({ url: uri, title: ch.web?.title ?? uri });
    }
  }
  return out;
}
