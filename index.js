// index.js
import express from 'express';
import twilio from 'twilio';
import { handleIncomingMessage } from './agent.js';
import axios from 'axios'; // We will use axios directly
import 'dotenv/config';

const app = express();
app.use(express.urlencoded({ extended: false }));

// Helper function to wait for a few seconds
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

   app.post('/whatsapp', async (req, res) => {
    let incomingMsg;
    const from = req.body.From;

    // --- VOICE MESSAGE HANDLING with Correct Authentication ---
    if (req.body.MediaUrl0) {
        try {
            console.log("Voice message detected. Transcribing with AssemblyAI...");
            
            const mediaUrl = req.body.MediaUrl0;
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;

            // --- THIS IS THE FIX ---
            // We are creating a new URL that has the username (SID) and password (Token) embedded in it.
            // This is a standard way to access protected files.
            const authenticatedMediaUrl = `https://${accountSid}:${authToken}@${mediaUrl.substring(8)}`;

            // 1. Tell AssemblyAI where the audio file is, using the new authenticated URL
            const assemblyaiResponse = await axios.post('https://api.assemblyai.com/v2/transcript', {
                audio_url: authenticatedMediaUrl,
            }, {
                headers: {
                    authorization: process.env.ASSEMBLYAI_API_KEY,
                    'Content-Type': 'application/json',
                }
            });

            const transcriptId = assemblyaiResponse.data.id;
            const pollingEndpoint = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;

            // 2. Keep checking the status until it's "completed" or "error"
            while (true) {
                const pollingResponse = await axios.get(pollingEndpoint, {
                    headers: { authorization: process.env.ASSEMBLYAI_API_KEY }
                });
                const transcriptionResult = pollingResponse.data;

                if (transcriptionResult.status === "completed") {
                    incomingMsg = transcriptionResult.text;
                    console.log(`Transcription result: "${incomingMsg}"`);
                    break;
                } else if (transcriptionResult.status === "error") {
                    throw new Error(`Transcription failed: ${transcriptionResult.error}`);
                } else {
                    await sleep(3000); // Wait for 3 seconds
                }
            }

        } catch (error) {
            console.error("Error handling voice message:", error.response ? error.response.data : error.message);
            incomingMsg = "";
        }
    } else {
        // This is a regular text message
        incomingMsg = req.body.Body;
    }
    // ----------------------------

    console.log(`Incoming message for agent: ${incomingMsg}`);
    
    const replyMsg = await handleIncomingMessage(incomingMsg, from);
    console.log(`AI Reply: ${replyMsg}`);

    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(replyMsg);

    res.writeHead(200, {'Content-Type': 'text/xml'});
    res.end(twiml.toString());
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}. Ready to receive messages.`);
});