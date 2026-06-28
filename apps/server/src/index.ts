import express from "express";

const app = express();
const PORT = 4000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "symposium-server" });
});

app.listen(PORT, () => {
  console.log(`🏛️  Symposium server alive on http://localhost:${PORT}`);
});
