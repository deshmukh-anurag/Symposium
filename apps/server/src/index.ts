import "dotenv/config"; // MUST be first — load env before anything imports Prisma
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import { attachRealtime } from "./realtime/server";

// Hosts (Render) ASSIGN the port via process.env.PORT — we must use it, not a fixed 4000.
const PORT = Number(process.env.PORT) || 4000;

// In prod, set CORS_ORIGIN to the deployed web URL (comma-separated allows more than one).
// Falls back to localhost so `npm run dev` still works unchanged.
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? "http://localhost:3000",
  "https://symposium-web.vercel.app/"
)
  .split(",")
  .map((o) => o.trim());

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
