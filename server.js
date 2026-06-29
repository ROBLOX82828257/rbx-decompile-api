const express = require("express");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const decompileLog = [];

function generateRbxlx(placeId) {
  const ts = new Date().toISOString();
  return `<?xml version="1.0" encoding="utf-8"?>
<roblox xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
  <!-- Decompiled by RBX Decompiler | PlaceId: ${placeId} | ${ts} -->
  <Item class="DataModel" referent="0">
    <Properties>
      <int name="PlaceId">${placeId}</int>
      <string name="Name">DecompiledPlace_${placeId}</string>
    </Properties>
    <Item class="Workspace" referent="1">
      <Properties><string name="Name">Workspace</string></Properties>
      <Item class="Script" referent="2">
        <Properties>
          <string name="Name">DecompiledScript</string>
          <ProtectedString name="Source"><![CDATA[
-- Decompiled script placeholder
-- Place ID: ${placeId} | ${ts}
local Players = game:GetService("Players")
print("Place ${placeId} loaded.")
          ]]></ProtectedString>
        </Properties>
      </Item>
    </Item>
    <Item class="ReplicatedStorage" referent="3"><Properties><string name="Name">ReplicatedStorage</string></Properties></Item>
    <Item class="ServerScriptService" referent="4"><Properties><string name="Name">ServerScriptService</string></Properties></Item>
    <Item class="StarterGui" referent="5"><Properties><string name="Name">StarterGui</string></Properties></Item>
  </Item>
</roblox>`;
}

async function uploadToGofile(placeId) {
  const serverRes = await axios.get("https://api.gofile.io/servers", { timeout: 10000 });
  const server = serverRes.data.data.servers[0].name;

  const fileContent = generateRbxlx(placeId);
  const fileName = `DecompiledPlace_${placeId}.rbxlx`;
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

  const { downloadPage } = uploadRes.data.data;
  return {
    download_url: downloadPage,
    file_size: `${(fileSizeBytes / 1024).toFixed(1)} KB`,
    file_name: fileName,
  };
}

app.post("/api/decompile", async (req, res) => {
  const { place_id } = req.body;
  if (!place_id || !/^\d{1,15}$/.test(String(place_id))) {
    return res.status(400).json({ success: false, error: "Invalid place_id." });
  }
  try {
    const { download_url, file_size, file_name } = await uploadToGofile(String(place_id));
    decompileLog.push({ place_id, file_size, file_name, download_url, timestamp: new Date().toISOString() });
    return res.status(200).json({ success: true, file_size, download_url, file_name });
  } catch (err) {
    console.error("Gofile upload failed:", err.message);
    return res.status(500).json({ success: false, error: "Upload failed: " + err.message });
  }
});

app.get("/api/decompile/history", (_req, res) => {
  res.status(200).json({ success: true, data: decompileLog });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.listen(PORT, () => console.log(`🚀 RBX Decompile API listening on port ${PORT}`));
