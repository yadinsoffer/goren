require('dotenv').config();
const axios = require('axios');
const Database = require('./database');
const ConversationManager = require('./conversationManager');
const UserManager = require('./userManager');
const ReminderSystem = require('./reminderSystem');
const WeeklySummary = require('./weeklySummary');

class FitnessBot {
    constructor() {
        this.db = new Database();
        this.conversationManager = new ConversationManager();
        this.userManager = new UserManager();
        this.reminderSystem = new ReminderSystem();
        this.weeklySummary = new WeeklySummary();
        
        // Configure axios for WhatsApp API calls
        this.whatsappApi = axios.create({
            baseURL: 'https://graph.facebook.com/v17.0',
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async initialize() {
        // No need for client initialization with webhook setup
        console.log('Bot ready to process webhook events');
    }

    async sendMessage(to, content) {
        try {
            let messageBody;

            // Check if the message contains button options (indicated by [...] [...])
            const buttonMatch = content.match(/\[(.*?)\]/g);
            if (buttonMatch) {
                // Extract the message text (everything before the first [...])
                const messageText = content.split('[')[0].trim();
                
                // Extract button titles
                const buttons = buttonMatch.map(btn => {
                    const buttonText = btn.replace(/[\[\]]/g, '').trim();
                    return {
                        type: 'reply',
                        reply: {
                            id: buttonText.toLowerCase().replace(/\s+/g, '_'),
                            title: buttonText
                        }
                    };
                });

                messageBody = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'interactive',
                    interactive: {
                        type: 'button',
                        body: {
                            text: messageText
                        },
                        action: {
                            buttons: buttons.slice(0, 3) // WhatsApp allows max 3 buttons
                        }
                    }
                };
            } else {
                // Regular text message
                messageBody = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'text',
                    text: { body: content }
                };
            }

            console.log('Sending message:', JSON.stringify(messageBody, null, 2));

            const response = await this.whatsappApi.post(
                `/${process.env.PHONE_NUMBER_ID}/messages?access_token=${process.env.WHATSAPP_TOKEN}`,
                messageBody
            );

            console.log('Message sent successfully:', response.data);
        } catch (error) {
            console.error('Error sending message:', error.response?.data || error);
            throw error;
        }
    }

    async handleIncomingMessage(from, messageBody) {
        try {
            // Get or create user session
            const session = await this.conversationManager.getSession(from);
            
            // Create a message object that matches what the conversation manager expects
            const msg = {
                body: messageBody,
                from: from,
                reply: async (text) => await this.sendMessage(from, text)
            };

            // Process the message
            const response = await this.conversationManager.processMessage(msg, session);
            if (response) {
                await this.sendMessage(from, response);
            }
        } catch (error) {
            console.error('Error handling message:', error);
            
            // Get OpenAI's help to handle the error gracefully
            try {
                const session = await this.conversationManager.getSession(from);
                const fallbackResponse = await this.conversationManager.handleFallback(
                    { body: messageBody, error: error.message || 'Unknown error' },
                    session
                );
                await this.sendMessage(from, fallbackResponse);
            } catch (fallbackError) {
                console.error('Fallback error:', fallbackError);
                await this.sendMessage(from, 'מצטער, משהו השתבש. אנא נסה שוב מאוחר יותר.');
            }
        }
    }
}

module.exports = FitnessBot; 