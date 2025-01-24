// // import express from "express";
// // import bodyParser from "body-parser";
// // import nunjucks from "nunjucks";
// // import Telnyx from "telnyx";
// // import dotenv from "dotenv";
// // import axios from "axios";

// // // Load environment variables from .env file
// // dotenv.config();

// // // Set up Telnyx with user API Key
// // const telnyx = new Telnyx(process.env.TELNYX_API_KEY);

// // // Initialize Express App
// // const app = express();
// // app.use(express.json());
// // app.use(
// //   bodyParser.urlencoded({
// //     extended: true,
// //   })
// // );

// // // Set default Express engine and extension
// // app.engine("html", nunjucks.render);
// // app.set("view engine", "html");

// // // Configure Nunjucks engine
// // nunjucks.configure("templates/views", {
// //   autoescape: true,
// //   express: app,
// // });

// // // Simple page that can send a phone call
// // app.get("/", function (request, response) {
// //   response.render("messageform");
// // });

// // // Handle incoming webhook events
// // app.post("/webhook", (req, res) => {
// //     console.log("Received Webhook:", req.body);
// //     res.sendStatus(200);
// //   });

// // // API to fetch connection ID
// // app.get("/get-connection-id", async (req, res) => {
// //     try {
// //       // Fetch connection list from Telnyx API
// //       const response = await axios.get("https://api.telnyx.com/v2/connections", {
// //         headers: {
// //           Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
// //         },
// //       });
  
// //       const connections = response.data.data;
  
// //       if (!connections || connections.length === 0) {
// //         return res.status(404).json({ message: "No connections found." });
// //       }
  
// //       // Sending all connections as response (modify as needed)
// //       return res.json({ connections });
// //     } catch (error) {
// //       console.error("Error fetching connection ID:", error);
// //       return res.status(500).json({ message: "Failed to fetch connection ID", error: error.message });
// //     }
// //   });
  
// //   const fetchConnectionId = async () => {
// //     try {
// //       const response = await axios.get("http://localhost:3000/get-connection-id");
// //       const connections = response.data.connections;
  
// //       if (!connections || connections.length === 0) {
// //         throw new Error("No connections found.");
// //       }
  
// //       // Selecting the first available connection
// //       const connectionId = connections[0].id;
// //       console.log(`Fetched Connection ID: ${connectionId}`);
// //       return connectionId;
// //     } catch (error) {
// //       console.error("Error fetching connection ID:", error);
// //       return null;
// //     }
// //   };

// //   // Create a Call Control Connection
// // app.post("/create-connection", async (req, res) => {
// //     try {
// //       const response = await axios.post(
// //         "https://api.telnyx.com/v2/connections",
// //         {
// //           connection_name: "My Call Control App",
// //           record_type: "call_control_connection",
// //           active: true,
// //           webhook_event_url: "https://9660-2405-201-e02d-906d-3ced-7a85-90a4-5c4e.ngrok-free.app/webhook",
// //           webhook_event_failover_url: "https://9660-2405-201-e02d-906d-3ced-7a85-90a4-5c4e.ngrok-free.app/webhook",
// //           webhook_api_version: "2"
// //         },
// //         {
// //           headers: {
// //             Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
// //             "Content-Type": "application/json"
// //           }
// //         }
// //       );
  
// //       res.json({ message: "Call Control Connection Created", connection: response.data });
// //     } catch (error) {
// //       console.error("Error creating Call Control Connection:", error.response?.data || error.message);
// //       res.status(500).json({ message: "Failed to create Call Control Connection", error: error.response?.data || error.message });
// //     }
// //   });

// // // app.post("/outbound", async (request, response) => {
// // //   const to_number = request.body.to_number;

// // //   try {
// // //     const connection_id = await fetchConnectionId(); // Fetch connection ID

// // //     if (!connection_id) {
// // //       return response.status(500).json({ message: "Failed to retrieve connection ID." });
// // //     }
// // //     console.log("connection id",connection_id);
// // //     const { data: call } = await telnyx.calls.create({
// // //         connection_id: connection_id, // Use the fetched connection ID
// // //         to: to_number,
// // //       from: "+17753719322",
// // //       timeout_secs: 0,
// // //       time_limit_secs: 0,
// // //       answering_machine_detection: "premium",
// // //       media_encryption: "disabled",
// // //       sip_transport_protocol: "UDP",
// // //       stream_track: "inbound_track",
// // //       send_silence_when_idle: false,
// // //       webhook_url_method: "POST",
// // //       record_channels: "single",
// // //       record_format: "wav",
// // //       record_max_length: 0,
// // //       record_timeout_secs: 0,
// // //       enable_dialogflow: false,
// // //       transcription: false,
// // //     });

// // //     response.render("messagesuccess");
// // //     console.log(call?.call_control_id);
// // //   } catch (e) {
// // //     response.send(e);
// // //   }
// // // });

