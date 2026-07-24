import { Type } from "@google/genai";

// ── VERTICAL SKIN — the research agent's ONE custom tool ─────────────────────
// This is the bridge between the model's thinking and our shared board. When the
// model decides a fact is worth showing, it "calls" create_card; our loop turns
// that call into a real, persisted, broadcast card that everyone in the room sees.
//
// Note what is NOT here: web search. That's a BUILT-IN Google tool (see index.ts) —
// Google runs it on their servers, we never execute it. create_card is the only
// tool WE actually run.
export const createCardDecl = {
  name: "create_card",
  description:
    "Add ONE sourced research finding to the shared board that all participants see live. " +
    "Call this once per distinct fact or idea. Prefer several small cards over one long card.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: {
        type: Type.STRING,
        description: "The finding itself: 1-2 concrete sentences a general reader can understand.",
      },
      sourceUrl: {
        type: Type.STRING,
        description: "The URL this finding came from. Only a real URL you actually used — never invented.",
      },
      sourceTitle: {
        type: Type.STRING,
        description: "The title of the source page or publication.",
      },
    },
    required: ["text"], // a card must have text; a source is strongly encouraged but not forced
  },
};

// ── VERTICAL SKIN — the research "playbook", in TWO phases ───────────────────
// gemini-2.5-flash (free tier) refuses to run Google Search + a custom tool in the
// same request, so the "gather" and "synthesize" steps of decompose→gather→synthesize
// (CLAUDE.md §3) become two separate model calls, each with ONE kind of tool.

// PHASE 1 — gather: Google Search only. Produce a grounded briefing (sources come
// back automatically as groundingMetadata, which the engine harvests).
export const RESEARCH_PROMPT = `You are a research assistant. A human has asked a question.

Use Google Search to find current, accurate, specific information, then write a concise briefing that answers the question. Organize it as several distinct factual points. Prefer reputable, primary sources. Be concrete — names, numbers, dates — not vague. Never invent facts or sources.`;

// PHASE 2 — synthesize: create_card only. Turn the briefing into small sourced cards.
export const SYNTHESIS_PROMPT = `You turn a research briefing into cards for a shared board that several people are watching live.

Your job:
1. Break the briefing into SMALL, self-contained findings — one fact or idea per card.
2. For EACH finding, call create_card exactly once. Give it concrete 1-2 sentence text.
3. Whenever a finding matches one of the provided sources, include that source's exact sourceUrl and sourceTitle.
4. Aim for 3-6 cards. When every card is added, STOP calling create_card and reply with a single-sentence summary.

Never invent a URL — only use URLs from the provided source list.`;
