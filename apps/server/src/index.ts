import "dotenv/config"; // MUST be first — load env before anything imports Prisma
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import { attachRealtime } from "./realtime/server";

// Hosts (Render) ASSIGN the port via process.env.PORT — we must use it, not a fixed 4000.
const PORT = Number(process.env.PORT) || 4000;

// Browser origins allowed to call this API. localhost is ALWAYS allowed (dev);
// add prod URLs via the CORS_ORIGIN env var (comma-separated for more than one),
// each WITHOUT a trailing slash — an origin is scheme+host+port only.
const CORS_ORIGINS = [
  "http://localhost:3000",
  ...(process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()) ?? []),
];

const app = express();
app.use(cors({ origin: CORS_ORIGINS })); // let the web app read our responses
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "symposium-server" });
});

app.use("/auth", authRouter); // every route in auth.ts is prefixed with /auth

const server = app.listen(PORT, () => {
  console.log(`🏛️  Symposium server alive on port ${PORT}`);
});

attachRealtime(server); // wire WebSockets onto the same HTTP server
