// client.js
import WebSocket from 'ws';

const socket = new WebSocket('ws://localhost:3000');

socket.on('open', () => {
  console.log('Connected to server');
  socket.send('Hello WebSocket!');
});

socket.on('message', (data) => {
  console.log('Server says:', data.toString());
});

socket.on('error', (error) => {
  console.error('WebSocket Error:', error);
});

socket.on('close', () => {
  console.log('Connection closed');
});