const OpenAI = require('openai');

class ConversationManager {
    constructor() {
        this.conversations = new Map();
        this.conversationStates = {
            INITIAL: 'initial',
            COLLECTING_TRAINING_DATA: 'collecting_training_data',
            IDENTIFYING_ISSUES: 'identifying_issues',
            DEFINING_PREFERENCES: 'defining_preferences',
            PRE_WORKOUT: 'pre_workout',
            POST_WORKOUT: 'post_workout',
            WEEKLY_SUMMARY: 'weekly_summary'
        };

        this.exerciseList = [
            'BACK SQUAT',
            'DEADLIFT',
            'STRICT PRESS',
            'BENCH PRESS',
            'BENT OVER ROW',
            'PULL UPS',
            'DIPS'
        ];

        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // Set up reminder intervals
        setInterval(() => this.checkInactiveConversations(), 30 * 60 * 1000); // Check every 30 minutes
    }

    async checkInactiveConversations() {
        const now = Date.now();
        for (const [userId, session] of this.conversations) {
            const timeSinceLastInteraction = now - session.lastInteraction;
            
            // If more than 30 minutes have passed and we're waiting for a response
            if (timeSinceLastInteraction > 30 * 60 * 1000 && !session.reminded) {
                try {
                    let reminderMsg = 'היי, מחכה לתשובה שלך כדי שנוכל להמשיך 😊';
                    if (session.lastMessage && session.lastMessage.reply) {
                        await session.lastMessage.reply(reminderMsg);
                    }
                    session.reminded = true;
                } catch (error) {
                    console.error('Error sending reminder:', error);
                }
            }
            
            // If more than 12 hours have passed
            if (timeSinceLastInteraction > 12 * 60 * 60 * 1000 && session.reminded) {
                try {
                    let reminderMsg = 'היי! חשוב לנו לעקוב אחר ההתקדמות שלך. אשמח אם תוכל להשלים את התשובות כשתתפנה 🙏';
                    if (session.lastMessage && session.lastMessage.reply) {
                        await session.lastMessage.reply(reminderMsg);
                    }
                } catch (error) {
                    console.error('Error sending second reminder:', error);
                }
            }
        }
    }

    async getSession(userId) {
        if (!this.conversations.has(userId)) {
            this.conversations.set(userId, {
                state: this.conversationStates.INITIAL,
                currentQuestion: 0,
                lastInteraction: Date.now(),
                reminded: false,
                data: {
                    name: null,
                    mainGoal: null,
                    specificGoal: null,
                    nutritionSupport: null,
                    exerciseWeights: {},
                    barriers: null,
                    barriersDetails: null,
                    supportPreference: null,
                    weeklyProgress: []
                }
            });
        }
        return this.conversations.get(userId);
    }

    async processMessage(msg, session) {
        session.lastInteraction = Date.now();
        session.lastMessage = msg;
        session.reminded = false;

        const text = msg.body.toLowerCase();
        
        // Reset conversation if user types "מחדש" or "קפלן מניאק"
        if (text === 'מחדש' || text === 'קפלן מניאק') {
            session.state = this.conversationStates.INITIAL;
            session.currentQuestion = 0;
            session.data = {
                name: session.data.name,  // Preserve name
                mainGoal: null,
                specificGoal: null,
                nutritionSupport: null,
                exerciseWeights: {},
                barriers: null,
                barriersDetails: null,
                supportPreference: null,
                weeklyProgress: []
            };
            return `היי ${session.data.name || 'מתאמן'}, אני העוזר הדיגיטלי של המועדון ואני כאן לעזור לך למצות את המקסימום מהאימונים שלך במועדון. בוא נתחיל. מה המטרה העיקרית שלך באימונים?\n\n[שיפור כוח] [שיפור הרכב גוף] [שיפור סיבולת לב ריאה] [שיפור כושר גופני כללי] [אחר]`;
        }

        let response;
        try {
            switch (session.state) {
                case this.conversationStates.INITIAL:
                    response = await this.handleInitialState(msg, session);
                    break;
                case this.conversationStates.COLLECTING_TRAINING_DATA:
                    response = await this.handleTrainingDataCollection(msg, session);
                    break;
                case this.conversationStates.IDENTIFYING_ISSUES:
                    response = await this.handleIssuesIdentification(msg, session);
                    break;
                case this.conversationStates.DEFINING_PREFERENCES:
                    response = await this.handlePreferencesDefinition(msg, session);
                    break;
                case this.conversationStates.PRE_WORKOUT:
                    response = await this.handlePreWorkout(msg, session);
                    break;
                case this.conversationStates.POST_WORKOUT:
                    response = await this.handlePostWorkout(msg, session);
                    break;
                case this.conversationStates.WEEKLY_SUMMARY:
                    response = await this.handleWeeklySummary(msg, session);
                    break;
                default:
                    response = await this.handleFallback(msg, session);
            }

            return response;
        } catch (error) {
            console.error('Error processing message:', error);
            return 'מצטער, משהו השתבש. האם תרצה להתחיל מחדש?';
        }
    }

