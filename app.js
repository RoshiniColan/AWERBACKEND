//working code of call recording

import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import Telnyx from "telnyx";
import { fileURLToPath } from "url"; // Import required for __dirname
import { v4 as uuidv4 } from 'uuid';
import WebSocket from "ws"; // Import WebSocket client
import fetch from "cross-fetch";
import deepgramSDK from "@deepgram/sdk";
const Deepgram = deepgramSDK.Deepgram;

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
const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure recordings folder exists
const recordingsFolder = path.join(__dirname, "recordings");
if (!fs.existsSync(recordingsFolder)) {
  fs.mkdirSync(recordingsFolder);
}

// Create a WebSocket client connection to Render's WebSocket server
const ws = new WebSocket("wss://awerbackend.onrender.com");

ws.on("open", () => {
  console.log("WebSocket connection established with Render server.");
});

ws.on("message", (message) => {
  console.log("Message received from WebSocket server:", message);
});

ws.on("close", () => {
  console.log("WebSocket connection closed.");
});

ws.on("error", (error) => {
  console.error("WebSocket error:", error);
});



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
        webhook_url: "https://71c6-2405-201-e02d-906d-38bf-933e-9570-c79.ngrok-free.app/webhook",
        webhook_url_method: "POST",
        // stream_url: "wss://71c6-2405-201-e02d-906d-38bf-933e-9570-c79.ngrok-free.app",
        // stream_track:"both_tracks",
        // stream_bidirectional_mode:"rtp",
        // command_id: uuidv4(), 
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
  // console.log("Received Webhook Event:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);

  const eventType = req.body.data.event_type;
  const callControlId = req.body.data.payload.call_control_id;

  try {
    if (eventType === "call.initiated") {
      console.log(`Inbound call initiated. Call Control ID: ${callControlId}`);

      // Answer the inbound call
      // try {
      //   const answerResponse = await axios.post(
      //     `https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`,
      //     {
      //       send_silence_when_idle: true,
      //       webhook_url: "https://71c6-2405-201-e02d-906d-38bf-933e-9570-c79.ngrok-free.app/webhook",
      //       webhook_url_method: "POST",
      //       // stream_url: "wss://71c6-2405-201-e02d-906d-38bf-933e-9570-c79.ngrok-free.app",
      //       // stream_track:"both_tracks"
      //     },
      //     {
      //       headers: {
      //         Authorization: `Bearer ${process.env.TELNYX_PRIVATE_KEY}`,
      //         "Content-Type": "application/json",
      //       },
      //     }
      //   );
      //   console.log("Inbound call answered. Response:", answerResponse.data);
      // } catch (err) {
      //   console.error("Error answering call:", err.response.data.errors);
      // }
    } else if (eventType === "call.answered") {
      console.log("Call answered! Starting recording...");

       // Send a message to the WebSocket server on Render
      //  if (ws.readyState === WebSocket.OPEN) {
      //   ws.send(JSON.stringify({ event: "call.answered", callControlId }));
      // }

      const streamingResponse = await axios.post(
        `https://api.telnyx.com/v2/calls/${callControlId}/actions/streaming_start`,
        {
          stream_url: "wss://awerbackend.onrender.com",
          stream_track: "both_tracks",
          stream_bidirectional_mode: "rtp",
  //         "client_state": "aGF2ZSBhIG5pY2UgZGF5ID1d",
  // "command_id": "891510ac-f3e4-11e8-af5b-de00688a4901",
  client_state: "aGF2ZSBhIG5pY2UgZGF5ID1d",
  command_id: uuidv4(), 
  enable_dialogflow: false,
  stream_bidirectional_codec: "PCMU",
  dialogflow_config: {
    analyze_sentiment: false,
    partial_automated_agent_reply: false
  }
        // Add these additional parameters
        // stream_type: "websocket",
        // stream_protocol: "websocket"  
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.TELNYX_PRIVATE_KEY}`,
            "Content-Type": "application/json",
            'Accept': 'application/json'
          },
        }
      );


      console.log(`streaming started for call ${callControlId}:`, streamingResponse.data);

  
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


      // Speak on the call using the gather_using_speak API
      const gatherPayload = {
        payload: "Welcome to our service. Please press 1 for sales, 2 for support.",
        invalid_payload: "Welcome to AWER",
        payload_type: "text",
        service_level: "premium",
        voice: "male", // Specify voice
        language: "en-US", // Specify language
        minimum_digits: 1,
        maximum_digits: 1,
        valid_digits: "12", // Accept only 1 or 2 as valid input
        terminating_digit: "#", // Input ends with #
        inter_digit_timeout_millis: 5000,
        timeout_millis: 60000, // Timeout for waiting user input
      };

      try {
        const response = await axios.post(
          `https://api.telnyx.com/v2/calls/${callControlId}/actions/gather_using_speak`,
          gatherPayload,
          {
            headers: {
              Authorization: `Bearer ${TELNYX_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("Gather using speak initiated:", response.data);


      } catch (err) {
        console.error("Error initiating gather using speak:", err.response?.data || err.message);
      }
    } else if (eventType === "call.dtmf.received") {
      const receivedDigit = req.body.data.payload.digits;
      console.log(`DTMF digit received: ${receivedDigit}`);
    } else if (eventType === "call.gather.ended") {
      console.log("Gather operation ended.");
    }  else if (eventType === "call.hangup") {
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
    console.error("Error processing webhook event:", error);
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
