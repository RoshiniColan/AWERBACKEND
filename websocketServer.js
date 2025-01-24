import { WebSocketServer } from "ws";
import WebSocket from "ws"; // Import for Deepgram WebSocket connection
import dotenv from "dotenv";

dotenv.config();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

// Create a WebSocket server
const wsServer = new WebSocketServer({ port: 3000 });

wsServer.on("connection", (clientSocket) => {
  console.log("Client connected.");

  // Establish a connection to Deepgram WebSocket API
  const deepgramSocket = new WebSocket(
    `wss://api.deepgram.com/v1/listen?access_token=${DEEPGRAM_API_KEY}`
  );

  // Forward audio data from the client to Deepgram
  clientSocket.on("message", (message) => {
    console.log("Audio data received from client.");
    if (deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.send(message);
    }
  });

  // Handle transcription messages from Deepgram
  deepgramSocket.on("message", (deepgramMessage) => {
    const response = JSON.parse(deepgramMessage);
    const transcript = response.channel?.alternatives?.[0]?.transcript || "";
    if (transcript) {
      console.log("Transcription:", transcript);

      // Optional: Send the transcription back to the client
      clientSocket.send(JSON.stringify({ transcript }));
    }
  });

  deepgramSocket.on("open", () => {
    console.log("Connected to Deepgram WebSocket API.");
  });

  deepgramSocket.on("close", () => {
    console.log("Deepgram WebSocket connection closed.");
  });

  deepgramSocket.on("error", (error) => {
    console.error("Deepgram WebSocket error:", error);
  });

  clientSocket.on("close", () => {
    console.log("Client disconnected.");
    // Close the Deepgram WebSocket when the client disconnects
    if (deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.close();
    }
  });

  clientSocket.on("error", (error) => {
    console.error("Client WebSocket error:", error);
  });
});

console.log("WebSocket server running on ws://localhost:3000");