// // // Handle Call Control Webhooks

// // const TELNYX_PRIVATE_KEY = process.env.TELNYX_PRIVATE_KEY;
// // const TELNYX_PHONE_NUMBER = process.env.TELNYX_PHONE_NUMBER;
// // const OUTBOUND_VOICE_PROFILE_ID = process.env.OUTBOUND_VOICE_PROFILE_ID; // From API response

// // // ---------------------------
// // // 1️⃣ Make an Outbound Call Using OVP ID
// // // ---------------------------
// // app.post("/outbound-call", async (req, res) => {
// //   const { to_number } = req.body;

// //   if (!to_number) {
// //     return res.status(400).json({ message: "Missing 'to_number' in request body." });
// //   }

// //   try {
// //     // Make outbound call request using `outbound_voice_profile_id`
// //     const response = await axios.post(
// //       "https://api.telnyx.com/v2/calls",
// //       {
// //         from: TELNYX_PHONE_NUMBER,
// //         to: to_number,
// //         outbound_voice_profile_id: OUTBOUND_VOICE_PROFILE_ID, // Using OVP ID instead of connection_id
// //       },
// //       {
// //         headers: {
// //           Authorization: `Bearer ${TELNYX_PRIVATE_KEY}`,
// //           "Content-Type": "application/json",
// //         },
// //       }
// //     );

// //     console.log("Call Response:", response.data);
// //     res.json({
// //       message: "Call initiated successfully",
// //       call_id: response.data.data.id,
// //     });

// //   } catch (error) {
// //     console.error("Error making outbound call:", error.response?.data || error.message);
// //     res.status(500).json({
// //       message: "Error making outbound call",
// //       error: error.response?.data || error.message,
// //     });
// //   }
// // });

// // app.post("/call_control", async (request, response) => {
// //   response.sendStatus(200);

// //   const data = request.body.data || {};
// //   try {
// //     const callControlId = data.payload?.call_control_id;

// //     if (data.event_type === "call.hangup") {
// //       console.log("Call has ended.");
// //     } else if (data.event_type === "call.initiated") {
// //       telnyx.calls.answer(callControlId, {
// //         stream_track: "inbound_track",
// //         send_silence_when_idle: false,
// //         webhook_url_method: "POST",
// //         transcription: false,
// //       });
// //     } else if (data.event_type === "call.answered") {
// //       telnyx.calls.speak(callControlId, {
// //         payload:
// //           "Hello, Telnyx user! Welcome to this call control demonstration.",
// //         voice: "male",
// //         language: "en-US",
// //         payload_type: "text",
// //         service_level: "premium",
// //       });
// //     } else if (data.event_type === "call.speak.ended") {
// //       console.log("Speak has ended.");
// //       telnyx.calls.hangup(callControlId, {});
// //     }
// //   } catch (error) {
// //     console.error("Error issuing call command");
// //     console.error(error);
// //   }
// // });

// // // Fire up the app on the specified port
// // const PORT = process.env.TELNYX_APP_PORT || 3000;
// // app.listen(PORT, () => {
// //   console.log(`Server listening on port ${PORT}`);
// // });


// // import express from "express";
// // import axios from "axios";
// // import dotenv from "dotenv";

// // dotenv.config();

// // const app = express();
// // app.use(express.json());

// // const TELNYX_API_KEY = process.env.TELNYX_PRIVATE_KEY;
// // const OUTBOUND_VOICE_PROFILE_ID = process.env.OUTBOUND_VOICE_PROFILE_ID;
// // const WEBHOOK_URL = process.env.WEBHOOK_URL; // Your ngrok or live server URL

