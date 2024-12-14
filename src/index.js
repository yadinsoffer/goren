require('dotenv').config();
const express = require('express');
const FitnessBot = require('./bot');
const app = express();

// Parse JSON bodies
app.use(express.json());

const bot = new FitnessBot();

// Webhook verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
            console.log('Webhook verified');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// Handle incoming messages
app.post('/webhook', async (req, res) => {
    try {
        console.log('Received webhook:', JSON.stringify(req.body, null, 2));

        if (req.body.object === 'whatsapp_business_account') {
            if (req.body.entry && 
                req.body.entry[0].changes && 
                req.body.entry[0].changes[0] && 
                req.body.entry[0].changes[0].value.messages && 
                req.body.entry[0].changes[0].value.messages[0]
            ) {
                const message = req.body.entry[0].changes[0].value.messages[0];
                const metadata = req.body.entry[0].changes[0].value.metadata;
                
                // Validate that this message is for our phone number
                if (metadata && metadata.phone_number_id !== process.env.PHONE_NUMBER_ID) {
                    console.log('Message not for our phone number:', metadata.phone_number_id);
                    return res.sendStatus(200);
                }

                const from = message.from;
                console.log('Processing message from:', from);
                
                // Handle different types of messages
                let msgBody;
                if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
                    // Handle button response
                    msgBody = message.interactive.button_reply.title;
                    console.log('Received button response:', msgBody);
                } else if (message.text && message.text.body) {
                    // Handle regular text message
                    msgBody = message.text.body;
                    console.log('Received text message:', msgBody);
                } else {
                    console.log('Unsupported message type:', message);
                    return res.sendStatus(200);
                }

                // Handle the message
                await bot.handleIncomingMessage(from, msgBody);
                res.sendStatus(200);
            } else {
                console.log('Invalid webhook structure:', req.body);
                res.sendStatus(404);
            }
        } else {
            console.log('Invalid webhook object:', req.body.object);
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('Error processing message:', error);
        res.sendStatus(500);
    }
});

const port = process.env.PORT || 3000;
app.listen(port, async () => {
    console.log(`Server is running on port ${port}`);
    try {
        await bot.initialize();
        console.log('Bot initialized successfully');
    } catch (error) {
        console.error('Failed to initialize bot:', error);
        process.exit(1);
    }
});
