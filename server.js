const express = require("express");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const PORT = process.env.PORT || 3000;

// Optional: set VPS_URL to your Windows exploit pipeline endpoint
// e.g. http://YOUR_VPS_IP:PORT/dump
const VPS_URL = process.env.VPS_URL || null;

app.use(express.json());

const decompileLog = [];

// ─── Roblox public API helpers ────────────────────────────────────────────────

async function getUniverseId(placeId) {
  const res = await axios.get(
    `https://apis.roblox.com/universes/v1/places/${placeId}/universe`,
    { timeout: 8000 }
  );
  return res.data.universeId;
}

async function getGameInfo(universeId) {
  const res = await axios.get(
    `https://games.roblox.com/v1/games?universeIds=${universeId}`,
    { timeout: 8000 }
  );
  return res.data.data[0] || null;
}

async function getThumbnailUrl(placeId) {
  try {
    const res = await axios.get(
      `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&size=512x512&format=Png&isCircular=false`,
      { timeout: 8000 }
    );
    return res.data.data[0]?.imageUrl || null;
  } catch {
    return null;
  }
}

async function fetchRobloxMeta(placeId) {
  try {
    const universeId = await getUniverseId(placeId);
    const [info, thumbnailUrl] = await Promise.all([
      getGameInfo(universeId),
      getThumbnailUrl(placeId),
    ]);
    return {
      universeId,
      name: info?.name || `Place_${placeId}`,
      creator: info?.creator?.name || "Unknown",
      creatorType: info?.creator?.type || "User",
      description: info?.description || "",
      visits: info?.visits ?? 0,
      maxPlayers: info?.maxPlayers ?? 0,
      genre: info?.genre || "All",
      thumbnailUrl,
    };
  } catch (err) {
    // Private or invalid place — return minimal info
    return {
      universeId: null,
      name: `Place_${placeId}`,
      creator: "Unknown",
      creatorType: "User",
      description: "",
      visits: 0,
      maxPlayers: 0,
      genre: "All",
      thumbnailUrl: null,
    };
  }
}

// ─── .rbxlx generator with real metadata ─────────────────────────────────────

