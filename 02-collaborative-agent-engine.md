# Symposium — A Collaborative Multi-Agent Engine (+ "Research with Friends" as Skin #1)

> **Working title:** Symposium (rename freely)
> **One-liner:** A real-time room where you + your friends *and* AI agents research and think together — humans direct and react, agents do the legwork live, and a shared sourced artifact builds itself.
> **The real product:** a **horizontal engine** = `shared real-time workspace + autonomous agent runtime + multi-human-in-the-loop`. "Research with friends" is **vertical skin #1** (fun + dogfoodable). A serious commercial vertical (e.g. Incident War Room) is **skin #2**, added later against the same engine — no rewrite.

---

## 1. The architecture insight (why this is built horizontal-first)
Incident war room, research war room, vibe-coding — underneath they're the *same primitive*. So we build the primitive once (the engine) and ship one **skin** at a time.

| Horizontal ENGINE (build once, reusable) | Vertical SKIN (swap per use case) |
|---|---|
| Rooms, membership, presence | Agent **tool pack** (research: web search + browser + scrape + cite) |
| Real-time sync of shared state (CRDT/WS) | Agent **behavior / playbook** (research: decompose → gather → synthesize) |
| Agent runtime (observe→think→act loop, streamed) | **Artifact template** (research: sourced board / mind-map) |
| Shared session context & memory | **Trigger** (research: someone asks a question) |
| Human-in-the-loop: interrupt / steer / approve / branch | **Output** (research: shareable sourced report) |
| Multi-agent + multi-human coordination, audit, replay | **Fun affordances** (reactions, chat, "who found this", voting) |

> **Rule:** Build the engine with clean interfaces; ship exactly ONE skin at a time. Never build "a room for anything" — that's a non-product. The engine is the impressive tech; the skin makes it real.

---

## 2. Skin #1: "Research with Friends" (the fun, dogfoodable MVP target)
You share a room link. 2–4 friends join. There's a shared **research board** + live chat + presence. Anyone asks the AI a question; an **agent runs in the background** (web search → later browser-use), streaming what it finds as **sourced cards** onto the board that everyone sees live. People add their own queries, branch into sub-topics, annotate, react. The session's findings accumulate into a shared, cited mind-map you can export.

*Why this skin first:* it's genuinely **fun** (high motivation = you'll finish it), low-stakes (no enterprise buyer to satisfy), and it still forces **every hard engine problem**. It uses your existing edge: agents + browser-use + RAG.

---

## 3. The hard / impressive parts = the engine (this is the backend gold)
- **Real-time multi-human + multi-agent shared state**, conflict-free (CRDT) — the part that's genuinely hard and rare.
- **Agent task dispatch + worker isolation** (agents run as queued workers, not in the request path).
- **Streaming agent output to many clients** with backpressure.
- **Shared session memory/context** both agents and humans read/write.
- **Event-sourced audit + replay** of the whole session.
- **Scaling WebSocket fan-out** across instances (Redis pub/sub).

---

## 4. MVP first (the smallest fun thing — ship this before anything fancy)
- Room by shareable link; friends join; presence + shared chat.
- One shared research board (cards).
- Ask the AI → an agent does web search + summarize → results stream in as cards, live for everyone.
- Anyone can add/edit cards and react.

That alone is dogfoodable on a Friday night with friends — and it already required rooms + realtime sync + agent runtime + streaming + shared state.

---

## 5. Roadmap — overlaid on `Backend_journey`
The engine is your **"Diverge" project**: each curriculum phase ships one real piece of it. Respect the rules (no AI while coding; build toy versions first).

### Stage 0 — Foundations (Phases 1–2 · files 01–08)
Concurrency model + **streams/backpressure** (06) + **TCP/HTTP** (07) — the substrate streaming + realtime live on.

### Stage 1 — Rooms + Realtime Core 🏁 M1 (file 09 + 20)
Build toy Express (09), then real framework. WebSocket server: create/join room, presence, broadcast a shared chat. **M1: friends can join a room and see each other live.**

### Stage 2 — Shared State (CRDT) 🏁 M2 (file 10 + preview of 22 CRDTs)
Build toy Redis (10) → use real Redis for pub/sub fan-out across connections. Shared **research board** state synced conflict-free (start with a simple CRDT or last-writer-wins, upgrade later). **M2: everyone edits one board in real time.**

### Stage 3 — Agent Runtime 🏁 M3 (files 08 workers + 37 AI patterns)
Agents run as **background workers** (child_process/worker threads). Observe→think→act loop; tool = web search; **stream** tokens + result cards into the room. **M3: ask the AI, watch it research live for the whole room.** ← *this is the MVP from §4.*

### Stage 4 — Persistence + Shared Memory 🏁 M4 (files 11–14, 18)
Postgres for rooms/boards/messages; **vector store** for session memory (so agents recall earlier findings, RAG over the board). Caching (18) for presence/hot state. **M4: sessions persist; agents remember context.**

### Stage 5 — Auth + Sharing 🏁 M5 (files 15–17)
Auth, room permissions (owner/guest), shareable invite links, rate limits. **M5: safe to share a link publicly.**

### Stage 6 — Queues + Multi-Agent + Coordination 🏁 M6 (files 19, 21, 23, 24)
Kafka/BullMQ for agent task dispatch; **multiple concurrent agents** + humans; coordinate (task queue, locks, surface conflicts/duplicate work); **event-sourcing** for replay. **M6: several agents + people work at once without chaos.**

### Stage 7 — Distributed + Scale 🏁 M7 (files 22, 24)
Scale WebSocket fan-out across instances (Redis pub/sub / sticky sessions), distributed presence, idempotent agent actions, circuit breakers on flaky tools. **M7: more than one server instance, still one coherent room.**

### Stage 8 — Deploy + Observe 🏁 M8 (files 26–30)
Docker, CI/CD, AWS, **OpenTelemetry/Prometheus/Grafana** — trace agent actions, room metrics. **M8: deployed, monitored, shareable URL.**

### Stage 9 — Polish + Skin #2 (vertical) 🏁 M9 (files 31–40)
System-design write-up (RFC), CDC search over sessions, load test, evals on the research agent. Then prove the architecture: **build vertical Skin #2** (Incident War Room = new tool pack + behavior + artifact, same engine). **M9: two skins on one engine = the platform thesis proven.**

---

## 6. New tech to learn (specific to this)
- **CRDTs / conflict-free replicated state** (the signature skill — Yjs/Automerge concepts, then your own).
- **WebSocket scaling** (pub/sub fan-out, presence across instances).
- **Agent-as-worker** patterns (running long agent loops off the request path, streaming back).
- **Shared agent memory** (vector + structured, multi-writer).
- Browser-use / autonomous gathering (you have a head start), evals for the research agent.

## 7. Relationship to the other flagship (Aegis)
- **Aegis (MCP gateway):** security-flavored, infra. **Symposium (this):** collaboration-flavored, realtime/CRDT.
- Both cover ~80–90% of the backend curriculum. Pick **one** as the primary capstone; the other can be a smaller second project or shelved.
- Symposium's edge: it's *fun to build* (friends use it), more visually demo-able, and the multi-human+multi-agent realtime problem is genuinely rare/impressive.

## 8. Next actions
- [ ] Rename; create repo (private until MVP).
- [ ] Decide: is Symposium the **primary capstone** (replacing Aegis) or a second project?
- [ ] Stand up Stage 1: a room + presence + shared chat (the realtime spine).
- [ ] Reach M3 (live research board) — the first "show friends" moment — before adding anything else.
