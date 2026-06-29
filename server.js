const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const decompileLog = [];

app.post("/api/decompile", (req, res) => {
  const { place_id } = req.body;
  if (!place_id || !/^\d{1,15}$/.test(String(place_id))) {
    return res.status(400).json({ success: false, error: "Invalid place_id." });
  }
  const seed = parseInt(String(place_id).slice(-3), 10) || 512;
  const sizeMb = (1.2 + (seed % 80) / 10).toFixed(1);
  const file_size = `${sizeMb} MB`;
  const download_url = `https://gofile.io/d/mock_${place_id}`;
  decompileLog.push({ place_id, file_size, download_url, timestamp: new Date().toISOString() });
  return res.status(200).json({ success: true, file_size, download_url });
});

app.get("/api/decompile/history", (_req, res) => {
  res.status(200).json({ success: true, data: decompileLog });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.listen(PORT, () => console.log(`🚀 RBX Decompile API listening on port ${PORT}`));
