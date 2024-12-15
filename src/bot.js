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
        console.log('Bot ready to process webhook events');
        
        // Schedule weekly summary checks
        setInterval(() => this.checkWeeklySummaries(), 60 * 60 * 1000); // Check every hour
    }

    async checkWeeklySummaries() {
        const now = new Date();
        // If it's Sunday at 10 AM
        if (now.getDay() === 0 && now.getHours() === 10) {
            const users = await this.userManager.getAllUsers();
            for (const user of users) {
                try {
                    const summary = await this.weeklySummary.generateWeeklySummary(user.id, user);
                    if (summary) {
                        await this.sendMessage(user.id, summary);
                    }
                } catch (error) {
                    console.error(`Error sending weekly summary to ${user.id}:`, error);
                }
            }
        }
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

            const response = await this.whatsappApi.post(
                `/${process.env.PHONE_NUMBER_ID}/messages?access_token=${process.env.WHATSAPP_TOKEN}`,
                messageBody
            );

            console.log('Message sent successfully:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    async handleIncomingMessage(from, messageBody) {
        try {
            // Get or create user
            const user = await this.userManager.getUser(from);
            
            // Get or create session
            const session = await this.conversationManager.getSession(from);
            
            // Create a message object
            const msg = {
                body: messageBody,
                from: from,
                reply: async (text) => await this.sendMessage(from, text)
            };

            // Process the message
            const response = await this.conversationManager.processMessage(msg, session);
            
            if (response) {
                await this.sendMessage(from, response);
                
                // Schedule reminders if needed
                if (session.state === 'pre_workout' || session.state === 'post_workout') {
                    await this.reminderSystem.scheduleReminder(from, session.state);
                }
                
                // Update user data
                await this.userManager.updateUser(from, {
                    lastInteraction: Date.now(),
                    state: session.state,
                    ...session.data
                });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            
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