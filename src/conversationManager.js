const Flow0Manager = require('./Flow0Manager');
const Flow1Manager = require('./Flow1Manager');
const Flow2Manager = require('./Flow2Manager');

class ConversationManager {
    constructor() {
        this.flow0Manager = new Flow0Manager();
        this.flow1Manager = new Flow1Manager();
        this.flow2Manager = new Flow2Manager();
        this.sessions = new Map();
    }

    async getSession(userId) {
        if (!this.sessions.has(userId)) {
            this.sessions.set(userId, {
                currentFlow: 'flow0',
                flow0Session: await this.flow0Manager.getSession(userId),
                flow1Session: await this.flow1Manager.getSession(userId),
                flow2Session: await this.flow2Manager.getSession(userId)
            });
        }
        return this.sessions.get(userId);
    }

    async processMessage(msg) {
        try {
            const session = await this.getSession(msg.from);
            
            if (session.currentFlow === 'flow0') {
                const response = await this.flow0Manager.processMessage(msg, session.flow0Session);
                
                if (response.shouldStartFlow1) {
                    session.currentFlow = 'flow1';
                    session.flow1Session.state = 'ask_goal';
                    return {
                        text: 'שאלה 1: מה המטרה העיקרית שלך באימונים?',
                        buttons: [
                            'שיפור האירובי/כושר גופני כללי',
                            'שיפור הבריאות (הרזיה או מסה)',
                            'התקדמות במשקלים ובתרגילי הכוח'
                        ]
                    };
                }
                
                return response;
            } else if (session.currentFlow === 'flow1') {
                const response = await this.flow1Manager.processMessage(msg, session.flow1Session);
                
                if (response.shouldStartFlow2) {
                    session.currentFlow = 'flow2';
                    return {
                        text: response.text,
                        buttons: ['המשך']
                    };
                }
                
                if (response.shouldScheduleReminder) {
                    const scheduledTime = Date.now() + (24 * 60 * 60 * 1000);
                    this.flow2Manager.delayedMessages.set(scheduledTime, {
                        userId: msg.from,
                        message: {
                            text: 'שאלה 1: מה המטרה העיקרית שלך באימונים?',
                            buttons: [
                                'שיפור האירובי/כושר גופני כללי',
                                'שיפור הבריאות (הרזיה או מסה)',
                                'התקדמות במשקלים ובתרגילי הכוח'
                            ]
                        }
                    });
                }
                
                return response;
            } else {
                return await this.flow2Manager.processMessage(msg, session.flow2Session);
            }
        } catch (error) {
            console.error('Error in ConversationManager processMessage:', error);
            throw error;
        }
    }

    isUserVerified(chatId) {
        return this.flow0Manager.isUserVerified(chatId);
    }

    getVerifiedUserData(chatId) {
        return this.flow0Manager.getVerifiedUserData(chatId);
    }
}

module.exports = ConversationManager; 