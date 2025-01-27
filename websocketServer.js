import { WebSocketServer } from "ws";
import WebSocket from "ws";
import dotenv from "dotenv";


dotenv.config();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

// Create WebSocket server
const wsServer = new WebSocketServer({ port: 3000 });

// Audio chunk queue for buffering data until Deepgram WebSocket is ready
const audioChunkQueue = [];


// Resample PCM audio from 8 kHz to 16 kHz

// Create a µ-law to PCM lookup table
const ulawToPcmTable = new Int16Array(256);
(function createULawToPcmTable() {
  for (let i = 0; i < 256; i++) {
    const uByte = ~i & 0xFF;
    let sign = (uByte & 0x80) ? -1 : 1;
    let exponent = (uByte >> 4) & 0x07;
    let mantissa = uByte & 0x0F;
    let magnitude = ((1 << exponent) + (mantissa << (exponent + 3))) - 33;
    ulawToPcmTable[i] = sign * magnitude;
  }
})();

function detectAudioFormat(data) {
  if (data instanceof Buffer || data instanceof Uint8Array) {
    const hex = data.toString("hex", 0, 4); // Read first 4 bytes as hex
    console.log("hex", hex);
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
    try {
      // Detect the format of the incoming message
      const isJson = message.toString().startsWith("{");
  
      if (isJson) {
        // Parse JSON control messages
        const parsed = JSON.parse(message.toString());
  
        if (parsed.event === "media" && parsed.media?.payload) {
          // Decode base64-encoded PCMU audio
          const base64Audio = parsed.media.payload;
          const pcmuBuffer = Buffer.from(base64Audio, "base64");
          console.log("Decoded PCM data:", pcmuBuffer);
  
          // (Optional) Process PCM data or queue it for Deepgram
          if (deepgramSocket.readyState === WebSocket.OPEN) {
            deepgramSocket.send(pcmuBuffer);
          } else {
            audioChunkQueue.push(pcmuBuffer);
          }
        }
      } else {
        // Handle binary audio data directly
        console.log("Received binary audio data.");
        if (deepgramSocket.readyState === WebSocket.OPEN) {
          deepgramSocket.send(message); // Send directly to Deepgram
        } else {
          audioChunkQueue.push(message); // Queue if Deepgram isn't ready
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
      console.log("event.data", event.data);
      console.log("Deepgram Response:", response);
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
