const OpenAI = require('openai');

class ConversationManager {
    constructor() {
        this.conversations = new Map();
        this.conversationStates = {
            INITIAL: 'initial',
            OPENING_QUESTIONS: 'opening_questions',
            PRE_WORKOUT: 'pre_workout',
            POST_WORKOUT: 'post_workout',
            WEEKLY_SUMMARY: 'weekly_summary'
        };
        this.COACH_PHONE = '+972525209070';
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        this.systemPrompt = `You are a helpful fitness assistant bot that speaks Hebrew. 
            You help users with their workout routines and fitness goals.
            Keep responses concise and friendly. If you're not sure about something medical or 
            injury-related, suggest contacting the coach at ${this.COACH_PHONE}.
            Always respond in Hebrew.`;

        // Set up reminder intervals
        setInterval(() => this.checkInactiveConversations(), 60000); // Check every minute
    }

    async checkInactiveConversations() {
        const now = Date.now();
        for (const [userId, session] of this.conversations) {
            const timeSinceLastInteraction = now - session.lastInteraction;
            
            // If more than 2 minutes have passed and we're waiting for a response
            if (timeSinceLastInteraction > 2 * 60 * 1000 && !session.reminded) {
                try {
                    // Send a reminder based on the current state
                    let reminderMsg;
                    switch (session.state) {
                        case this.conversationStates.INITIAL:
                            reminderMsg = 'היי, אשמח לדעת מה המטרה העיקרית שלך באימונים?';
                            break;
                        case this.conversationStates.OPENING_QUESTIONS:
                            reminderMsg = 'היי, אתה עדיין איתי? אשמח להמשיך לעזור לך.';
                            break;
                        case this.conversationStates.PRE_WORKOUT:
                            reminderMsg = 'היי, רציתי לוודא שהכל בסדר. אתה צריך עזרה?';
                            break;
                        case this.conversationStates.POST_WORKOUT:
                            reminderMsg = 'היי, אשמח לשמוע איך היה האימון כשתהיה פנוי.';
                            break;
                        default:
                            reminderMsg = 'היי, אתה עדיין שם? אשמח להמשיך לעזור.';
                    }
                    
                    // Mark that we've sent a reminder
                    session.reminded = true;
                    
                    // Send the reminder message
                    if (session.lastMessage && session.lastMessage.reply) {
                        await session.lastMessage.reply(reminderMsg);
                    }
                } catch (error) {
                    console.error('Error sending reminder:', error);
                }
            }
            
            // If more than 10 minutes have passed, reset the conversation
            if (timeSinceLastInteraction > 10 * 60 * 1000) {
                session.state = this.conversationStates.INITIAL;
                session.currentQuestion = 0;
                session.reminded = false;
                session.data = {};
            }
        }
    }

    async getSession(userId) {
        if (!this.conversations.has(userId)) {
            this.conversations.set(userId, {
                state: this.conversationStates.INITIAL,
                currentQuestion: 0,
                lastInteraction: Date.now(),
                data: {}
            });
        }
        return this.conversations.get(userId);
    }

    async processMessage(msg, session) {
        // Update last interaction time and store the message for potential reminders
        session.lastInteraction = Date.now();
        session.lastMessage = msg;
        session.reminded = false;  // Reset reminder flag when we get a new message

        const text = msg.body.toLowerCase();
        
        // Reset conversation if user types "restart"
        if (text === 'restart') {
            session.state = this.conversationStates.INITIAL;
            session.currentQuestion = 0;
            return 'בוא נתחיל מחדש. מה המטרה העיקרית שלך?';
        }

        // Add coach button if user types "coach" or "מאמן"
        if (text === 'coach' || text === 'מאמן') {
            return this.handleEscalation(msg.body);
        }

        let response;
        try {
            switch (session.state) {
                case this.conversationStates.INITIAL:
                    response = await this.handleInitialState(msg, session);
                    break;
                case this.conversationStates.OPENING_QUESTIONS:
                    response = await this.handleOpeningQuestions(msg, session);
                    break;
                case this.conversationStates.PRE_WORKOUT:
                    response = await this.handlePreWorkout(msg, session);
                    break;
                case this.conversationStates.POST_WORKOUT:
                    response = await this.handlePostWorkout(msg, session);
                    break;
                default:
                    response = null;
            }

            // If no response was generated, use OpenAI as fallback
            if (!response) {
                response = await this.handleFallback(msg, session);
            }

            return response;
        } catch (error) {
            console.error('Error processing message:', error);
            return 'מצטער, משהו השתבש. האם תרצה להתחיל מחדש?';
        }
    }

