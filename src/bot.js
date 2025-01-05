require('dotenv').config();
const axios = require('axios');
const ConversationManager = require('./conversationManager');
const UserManager = require('./userManager');
const MessageScheduler = require('./messageScheduler');

class FitnessBot {
    constructor() {
        this.conversationManager = new ConversationManager();
        this.userManager = new UserManager();
        this.messageScheduler = new MessageScheduler(this);
        
        // Configure axios for WhatsApp API calls
        this.whatsappApi = axios.create({
            baseURL: 'https://graph.facebook.com/v17.0',
            headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}` }
        });
    }

    async initialize() {
        console.log('Bot ready to process webhook events');
        this.messageScheduler.start();
    }

    async sendMessage(to, content) {
        try {
            let messageBody;
            console.log('Preparing to send message:', { to, content }); // Debug log

            if (typeof content === 'object' && content.text) {
                if (content.buttons && content.buttons.length > 0) {
                    console.log('Preparing interactive button message'); // Debug log
                    messageBody = {
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: to,
                        type: 'interactive',
                        interactive: {
                            type: 'button',
                            body: {
                                text: content.text
                            },
                            action: {
                                buttons: content.buttons.map((button, index) => ({
                                    type: 'reply',
                                    reply: {
                                        id: `btn_${index}`,
                                        title: button.substring(0, 20) // WhatsApp button title limit
                                    }
                                })).slice(0, 3) // WhatsApp button count limit
                            }
                        }
                    };
                } else {
                    console.log('Preparing regular text message'); // Debug log
                    messageBody = {
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: to,
                        type: 'text',
                        text: { body: content.text }
                    };
                }
            } else {
                console.log('Preparing legacy text message'); // Debug log
                messageBody = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'text',
                    text: { body: String(content) }
                };
            }

            console.log('Sending message body:', JSON.stringify(messageBody, null, 2)); // Debug log

            const response = await this.whatsappApi.post(
                `/${process.env.PHONE_NUMBER_ID}/messages`,
                messageBody
            );

            console.log('Message sent successfully:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers
            });
            throw error;
        }
    }

    async handleIncomingMessage(from, messageBody) {
        try {
            console.log('Raw incoming message:', messageBody);
            
            // Extract the message text
            let messageText;
            if (typeof messageBody === 'object' && messageBody.type === 'interactive') {
                messageText = messageBody.interactive.button_reply?.title || '';
            } else {
                messageText = typeof messageBody === 'string' ? messageBody : messageBody.body;
            }

            console.log('Processing message:', messageText);
            
            // Handle the message using the conversation manager
            const response = await this.conversationManager.processMessage({
                from: from,
                body: messageText,
                type: messageBody.type || 'text'
            });
            
            if (response) {
                // Check if the response is already a formatted WhatsApp message
                if (typeof response === 'object' && response.messaging_product === 'whatsapp') {
                    await this.whatsappApi.post(
                        `/${process.env.PHONE_NUMBER_ID}/messages`,
                        response
                    );
                } else {
                    // Handle simple text responses
                    await this.sendMessage(from, response);
                }
            }
        } catch (error) {
            console.error('Error handling message:', error);
            console.error('Error message:', error.message);
            
            try {
                await this.sendMessage(from, {
                    text: 'מצטער, משהו השתבש. נסה לכתוב "קפלן מניאק" כדי להתחיל מחדש.'
                });
            } catch (fallbackError) {
                console.error('Fallback error details:', fallbackError);
            }
        }
    }
}

module.exports = FitnessBot; 