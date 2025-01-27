import { WebSocketServer } from "ws";
import WebSocket from "ws";
import dotenv from "dotenv";

dotenv.config();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

// Create WebSocket server
const wsServer = new WebSocketServer({ port: 3000 });

// Audio chunk queue for buffering data until Deepgram WebSocket is ready
const audioChunkQueue = [];


function detectAudioFormat(data) {
  if (data instanceof Buffer || data instanceof Uint8Array) {
    const hex = data.toString("hex", 0, 4); // Read first 4 bytes as hex
    if (hex === "52494646") { // "RIFF" in ASCII (WAV header)
      return "WAV";
    } else if (hex.startsWith("494433")) { // "ID3" in ASCII (MP3 metadata)
      return "MP3";
    } else if (hex.startsWith("8000")) { // Example for RTP (customize based on specifics)
      return "RTP";
    } else {
      return "PCM (raw audio)";
    }
  }
  return "Unknown (Not a Buffer)";
}


wsServer.on("connection", (socket) => {
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

    // Send queued audio chunks to Deepgram
    while (audioChunkQueue.length > 0) {
      const chunk = audioChunkQueue.shift(); // Dequeue the first chunk
      console.log("Sending queued audio chunk:", detectAudioFormat(chunk));

      deepgramSocket.send(chunk);
    }
  };

  // Handle incoming audio from the client
  socket.on("message", (message) => {
    // console.log("Received audio chunk from client:", message.length);
    const audioFormat = detectAudioFormat(message);

    console.log("Received audio chunk from client:", {
      type: audioFormat,
      length: message?.length,
    });
    if (deepgramSocket.readyState === WebSocket.OPEN) {
      // If Deepgram WebSocket is ready, send the audio chunk directly
      deepgramSocket.send(message);
    } else {
      // Queue the audio chunk if Deepgram WebSocket is not ready
      console.warn("Deepgram WebSocket is not ready. Queuing audio chunk.", message);
      audioChunkQueue.push(message);
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
