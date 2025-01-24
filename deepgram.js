// Example filename: index.mjs (or keep it as .js with "type": "module" in package.json)

import deepgramSdk from "@deepgram/sdk";
import dotenv from "dotenv";
import WebSocket from "ws";

dotenv.config();

// WebSocket URL for the audio stream you want to transcribe
const websocketUrl = "wss://71c6-2405-201-e02d-906d-38bf-933e-9570-c79.ngrok-free.app"; // Replace with your WebSocket URL

const live = async () => {
  // STEP 1: Create a Deepgram client using the API key
  const deepgram = new deepgramSdk.Deepgram(process.env.DEEPGRAM_KEY);

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

    // STEP 4: Connect to the WebSocket stream and forward data to Deepgram
    const ws = new WebSocket(websocketUrl);

    ws.on("open", () => {
      console.log("WebSocket connection established with audio source.");
    });

    ws.on("message", (message) => {
      connection.send(message); // Forward audio data to Deepgram
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
    });

    ws.on("close", () => {
      console.log("WebSocket connection closed.");
      connection.finish(); // End the Deepgram session
    });
};

live();