// // // ---------------------------
// // // 1️⃣ Create Call Control Application
// // // ---------------------------
app.post("/create-call-control-app", async (req, res) => {
    try {
      const response = await axios.post(
        "https://api.telnyx.com/v2/call_control_applications",
        {
          application_name: "call-router",
          webhook_event_url: WEBHOOK_URL,
          active: true,
          anchorsite_override: "Latency",
          dtmf_type: "Inband",
          first_command_timeout: true,
          first_command_timeout_secs: 10,
          inbound: {
            channel_limit: 10,
            shaken_stir_enabled: true,
            sip_subdomain: "your-sip-subdomain",
            sip_subdomain_receive_settings: "only_my_connections",
          },
          outbound: {
            channel_limit: 10,
            outbound_voice_profile_id: OUTBOUND_VOICE_PROFILE_ID,
          },
          webhook_api_version: "2",
          webhook_event_failover_url: "https://failover.yourserver.com/webhook",
          webhook_timeout_secs: 25,
        },
        {
          headers: {
            Authorization: `Bearer ${TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
  
      res.json({ message: "Call Control App Created", application: response.data });
    } catch (error) {
      console.error("Error creating Call Control Application:", error.response?.data || error.message);
      res.status(500).json({
        message: "Failed to create Call Control Application",
        error: error.response?.data || error.message,
      });
    }
  });
  
  // // // ---------------------------
  // // // 2️⃣ Start the Server
  // // // ---------------------------
  // // const PORT = process.env.PORT || 3000;
  // // app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  
  
  // import express from "express";
  // import axios from "axios";
  // import dotenv from "dotenv";
  // import bodyParser from "body-parser";
  // import cors from "cors";
  // import Telnyx from "telnyx";
  
  // dotenv.config();
  
  // const app = express();
  // app.use(express.json());
  // app.use(bodyParser.urlencoded({ extended: true }));
  // app.use(cors());
  
  // const telnyx = new Telnyx(process.env.TELNYX_PRIVATE_KEY);
  // const TELNYX_PHONE_NUMBER = process.env.TELNYX_PHONE_NUMBER;
  // const CALL_CONTROL_APP_ID = process.env.CALL_CONTROL_APP_ID;
  // const OUTBOUND_VOICE_PROFILE_ID = process.env.OUTBOUND_VOICE_PROFILE_ID;
  
  
  
  // app.post("/make-call", async (req, res) => {
  //   const { to_number } = req.body;
  
  //   if (!to_number) {
  //     return res.status(400).json({ message: "Missing 'to_number' in request body." });
  //   }
  
  //   try {
  //     // Initiate a call using the Call Control Application
  //     const response = await axios.post(
  //       "https://api.telnyx.com/v2/calls",
  //       {
  //         connection_id: CALL_CONTROL_APP_ID, // Call Control Application ID
  //         from: TELNYX_PHONE_NUMBER,
  //         to: to_number,
  //         outbound_voice_profile_id: OUTBOUND_VOICE_PROFILE_ID, // Required for outbound calls
  //       },
  //       {
  //         headers: {
  //           Authorization: `Bearer ${process.env.TELNYX_PRIVATE_KEY}`,
  //           "Content-Type": "application/json",
  //         },
  //       }
  //     );
  
  //     console.log("Call Response:", response.data);
  //     res.json({
  //       message: "Call initiated successfully",
  //       call_control_id: response.data.data.call_control_id,
  //     });
  
  //   } catch (error) {
  //     console.error("Error making outbound call:", error.response?.data || error.message);
  //     res.status(500).json({
  //       message: "Error making outbound call",
  //       error: error.response?.data || error.message,
  //     });
  //   }
  // });
  
  // // Handle incoming webhook events
  // app.get("/webhook", async (req, res) => {
  //   console.log("Received Webhook Event:", JSON.stringify(req.body, null, 2));
  //   res.sendStatus(200);
  
  //   // const eventType = req.body.data.event_type;
  //   // const callControlId = req.body.data.payload.call_control_id;
  
  //   // try {
  //   //   if (eventType === "call.answered") {
  //   //     console.log("Call answered! Playing audio...");
  //   //     await telnyx.calls.speak(callControlId, {
  //   //       payload: "Hello! This is an automated test call using Telnyx Call Control.",
  //   //       voice: "female",
  //   //       language: "en-US",
  //   //       payload_type: "text",
  //   //       service_level: "premium"
  //   //     });
  //   //   } else if (eventType === "call.speak.ended") {
  //   //     console.log("Speech ended. Hanging up...");
  //   //     await telnyx.calls.hangup(callControlId);
  //   //   }
  //   // } catch (error) {
  //   //   console.error("Error processing webhook event:", error.message);
  //   // }
  // });
  
  
  // // Handle webhook events
  // // app.post("/webhook", async (req, res) => {
  // //   const event = req.body.data.event_type;
  // //   const callControlId = req.body.data.payload?.call_control_id;
  
  // //   console.log("call control id", callControlId);
  // //   console.log("Received Webhook Event:", event);
  
  // //   try {
  // //     if (event === "call.answered") {
  // //       console.log(`Call ${callControlId} answered. Starting 10-minute timer.`);
  
  // //       // Set a timeout to hang up the call after 10 minutes (600,000 milliseconds)
  // //       setTimeout(async () => {
  // //         console.log(`Ending call ${callControlId} after 10 minutes.`);
  // //         await telnyx.calls.hangup(callControlId);
  // //       }, 600000);
  // //     } else if (event === "call.hangup") {
  // //       console.log(`Call ${callControlId} ended.`);
  // //     }
  
  // //     res.sendStatus(200);
  // //   } catch (error) {
  // //     console.error("Error handling webhook event:", error.message);
  // //     res.sendStatus(500);
  // //   }
  // // });
  
  
  // // Fire up the app on the specified port
  // const PORT = process.env.PORT || 3000;
  // app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  
  
  