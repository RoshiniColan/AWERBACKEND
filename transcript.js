import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import Telnyx from "telnyx";
import { fileURLToPath } from "url";
import deepgramSdk from "@deepgram/sdk";

dotenv.config();

const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

const telnyx = new Telnyx(process.env.TELNYX_PRIVATE_KEY);
const TELNYX_PHONE_NUMBER = process.env.TELNYX_PHONE_NUMBER;
const CALL_CONTROL_APP_ID = process.env.CALL_CONTROL_APP_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const OUTBOUND_VOICE_PROFILE_ID = process.env.OUTBOUND_VOICE_PROFILE_ID;
const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_KEY;

// Initialize Deepgram client once globally
const deepgram = new deepgramSdk.Deepgram(DEEPGRAM_API_KEY);

console.log("DEEPGRAM_API_KEY:", DEEPGRAM_API_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure recordings folder exists
const recordingsFolder = path.join(__dirname, "recordings");
if (!fs.existsSync(recordingsFolder)) {
  fs.mkdirSync(recordingsFolder);
}

// POST route to make a call
app.post("/make-call", async (req, res) => {
  const { to_number } = req.body;

  if (!to_number) {
    return res
      .status(400)
      .json({ message: "Missing 'to_number' in request body." });
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
          Authorization: `Bearer ${process.env.TELNYX_PRIVATE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Call Response:", response.data);
    res.json({
      message: "Call initiated successfully",
      call_control_id: response.data.data.id,
    });
  } catch (error) {
    console.error("Error making outbound call:", error.response?.data || error.message);
    res.status(500).json({
      message: "Error making outbound call",
      error: error.response?.data || error.message,
    });
  }
});

// Webhook handler
app.post("/webhook", async (req, res) => {
  console.log("Received Webhook Event:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);

  const eventType = req.body.data.event_type;
  const callControlId = req.body.data.payload.call_control_id;

  try {
    if (eventType === "call.answered") {
      console.log("Call answered! Starting transcription...");

      // Fork Telnyx call audio
      try {
        const forkResponse = await axios.post(
          `https://api.telnyx.com/v2/calls/${callControlId}/actions/fork_start`,
          {
            rx: "udp:192.168.29.86:9000", // Replace with your machine's IP and free port
            tx: "udp:192.168.29.86:9001", // Replace with your machine's IP and free port
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.TELNYX_PRIVATE_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
        console.log("Audio fork started:", forkResponse.data);
      } catch (error) {
        console.error("Error starting audio fork:", error.response?.data || error.message);
        return;
      }

      // Start Deepgram transcription
      const connection = await deepgram.transcription.live({
        model: "nova-2",
        language: "en-US",
        smart_format: true,
      });

      connection.on("open", () => {
        console.log("Connected to Deepgram WebSocket for live transcription.");
      });

      connection.on("transcriptReceived", (data) => {
        const transcript = data.channel.alternatives[0]?.transcript || "";
        if (transcript) {
          console.log("Live Transcription:", transcript);
        }
      });

      connection.on("close", () => {
        console.log("Deepgram WebSocket connection closed.");
      });

      connection.on("error", (err) => {
        console.error("Deepgram WebSocket error:", err);
      });
    } else if (eventType === "call.hangup") {
      console.log(`Call ${callControlId} has ended.`);
    } else if (eventType === "call.recording.saved") {
      console.log("Recording saved event received.");

      // Retrieve and save the recording
      const recordingUrl = req.body.data.payload.recording_urls?.wav;
      if (!recordingUrl) {
        console.error("Recording URL is missing in the webhook payload.");
        return;
      }

      const sanitizedCallControlId = callControlId.replace(/[^a-zA-Z0-9-_]/g, "_");
      const recordingFileName = `${sanitizedCallControlId}.wav`;

      console.log(`Downloading recording from ${recordingUrl}...`);
      const response = await axios({
        method: "get",
        url: recordingUrl,
        responseType: "stream",
      });

      const filePath = path.join(recordingsFolder, recordingFileName);
      const writer = fs.createWriteStream(filePath);

      response.data.pipe(writer);

      writer.on("finish", () => {
        console.log(`Recording saved to ${filePath}`);
      });

      writer.on("error", (err) => {
        console.error("Error saving recording:", err.message);
      });
    }
  } catch (error) {
    console.error("Error processing webhook event:", error.message);
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
