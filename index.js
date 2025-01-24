//working code of call recording

import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import Telnyx from "telnyx";
import { fileURLToPath } from "url"; // Import required for __dirname


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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure recordings folder exists
const recordingsFolder = path.join(__dirname, "recordings");
if (!fs.existsSync(recordingsFolder)) {
  fs.mkdirSync(recordingsFolder);
}
app.post("/make-call", async (req, res) => {
  const { to_number } = req.body;

  if (!to_number) {
    return res
      .status(400)
      .json({ message: "Missing 'to_number' in request body." });
  }

  try {
    // Initiate a call using the Call Control Application
    const response = await axios.post(
      "https://api.telnyx.com/v2/calls",
      {
        connection_id: CALL_CONTROL_APP_ID, // Call Control Application ID
        from: TELNYX_PHONE_NUMBER,
        to: to_number,
        outbound_voice_profile_id: OUTBOUND_VOICE_PROFILE_ID, // Required for outbound calls
        webhook_url: "https://0a26-2405-201-e02d-906d-748b-7fde-e377-442a.ngrok-free.app/webhook",
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
    console.error(
      "Error making outbound call:",
      error.response?.data || error.message
    );
    res.status(500).json({
      message: "Error making outbound call",
      error: error.response?.data || error.message,
    });
  }
});

app.post("/webhook", async (req, res) => {
  console.log("Received Webhook Event:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);

  const eventType = req.body.data.event_type;
  const callControlId = req.body.data.payload.call_control_id;

  try {
    if (eventType === "call.answered") {
      console.log("Call answered! Starting recording...");

      // Start recording the call
      const recordResponse = await axios.post(
        `https://api.telnyx.com/v2/calls/${callControlId}/actions/record_start`,
        {
          format: "wav", // Audio file format
          channels: "single", // Single channel recording
          play_beep: true, // Beep at the start of recording
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.TELNYX_PRIVATE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`Recording started for call ${callControlId}:`, recordResponse.data);
      const speakResponse = await axios.post(
        `https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`,
        {
          payload: "This is Agent Ai. I am here to assist you.", // The speech text
          payload_type: "text", // Text-to-speech
          service_level: "basic", // Service level for speech
          stop: "current", // Stop current media
          voice: "female", // Voice gender
          language: "en-US", // Language for the speech
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.TELNYX_PRIVATE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`Speech played for call ${callControlId}:`, speakResponse.data);
    } else if (eventType === "call.hangup") {
      console.log(`Call ${callControlId} has ended.`);
    } else if (eventType === "call.recording.saved") {
      console.log("Recording saved event received.");

      // Retrieve recording URL and sanitize filename
      const recordingUrl = req.body.data.payload.recording_urls?.wav;
      if (!recordingUrl) {
        console.error("Recording URL is missing in the webhook payload.");
        return;
      }

      // Sanitize call_control_id for use as a filename
      const sanitizedCallControlId = callControlId.replace(/[^a-zA-Z0-9-_]/g, "_");
      const recordingFileName = `${sanitizedCallControlId}.wav`;

      console.log(`Downloading recording from ${recordingUrl}...`);

      // Download the recording and save it to the recordings folder
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
