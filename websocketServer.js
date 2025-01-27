import { WebSocketServer } from "ws";
import WebSocket from "ws";
import dotenv from "dotenv";

dotenv.config();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

// Create WebSocket server
const wsServer = new WebSocketServer({ port: 3000 });

// Audio chunk queue for buffering data until Deepgram WebSocket is ready
const audioChunkQueue = [];

// Detect the audio format for logging or processing purposes
function detectAudioFormat(data) {
  if (data instanceof Buffer || data instanceof Uint8Array) {
    const hex = data.toString("hex", 0, 4); // First 4 bytes as hex
    if (hex === "52494646") return "WAV"; // "RIFF" (WAV header)
    if (hex.startsWith("494433")) return "MP3"; // "ID3" (MP3 metadata)
    if (hex.startsWith("8000")) return "RTP/PCMU"; // RTP/PCMU indicator (example)
    return "Unknown/Raw Audio";
  }
  return "Unknown (Not a Buffer)";
}

// Handle incoming WebSocket connections from Telnyx clients
wsServer.on("connection", (socket) => {
  console.log("Client connected.");

  // Initialize Deepgram WebSocket
  const deepgramSocket = new WebSocket("wss://api.deepgram.com/v1/listen", {
    headers: {
      Authorization: `Token ${DEEPGRAM_API_KEY}`,
    },
  });

  // Handle Deepgram WebSocket connection
  deepgramSocket.onopen = () => {
    console.log("Connected to Deepgram WebSocket.");

    // Send any queued audio chunks to Deepgram
    while (audioChunkQueue.length > 0) {
      const chunk = audioChunkQueue.shift();
      console.log("Sending queued audio chunk:", detectAudioFormat(chunk));
      deepgramSocket.send(chunk);
    }
  };

  // Handle incoming audio from Telnyx
  socket.on("message", (message) => {
    try {
      const isJson = message.toString().startsWith("{");

      if (isJson) {
        // Parse Telnyx JSON messages
        const parsed = JSON.parse(message.toString());

        if (parsed.event === "media" && parsed.media?.payload?.data) {
          // Decode base64-encoded RTP/PCMU audio
          const base64Audio = parsed.media.payload.data;
          const pcmuBuffer = Buffer.from(base64Audio, "base64");

          console.log("Received PCMU audio buffer.");
          if (deepgramSocket.readyState === WebSocket.OPEN) {
            deepgramSocket.send(pcmuBuffer); // Send to Deepgram
          } else {
            audioChunkQueue.push(pcmuBuffer); // Queue for later
          }
        }
      } else {
        // Binary audio data
        console.log("Received binary audio data.");
        if (deepgramSocket.readyState === WebSocket.OPEN) {
          deepgramSocket.send(message); // Send directly to Deepgram
        } else {
          audioChunkQueue.push(message); // Queue if not ready
        }
      }
    } catch (err) {
      console.error("Error processing message:", err);
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
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ transcript }));
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
  socket.on("close", () => {
    console.log("Client disconnected.");
    if (deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.close();
    }
  });

  // Handle client WebSocket errors
  socket.on("error", (error) => {
    console.error("Client WebSocket error:", error);
  });
});

console.log("WebSocket server running on ws://localhost:3000");
