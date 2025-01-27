import { WebSocketServer } from "ws";
import WebSocket from "ws";
import dotenv from "dotenv";
import { spawn } from "child_process";

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


// Decode PCMU to PCM
function decodePCMU(pcmuBuffer) {
  const pcmBuffer = Buffer.alloc(pcmuBuffer.length * 2); // 16-bit PCM output
  for (let i = 0; i < pcmuBuffer.length; i++) {
    const uByte = ~pcmuBuffer[i] & 0xFF;
    const sign = (uByte & 0x80) ? -1 : 1;
    const exponent = (uByte >> 4) & 0x07;
    const mantissa = uByte & 0x0F;
    const magnitude = ((1 << exponent) + (mantissa << (exponent + 3))) - 33;
    pcmBuffer.writeInt16LE(sign * magnitude, i * 2); // Write 16-bit PCM value
  }
  return pcmBuffer;
}

// Resample PCM using SoX
function resamplePCM(inputBuffer, inputRate = 8000, outputRate = 16000) {
  return new Promise((resolve, reject) => {
    const sox = spawn("sox", [
      "-t", "raw", // Input type
      "-r", inputRate.toString(), // Input sample rate
      "-e", "signed", // Input encoding
      "-b", "16", // Input bit depth
      "-c", "1", // Input channels (mono)
      "-", // Input from stdin
      "-t", "raw", // Output type
      "-r", outputRate.toString(), // Output sample rate
      "-e", "signed", // Output encoding
      "-b", "16", // Output bit depth
      "-c", "1", // Output channels (mono)
      "-", // Output to stdout
    ]);

    const chunks = [];
    sox.stdout.on("data", (chunk) => chunks.push(chunk));
    sox.stderr.on("data", (err) => console.error(err.toString()));
    sox.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`SoX process exited with code ${code}`));
      }
    });

    sox.stdin.write(inputBuffer);
    sox.stdin.end();
  });
}

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

  socket.on("message", async (message) => {
    try {
      const isJson = message.toString().startsWith("{");
  
      if (isJson) {
        const parsed = JSON.parse(message.toString());
        if (parsed.event === "media" && parsed.media?.payload) {
          const base64Audio = parsed.media.payload;
          const pcmuBuffer = Buffer.from(base64Audio, "base64");
  
          // Decode PCMU to raw PCM
          const rawPCM = decodePCMU(pcmuBuffer);
  
          // Resample PCM to 16kHz
          const resampledPCM = await resamplePCM(rawPCM, 8000, 16000);
  
          // Save to file for debugging (optional)
          fs.writeFileSync("resampled_audio.pcm", resampledPCM);
  
          console.log("Sending PCM data to Deepgram...");
          if (deepgramSocket.readyState === WebSocket.OPEN) {
            deepgramSocket.send(resampledPCM);
          } else {
            audioChunkQueue.push(resampledPCM);
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
