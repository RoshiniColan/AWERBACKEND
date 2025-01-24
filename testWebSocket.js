import WebSocket from 'ws';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const callControlId = 'your_call_control_id'; // Replace with your actual call control ID
const streamUrl = "wss://71c6-2405-201-e02d-906d-38bf-933e-9570-c79.ngrok-free.app";

const ws = new WebSocket(streamUrl);

ws.on('open', async () => {
  console.log('WebSocket connection opened');

  // Start the call streaming
  const streamingResponse = await axios.post(
    `https://api.telnyx.com/v2/calls/${callControlId}/actions/streaming_start`,
    {
      stream_url: streamUrl,
      stream_track: "both_tracks",
      client_state: "aGF2ZSBhIG5pZSBkYXkgPT0=",
      command_id: uuidv4(),
      enable_dialogflow: false,
      dialogflow_config: {
        analyze_sentiment: false,
        partial_automated_agent_reply: false
      }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.TELNYX_PRIVATE_KEY}`,
        "Content-Type": "application/json",
        'Accept': 'application/json'
      },
    }
  );

  console.log(`Streaming started for call ${callControlId}:`, streamingResponse.data);
});

ws.on('message', (data) => {
  console.log('Received message:', data);
  // Add your logic to verify the received messages
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('WebSocket connection closed');
});