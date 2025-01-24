import { WebSocketServer } from "ws";
import WebSocket from "ws";
import dotenv from "dotenv";

dotenv.config();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

// Create WebSocket server
const wsServer = new WebSocketServer({ port: 3000 });

// Audio chunk queue for buffering data until Deepgram WebSocket is ready
const audioChunkQueue = [];

wsServer.on("connection", (socket) => {
  console.log("Client connected.");

  // Create Deepgram WebSocket connection
  const deepgramSocket = new WebSocket(
    `wss://api.deepgram.com/v1/listen?punctuate=true&interim_results=true&language=en-US`,
    {
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": "audio/pcm"
      },
    }
  );

  // Handle Deepgram WebSocket opening
  deepgramSocket.onopen = () => {
    console.log("Connected to Deepgram WebSocket.");

    // Send queued audio chunks to Deepgram
    while (audioChunkQueue.length > 0) {
      const chunk = audioChunkQueue.shift(); // Dequeue the first chunk
      deepgramSocket.send(chunk);
    }
  };

  // Handle incoming audio from the client
  socket.on("message", (message) => {
    // console.log("Received audio chunk from client:", message.length);

    if (deepgramSocket.readyState === WebSocket.OPEN) {
      // If Deepgram WebSocket is ready, send the audio chunk directly
      deepgramSocket.send(message);
    } else {
      // Queue the audio chunk if Deepgram WebSocket is not ready
      console.warn("Deepgram WebSocket is not ready. Queuing audio chunk.");
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
