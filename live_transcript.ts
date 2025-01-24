import express, { Request, Response } from "express";
import axios from "axios";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

const TELNYX_PRIVATE_KEY = process.env.TELNYX_PRIVATE_KEY as string;
const TELNYX_PHONE_NUMBER = process.env.TELNYX_PHONE_NUMBER as string;
const CALL_CONTROL_APP_ID = process.env.CALL_CONTROL_APP_ID as string;
const WEBHOOK_URL = process.env.WEBHOOK_URL as string;
const OUTBOUND_VOICE_PROFILE_ID = process.env.OUTBOUND_VOICE_PROFILE_ID as string;
const TELNYX_API_KEY = process.env.TELNYX_API_KEY as string;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up WebSocket server
const wss = new WebSocketServer({ port: 8080 });
let activeClients: any[] = [];

wss.on("connection", (ws) => {
  console.log("WebSocket client connected");
  activeClients.push(ws);

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
    activeClients = activeClients.filter((client) => client !== ws);
  });
});

app.post("/make-call", async (req: Request, res: Response): Promise<void> => {
  const { to_number } = req.body;

  if (!to_number) {
    res.status(400).json({ message: "Missing 'to_number' in request body." });
    return;
  }

  try {
    const response = await axios.post(
      "https://api.telnyx.com/v2/calls",
      {
        connection_id: CALL_CONTROL_APP_ID,
        from: TELNYX_PHONE_NUMBER,
        to: to_number,
        outbound_voice_profile_id: OUTBOUND_VOICE_PROFILE_ID,
        webhook_url: WEBHOOK_URL,
        webhook_url_method: "POST",
      },
      {
        headers: {
          Authorization: `Bearer ${TELNYX_PRIVATE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      message: "Call initiated successfully",
      call_control_id: response.data.data.id,
    });
  } catch (error: any) {
    console.error("Error making outbound call:", error.response?.data || error.message);
    res.status(500).json({
      message: "Error making outbound call",
      error: error.response?.data || error.message,
    });
  }
});

app.post("/webhook", async (req: Request, res: Response) => {
  res.sendStatus(200);
  const payload = req.body;

  if (payload.data.event_type === "call.answered") {
    const callControlId = payload.data.payload.call_control_id;
    console.log("Call answered! Starting audio stream...");

    try {
      // Start audio streaming
      const streamResponse = await axios.post(
        `https://api.telnyx.com/v2/calls/${callControlId}/actions/stream_start`,
        {
          stream_url: `ws://localhost:8080/audio-stream`,
          channels: "single",
          format: "pcm",
        },
        {
          headers: {
            Authorization: `Bearer ${TELNYX_PRIVATE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Audio streaming started:", streamResponse.data);
    } catch (error: any) {
      console.error("Error starting audio stream:", error.response?.data || error.message);
    }
  } else if (payload.data.event_type === "media.stream") {
    const audioData = payload.data.payload.audio; // Incoming audio data

    // Send audio data to all connected WebSocket clients
    activeClients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(audioData);
      }
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