    async handleInitialState(msg, session) {
        if (!session.data.mainGoal) {
            const validGoals = ['שיפור כוח', 'שיפור הרכב גוף', 'שיפור סיבולת לב ריאה', 'שיפור כושר גופני כללי'];
            session.data.mainGoal = msg.body;

            if (validGoals.includes(msg.body)) {
                if (msg.body === 'שיפור כוח') {
                    return 'מעולה! באיזה תרגילי כוח תרצה להשתפר?';
                } else if (msg.body === 'שיפור הרכב גוף') {
                    return 'עם או בלי ליווי תזונתי?\n[עם ליווי תזונתי] [בלי ליווי תזונתי]';
                } else {
                    return 'מצוין! איך היית רוצה להתקדם בתחום הזה?';
                }
            } else {
                return 'מעולה! איך היית רוצה להתקדם בתחום הזה?';
            }
        }

        // Handle specific goal response
        if (!session.data.specificGoal) {
            session.data.specificGoal = msg.body;
            
            // Complete opening phase
            const response = `מעולה. אני אסמן לעצמי לעזור לך להתמקד ב-${session.data.mainGoal} ולעקוב אחרי ההתקדמות שלך.`;
            
            // Move to collecting training data
            session.state = this.conversationStates.COLLECTING_TRAINING_DATA;
            session.currentQuestion = 0;
            
            // Return combined response with first exercise question
            return `${response}\n\nבוא נתחיל לאסוף נתונים על האימונים שלך.\nמה המשקל שלך ב-${this.exerciseList[0]} ל-5 חזרות?`;
        }

        return null;
    }

    async handleTrainingDataCollection(msg, session) {
        if (!session.data.exerciseWeights) {
            session.data.exerciseWeights = {};
        }

        const currentExercise = this.exerciseList[session.currentQuestion];
        
        if (session.currentQuestion < this.exerciseList.length) {
            session.data.exerciseWeights[currentExercise] = msg.body;
            session.currentQuestion++;

            if (session.currentQuestion < this.exerciseList.length) {
                return `מה המשקל שלך ב-${this.exerciseList[session.currentQuestion]} ל-5 חזרות?`;
            } else {
                // Move to identifying issues after collecting all exercise data
                session.state = this.conversationStates.IDENTIFYING_ISSUES;
                session.currentQuestion = 0;
                return 'האם יש משהו שמפריע לך באימונים כרגע (כאב, תחושת חוסר סיפוק או מגבלה מסוימת)?\n[כן] [לא]';
            }
        }

        return null;
    }

