import { WebSocketServer } from 'ws';

const wsServer = new WebSocketServer({ port: 3000 });

wsServer.on('connection', (socket) => {
  console.log('Client connected.');

  socket.on('message', (message) => {
    console.log('Message received:', message);
  });

  socket.on('close', () => {
    console.log('Client disconnected.');
  });
});

console.log('WebSocket server running on ws://localhost:3000');