function generateRbxlx(placeId, meta) {
  const ts = new Date().toISOString();
  const safeName = (meta.name || `Place_${placeId}`).replace(/[<>&"]/g, "");
  const safeDesc = (meta.description || "").replace(/[<>&"]/g, "").slice(0, 500);
  const safeCreator = (meta.creator || "Unknown").replace(/[<>&"]/g, "");

  return `<?xml version="1.0" encoding="utf-8"?>
<roblox xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
  <!--
    Decompiled by RBX Decompiler
    Place ID   : ${placeId}
    Universe ID: ${meta.universeId ?? "N/A"}
    Name       : ${safeName}
    Creator    : ${safeCreator} (${meta.creatorType})
    Visits     : ${meta.visits.toLocaleString()}
    Genre      : ${meta.genre}
    Dumped at  : ${ts}

    NOTE: Script bodies require a live exploit client on a Windows VPS.
    This dump contains real place metadata + structural placeholders.
  -->
  <Meta name="ExplicitAutoJoints">true</Meta>
  <External>null</External>
  <External>nil</External>
  <Item class="DataModel" referent="0">
    <Properties>
      <int name="PlaceId">${placeId}</int>
      <string name="Name">${safeName}</string>
    </Properties>

    <Item class="Workspace" referent="1">
      <Properties>
        <string name="Name">Workspace</string>
        <bool name="StreamingEnabled">false</bool>
        <float name="Gravity">196.2</float>
      </Properties>
    </Item>

    <Item class="ReplicatedStorage" referent="2">
      <Properties>
        <string name="Name">ReplicatedStorage</string>
      </Properties>
    </Item>

    <Item class="ServerScriptService" referent="3">
      <Properties>
        <string name="Name">ServerScriptService</string>
      </Properties>
      <Item class="Script" referent="4">
        <Properties>
          <string name="Name">MainServer</string>
          <ProtectedString name="Source"><![CDATA[
--[[
  Game  : ${safeName}
  By    : ${safeCreator}
  Visits: ${meta.visits.toLocaleString()}
  Desc  : ${safeDesc}

  Script bodies are extracted by a live exploit session.
  Connect VPS_URL in your Render environment to enable full dumps.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

print("[${safeName}] Server initialised. PlaceId=${placeId}")
          ]]></ProtectedString>
          <bool name="Disabled">false</bool>
        </Properties>
      </Item>
    </Item>

    <Item class="StarterPlayer" referent="5">
      <Properties>
        <string name="Name">StarterPlayer</string>
      </Properties>
      <Item class="StarterPlayerScripts" referent="6">
        <Properties>
          <string name="Name">StarterPlayerScripts</string>
        </Properties>
        <Item class="LocalScript" referent="7">
          <Properties>
            <string name="Name">MainClient</string>
            <ProtectedString name="Source"><![CDATA[
-- Client script placeholder for ${safeName}
local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer
print("[${safeName}] Client loaded for", LocalPlayer.Name)
            ]]></ProtectedString>
            <bool name="Disabled">false</bool>
          </Properties>
        </Item>
      </Item>
    </Item>

    <Item class="StarterGui" referent="8">
      <Properties>
        <string name="Name">StarterGui</string>
      </Properties>
    </Item>

    <Item class="Lighting" referent="9">
      <Properties>
        <string name="Name">Lighting</string>
        <float name="Brightness">2</float>
        <string name="TimeOfDay">14:00:00</string>
        <Color3 name="Ambient"><r>0</r><g>0</g><b>0</b></Color3>
        <Color3 name="OutdoorAmbient"><r>0.5</r><g>0.5</g><b>0.5</b></Color3>
        <bool name="GlobalShadows">true</bool>
      </Properties>
    </Item>

  </Item>
</roblox>`;
}

// ─── Gofile upload ────────────────────────────────────────────────────────────

async function uploadToGofile(placeId, meta) {
  const serverRes = await axios.get("https://api.gofile.io/servers", { timeout: 10000 });
  const server = serverRes.data.data.servers[0].name;

  const fileContent = generateRbxlx(placeId, meta);
  const safeName = (meta.name || `Place_${placeId}`).replace(/[^a-zA-Z0-9_\-]/g, "_");
  const fileName = `${safeName}_${placeId}.rbxlx`;
  const fileSizeBytes = Buffer.byteLength(fileContent, "utf8");

  const form = new FormData();
  form.append("file", Buffer.from(fileContent, "utf8"), {
    filename: fileName,
    contentType: "application/xml",
    knownLength: fileSizeBytes,
  });

  const uploadRes = await axios.post(
    `https://${server}.gofile.io/contents/uploadfile`,
    form,
    { headers: form.getHeaders(), timeout: 20000 }
  );

  return {
    download_url: uploadRes.data.data.downloadPage,
    file_size: fileSizeBytes < 1024 * 1024
      ? `${(fileSizeBytes / 1024).toFixed(1)} KB`
      : `${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB`,
    file_name: fileName,
  };
}

// ─── POST /api/decompile ──────────────────────────────────────────────────────

app.post("/api/decompile", async (req, res) => {
  const { place_id } = req.body;

  if (!place_id || !/^\d{1,15}$/.test(String(place_id))) {
    return res.status(400).json({ success: false, error: "Invalid place_id. Must be numeric." });
  }

  const pid = String(place_id);

  try {
    // ── Route 1: Real VPS exploit pipeline ────────────────────────────────────
    if (VPS_URL) {
      console.log(`[VPS] Forwarding place ${pid} to ${VPS_URL}`);
      const vpsRes = await axios.post(`${VPS_URL}/dump`, { place_id: pid }, { timeout: 120_000 });
      const { file_size, download_url, file_name, game_name, creator } = vpsRes.data;
      decompileLog.push({ place_id: pid, file_size, file_name, download_url, game_name, creator, timestamp: new Date().toISOString() });
      return res.status(200).json({ success: true, file_size, download_url, file_name, game_name, creator });
    }

    // ── Route 2: Real metadata + Gofile structural dump ───────────────────────
    console.log(`[META] Fetching Roblox metadata for place ${pid}…`);
    const meta = await fetchRobloxMeta(pid);
    console.log(`[META] Found: "${meta.name}" by ${meta.creator} (${meta.visits.toLocaleString()} visits)`);

    const { download_url, file_size, file_name } = await uploadToGofile(pid, meta);

    const entry = {
      place_id: pid,
      file_size,
      file_name,
      download_url,
      game_name: meta.name,
      creator: meta.creator,
      visits: meta.visits,
      genre: meta.genre,
      thumbnail_url: meta.thumbnailUrl,
      timestamp: new Date().toISOString(),
    };
    decompileLog.push(entry);

    return res.status(200).json({ success: true, ...entry });

  } catch (err) {
    console.error("Decompile error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/decompile/history ───────────────────────────────────────────────

app.get("/api/decompile/history", (_req, res) => {
  res.status(200).json({ success: true, count: decompileLog.length, data: decompileLog });
});

// ─── GET /api/health ──────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", vps_connected: !!VPS_URL, uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`🚀 RBX Decompile API on port ${PORT}`);
  console.log(`🔗 VPS pipeline: ${VPS_URL ? VPS_URL : "not configured (using metadata+Gofile)"}`);
});
