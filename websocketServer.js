import { WebSocketServer } from 'ws';
import WebSocket from 'ws';

import dotenv from "dotenv";

dotenv.config();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

const wsServer = new WebSocketServer({ port: 3000 });

wsServer.on('connection', (socket) => {
  console.log('Client connected.');

  // Create Deepgram WebSocket connection
  const deepgramSocket = new WebSocket('wss://api.deepgram.com/v1/listen', {
    headers: {
      Authorization: `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'audio/webm'
    }
  });

  // Handle Deepgram socket opening
  deepgramSocket.onopen = () => {
    console.log('Connected to Deepgram');

    // Forward messages from local WebSocket to Deepgram
    socket.on('message', (message) => {
      console.log('Received audio chunk:', message.length);
      if (deepgramSocket.readyState === WebSocket.OPEN) {
        deepgramSocket.send(message);
      }
    });
  };

  // Handle Deepgram transcriptions
  deepgramSocket.onmessage = (event) => {
    try {
      const received = JSON.parse(event.data);
      const transcript = received.channel.alternatives[0]?.transcript;
      
      if (transcript) {
        console.log('Transcription:', transcript);
        
        // Optionally, send transcription back to original client
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ transcript }));
        }
      }
    } catch (error) {
      console.error('Error parsing Deepgram message:', error);
    }
  };

  // Error handling
  deepgramSocket.onerror = (error) => {
    console.error('Deepgram WebSocket error:', error);
  };

  // Handle client disconnection
  socket.on('close', () => {
    console.log('Client disconnected');
    deepgramSocket.close();
  });
});

console.log('WebSocket server running on ws://localhost:3000');