    async handleIssuesIdentification(msg, session) {
        if (!session.data.barriers) {
            const response = msg.body.toLowerCase().trim();
            const yesResponses = ['כן', 'yes', 'yep', 'ken'];
            const noResponses = ['לא', 'no', 'nope', 'lo'];

            if (yesResponses.includes(response)) {
                session.data.barriers = true;
                return 'תודה ששיתפת! אם תוכל להרחיב קצת, אני אדאג לעזור לך או להעביר את המידע למאמן בשטח.';
            } else if (noResponses.includes(response)) {
                session.data.barriers = false;
                session.state = this.conversationStates.DEFINING_PREFERENCES;
                return 'מצוין לשמוע שאין מגבלות כרגע, זה מאפשר לנו להתמקד בהשגת המטרות שלך בצורה חלקה!\n\nאיך היית רוצה שאעזור לך במהלך התהליך?\n[תזכורות ומעקב על הביצועים שלי באימונים] [המלצות על אימונים שמתאימים למטרה שסימנתי] [אחר]';
            } else if (msg.body === '[לא]' || msg.body === '[כן]') {
                // Handle button responses without brackets
                return this.handleIssuesIdentification({ ...msg, body: msg.body.replace(/[\[\]]/g, '') }, session);
            } else {
                return 'האם יש משהו שמפריע לך באימונים כרגע (��אב, תחושת חוסר סיפוק או מגבלה מסוימת)?\n[כן] [לא]';
            }
        } else if (session.data.barriers && !session.data.barriersDetails) {
            // Save the barrier details
            session.data.barriersDetails = msg.body;
            
            // Acknowledge the details and transition to preferences
            session.state = this.conversationStates.DEFINING_PREFERENCES;
            return 'תודה על השיתוף. אני אעביר את המידע למאמן כדי שיוכל להתייחס לזה באופן מקצועי.\n\nאיך היית רוצה שאעזור לך במהלך התהליך?\n[תזכורות ומעקב על הביצועים שלי באימונים] [המלצות על אימונים שמתאימים למטרה שסימנתי] [אחר]';
        }

        return null;
    }

    async handlePreferencesDefinition(msg, session) {
        if (!session.data.supportPreference) {
            session.data.supportPreference = msg.body;
            session.state = this.conversationStates.PRE_WORKOUT;
            return 'נהדר! אני אדאג לתת לך ' + msg.body + ' בצורה שתתאים למטרות ולצרכים שלך. אנחנו כבר בדרך הנכונה! שמח לקחת חלק בתהליך שלך ונדבר שוב לקראת האימון הבא שלך!';
        }

        return null;
    }

    async handlePreWorkout(msg, session) {
        // Only send pre-workout messages at specific times
        const now = new Date();
        const hour = now.getHours();
        
        // Only send pre-workout messages between 6 AM and 8 PM
        if (hour < 6 || hour > 20) {
            return null;
        }

        if (!session.data.nextWorkout) {
            return 'היום באימון יש לך חלק מסוים שרלוונטי למטרות שדיברנו עליהן. תרצה שאזכיר לך את המשקל שעבד�� איתו בפעם הקודמת ואת כמות החזרות שביצעת?\n[כן] [לא]';
        }

        if (session.data.wantsReminder === undefined && msg.body.toLowerCase() === 'כן') {
            session.data.wantsReminder = true;
            // Show previous workout data if available
            const exercise = session.data.lastWorkoutExercise;
            if (exercise && session.data.exerciseWeights[exercise]) {
                return `בפעם הקודמת עבדת עם ${session.data.exerciseWeights[exercise]} ל-5 חזרות. זו כבר התקדמות יפה!\n\nבהצלחה באימון היום, נדבר בהמשך!`;
            }
            return 'בהצלחה באימון היום, נדבר בהמשך!';
        }

        if (session.data.wantsReminder === undefined && msg.body.toLowerCase() === 'לא') {
            session.data.wantsReminder = false;
            return 'בהצלחה באימון היום, נדבר בהמשך!';
        }

        return null;
    }

    async handlePostWorkout(msg, session) {
        // Post-workout logic implementation
        return null;
    }

    async handleWeeklySummary(msg, session) {
        // Weekly summary logic implementation
        return null;
    }

    async handleFallback(msg, session) {
        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    { 
                        role: "system", 
                        content: `You are a helpful fitness assistant bot that speaks Hebrew. 
                            You help users with their workout routines and fitness goals.
                            Keep responses concise and friendly. If you're not sure about something medical or 
                            injury-related, suggest contacting a coach.
                            Always respond in Hebrew.
                            Current conversation state: ${session.state}
                            User data: ${JSON.stringify(session.data)}`
                    },
                    { role: "user", content: msg.body }
                ],
                temperature: 0.7,
                max_tokens: 200
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI API Error:', error);
            return 'מצטער, לא הצלחתי להבין. האם תוכל לנסח את השאלה מחדש?';
        }
    }
}

module.exports = ConversationManager; 