    async getUserName(msg) {
        // For now, just use a generic name. In the future, this could be fetched from a user profile
        return "חבר";
    }

    async handleInitialState(msg, session) {
        const userName = await this.getUserName(msg);
        
        // If this is the first message (no response yet)
        if (!session.data.hasInitialGreeting) {
            session.data.hasInitialGreeting = true;
            return `היי ${userName}, ברוך הבא! אני כאן כדי לעזור לך להפיק את המירב מהאימונים שלך. מה המטרה העיקרית שלך?\n\n[בניית כוח] [ירידה במשקל] [כושר כללי] [אחר]`;
        }
        
        // If we got a response to the initial greeting
        session.data.mainGoal = msg.body;
        session.state = this.conversationStates.OPENING_QUESTIONS;
        session.currentQuestion = 1;
        return 'מה ספציפית היית רוצה לשפר בכושר שלך?\n[סיבולת] [טכניקה בתרגילים] [התמקדות באזור ספציפי] [אחר]';
    }

    async handleOpeningQuestions(msg, session) {
        const response = msg.body.toLowerCase();
        
        switch (session.currentQuestion) {
            case 1:
                session.data.specificGoal = response;
                session.currentQuestion = 2;
                return 'האם יש משהו שמגביל אותך באימונים כרגע (למשל כאב או מגבלה פיזית)?\n[כן] [לא]';
            
            case 2:
                session.data.limitations = response === 'כן' ? 'needs_details' : 'none';
                if (response === 'כן') {
                    session.currentQuestion = 3;
                    return 'תוכל לפרט יותר כדי שאוכל לעזור?';
                } else {
                    session.state = this.conversationStates.PRE_WORKOUT;
                    session.currentQuestion = 1;
                    return 'מעולה! בוא נתחיל לעקוב אחר האימונים שלך. מתי האימון הבא שלך?';
                }
            
            case 3:
                session.data.limitations = response;
                session.state = this.conversationStates.PRE_WORKOUT;
                session.currentQuestion = 1;
                return 'תודה על השיתוף. אני אקח את זה בחשבון. מתי האימון הבא שלך?';
            
            default:
                return null;
        }
    }

    async handlePreWorkout(msg, session) {
        const response = msg.body.toLowerCase();
        
        // If no current question, we're waiting for workout start
        if (!session.currentQuestion) {
            if (response === 'התחל אימון') {
                session.state = this.conversationStates.POST_WORKOUT;
                session.currentQuestion = 1;
                return 'מעולה! איך היה האימון? דרג מ-1 עד 5';
            } else if (response === 'אחר כך') {
                return 'בסדר גמור! אני אחכה שתודיע לי כשתסיים את האימון הבא.\n[התחל אימון]';
            }
            return 'אני כאן כשתהיה מוכן לתעד את האימון.\n[התחל אימון] [אחר כך]';
        }
        
        switch (session.currentQuestion) {
            case 1:
                session.data.nextWorkout = response;
                session.currentQuestion = 2;
                return 'האם תרצה שאזכיר לך את המשקלים והחזרות מהאימון הקודם?\n[כן] [לא]';
            
            case 2:
                if (response === 'כן') {
                    // Check if we have previous workout data
                    if (!session.data.previousWorkout) {
                        session.state = this.conversationStates.POST_WORKOUT;
                        session.currentQuestion = 1;
                        return 'נראה שאין לי עדיין נתונים מהאימון הקודם שלך. בוא נתחיל לתעד את האימונים שלך מהיום. איך היה האימון? דרג מ-1 עד 5';
                    }
                    session.currentQuestion = 3;
                    return `באימון הקודם שלך: ${session.data.previousWorkout}. מוכן להתחיל?\n[כן] [לא]`;
                } else {
                    session.currentQuestion = 0;
                    return 'בסדר גמור! אני אחכה שתודיע לי כשתסיים את האימון.\n[התחל אימון] [אחר כך]';
                }
            
            case 3:
                if (response === 'כן' || response === 'התחל אימון') {
                    session.state = this.conversationStates.POST_WORKOUT;
                    session.currentQuestion = 1;
                    return 'מעולה! איך היה האימון? דרג מ-1 עד 5';
                } else {
                    session.currentQuestion = 0;
                    return 'בסדר! אני אחכה שתודיע לי כשתסיים את האימון.\n[התחל אימון]';
                }
            
            default:
                return null;
        }
    }

