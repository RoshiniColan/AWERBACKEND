import { WebSocketServer } from "ws";
import WebSocket from "ws";
import { WavEncoder } from "wav"; // For converting PCM data to WAV
import dotenv from "dotenv";

dotenv.config();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

// Create WebSocket server
const wsServer = new WebSocketServer({ port: 3000 });

// Helper to encode raw PCM into WAV format
const encodeWAV = (pcmBuffer, sampleRate = 8000) => {
  return WavEncoder.encodeSync({
    sampleRate,
    channelData: [pcmBuffer],
  });
};

wsServer.on("connection", (clientSocket) => {
  console.log("Client connected.");

  // Create Deepgram WebSocket connection
  const deepgramSocket = new WebSocket(
    `wss://api.deepgram.com/v1/listen?punctuate=true&interim_results=true&language=en-US`,
    {
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
      },
    }
  );

  // Handle Deepgram WebSocket opening
  deepgramSocket.onopen = () => {
    console.log("Connected to Deepgram WebSocket.");
  };

  // Process incoming audio from Telnyx and forward to Deepgram
  clientSocket.on("message", (message) => {
    console.log("Received audio chunk from Telnyx.");

    // Assume the audio is PCM (if PCMU, decode first)
    const sampleRate = 8000; // Adjust as per Telnyx settings
    const wavBuffer = encodeWAV(Buffer.from(message), sampleRate);

    if (deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.send(wavBuffer);
    } else {
      console.warn("Deepgram WebSocket is not ready.");
    }
  });

  // Handle transcription responses from Deepgram
  deepgramSocket.onmessage = (event) => {
    try {
      const response = JSON.parse(event.data);
      const transcript = response.channel?.alternatives?.[0]?.transcript || "";

      if (transcript) {
        console.log("Transcription:", transcript);

        // Optionally send transcription back to the client
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({ transcript }));
        }
      }
    } catch (err) {
      console.error("Error parsing Deepgram response:", err);
    }
  };

  // Error handling for Deepgram WebSocket
  deepgramSocket.onerror = (error) => {
    console.error("Deepgram WebSocket error:", error);
  };

  // Handle Deepgram WebSocket closure
  deepgramSocket.onclose = () => {
    console.log("Deepgram WebSocket connection closed.");
  };

  // Handle client disconnection
  clientSocket.on("close", () => {
    console.log("Client disconnected.");
    if (deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.close();
    }
  });

  // Handle client WebSocket errors
  clientSocket.on("error", (error) => {
    console.error("Client WebSocket error:", error);
  });
});

console.log("WebSocket server running on ws://localhost:3000");
