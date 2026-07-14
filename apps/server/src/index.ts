import "dotenv/config"; // MUST be first — load env before anything imports Prisma
import express from "express";
import authRouter from "./routes/auth";
import { attachRealtime } from "./realtime/server";

const app = express();
const PORT = 4000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "symposium-server" });
});

app.use("/auth", authRouter); // every route in auth.ts is prefixed with /auth

const server = app.listen(PORT, () => {
  console.log(`🏛️  Symposium server alive on http://localhost:${PORT}`);
});

attachRealtime(server); // wire WebSockets onto the same HTTP server