    async handleEscalation(question) {
        return `אני לא בטוח לגבי זה. אתה מוזמן לשלוח הודעה למאמן האישי:\n\n` +
               `[לחץ כאן לשליחת הודעה למאמן](https://wa.me/${this.COACH_PHONE}?text=${encodeURIComponent(question)})`;
    }

    async handlePostWorkout(msg, session) {
        const response = msg.body.toLowerCase();
        
        if (!session.currentQuestion) {
            session.currentQuestion = 1;
            return 'איך היה האימון? דרג מ-1 עד 5';
        }

        switch (session.currentQuestion) {
            case 1:
                const rating = parseInt(response);
                if (isNaN(rating) || rating < 1 || rating > 5) {
                    return 'אנא דרג את האימון במספר בין 1 ל-5';
                }
                session.data.workoutRating = rating;
                session.currentQuestion = 2;
                return 'איזה חלק מהאימון תרצה לתעד?\n[כוח] [כוח מתפרץ] [משקל גוף] [אירובי]';
            
            case 2:
                session.data.workoutType = response;
                session.currentQuestion = 3;
                return 'מעולה! תוכל לפרט את הביצועים שלך? (משקלים, חזרות, זמנים)';
            
            case 3:
                session.data.performance = response;
                session.currentQuestion = 4;
                return 'האם חווית כאב או אי נוחות במהלך האימון?\n[כן] [לא]';
            
            case 4:
                if (response === 'כן') {
                    session.currentQuestion = 5;
                    return 'האם תוכל לשתף יותר פרטים כדי שאוכל לעזור או להודיע למאמן?\n[שתף פרטים] [פנה למאמן]';
                } else {
                    // Store this workout as the previous workout for next time
                    session.data.previousWorkout = `סוג: ${session.data.workoutType}, ביצועים: ${session.data.performance}`;
                    session.state = this.conversationStates.PRE_WORKOUT;
                    session.currentQuestion = 0;
                    return 'מצוין! אשמח לעזור לך באימון הבא. תודיע לי כשאתה מתחיל!\n[התחל אימון] [אחר כך]';
                }

            case 5:
                if (response === 'פנה למאמן') {
                    return this.handleEscalation(`המתאמן דיווח על כאב/אי נוחות באימון. פרטי האימון:\nסוג: ${session.data.workoutType}\nביצועים: ${session.data.performance}`);
                } else {
                    // Store workout details and pain information
                    session.data.painDetails = response;
                    session.data.previousWorkout = `סוג: ${session.data.workoutType}, ביצועים: ${session.data.performance}`;
                    session.state = this.conversationStates.PRE_WORKOUT;
                    session.currentQuestion = 0;
                    return 'תודה על השיתוף. אני אשמור את המידע הזה למעקב. נודיע לי כשאתה מתחיל את האימון הבא!\n[התחל אימון] [אחר כך]';
                }
            
            default:
                return null;
        }
    }

    async handleFallback(msg, session) {
        try {
            // Prepare conversation history and context
            const conversationHistory = this.getConversationHistory(session);
            
            // Add error context if available
            const errorContext = msg.error ? `\nError encountered: ${msg.error}` : '';
            
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { 
                        role: "system", 
                        content: this.systemPrompt + 
                            "\nYou are helping to handle an error or unexpected situation." +
                            "\nProvide a helpful response that guides the user forward." +
                            "\nIf there's missing data, explain what we'll do instead." +
                            errorContext
                    },
                    ...conversationHistory,
                    { role: "user", content: msg.body }
                ],
                temperature: 0.7,
                max_tokens: 200
            });

            const response = completion.choices[0].message.content;

            // Store the interaction in session history
            if (!session.data.history) {
                session.data.history = [];
            }
            session.data.history.push({
                role: "user",
                content: msg.body
            });
            session.data.history.push({
                role: "assistant",
                content: response
            });

            // Trim history if it gets too long
            if (session.data.history.length > 10) {
                session.data.history = session.data.history.slice(-10);
            }

            return response;

        } catch (error) {
            console.error('OpenAI API Error:', error);
            return 'מצטער, לא הצלחתי להבין. האם תוכל לנסח את השאלה מחדש?';
        }
    }

    getConversationHistory(session) {
        if (!session.data.history) {
            return [];
        }

        // Return last 5 interactions to stay within context limits
        return session.data.history.slice(-5);
    }
}

module.exports = ConversationManager; 