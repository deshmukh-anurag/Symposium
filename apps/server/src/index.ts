import express from "express";
import { WebSocketServer } from "ws";

const app = express();
const PORT = 4000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "symposium-server" });
});

// app.listen returns the underlying Node HTTP server — we capture it...
const server = app.listen(PORT, () => {
  console.log(`🏛️  Symposium server alive on http://localhost:${PORT}`);
});

// ...and attach a WebSocket server to that SAME http server (shares port 4000).
const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  console.log("🔌 a client connected");
  socket.send("👋 welcome to Symposium");

  socket.on("message", (data) => {
    const text = data.toString();           // incoming data is bytes; make it a string
    console.log("received:", text);
    socket.send(`echo: ${text}`);           // push a reply back down the same line
  });

  socket.on("close", () => {
    console.log("👋 a client disconnected");
  });
});
