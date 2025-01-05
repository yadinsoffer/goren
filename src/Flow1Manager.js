const OpenAI = require('openai');

class Flow1Manager {
    constructor() {
        this.sessions = new Map();
    }

    async getSession(userId) {
        if (!this.sessions.has(userId)) {
            this.sessions.set(userId, {
                state: 'initial',
                data: {
                    goal: null,
                    needsNutritionist: null
                }
            });
        }
        return this.sessions.get(userId);
    }

    async processMessage(msg, session) {
        try {
            let messageText = '';
            
            if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
                messageText = msg.interactive.button_reply.title;
                console.log('Received button response:', messageText);
            } else if (msg.body) {
                messageText = msg.body.toLowerCase().trim();
                console.log('Received text message:', messageText);
            } else {
                console.error('Invalid message format:', msg);
                return {
                    text: 'מצטער, משהו השתבש. אנא נסה שוב.'
                };
            }

            // Initial trigger
            if (messageText === 'קפלן מניאק') {
                console.log('Triggered initial message, resetting session');
                session.state = 'start';
                session.data = {
                    goal: null,
                    needsNutritionist: null
                };
                return {
                    text: 'היי, אני הנערה הדיגיטלי שלך במועדון. מיד נתחיל עם תהליך למידה ואיסוף נתונים כדי לתת לך את החוויה המקצועית הטובה ביותר. שנתחיל?',
                    buttons: ['כן', 'לא']
                };
            }

            switch (session.state) {
                case 'initial':
                case 'start':
                    if (messageText === 'כן' || messageText.includes('כן')) {
                        session.state = 'ask_goal';
                        return {
                            text: 'שאלה 1: מה המטרה העיקרית שלך באימונים?',
                            buttons: [
                                'שיפור האירובי/כושר גופני כללי',
                                'שיפור הבריאות (הרזיה או מסה)',
                                'התקדמות במשקלים ובתרגילי הכוח'
                            ]
                        };
                    } else if (messageText === 'לא' || messageText.includes('לא')) {
                        session.state = 'initial';
                        return {
                            text: 'אין בעיה. מחר זה גם זמן מצוין לדבר איתי.',
                            shouldScheduleReminder: true
                        };
                    }
                    break;

                case 'ask_goal':
                    if (messageText.includes('שיפור האירובי') || messageText.includes('כושר גופני')) {
                        session.data.goal = 'cardio';
                        return {
                            text: 'מצוין! נורא שאתה מגיע לאימונים עם הדופק הגבוה אל תשכח לשלב גם כוח.',
                            shouldStartFlow2: true
                        };
                    } else if (messageText.includes('שיפור הבריאות')) {
                        session.state = 'ask_nutrition';
                        session.data.goal = 'health';
                        return {
                            text: 'מצוין! האם תצטרך ליווי של התזונאית המועדון?',
                            buttons: ['כן', 'לא']
                        };
                    } else if (messageText.includes('התקדמות במשקלים')) {
                        session.data.goal = 'strength';
                        return {
                            text: 'מצוין בוא נתחיל מעקב אחרי הביצועים שלך.',
                            shouldStartFlow2: true
                        };
                    }
                    return {
                        text: 'אנא בחר אחת מהאפשרויות הנתונות',
                        buttons: [
                            'שיפור האירובי/כושר גופני כללי',
                            'שיפור הבריאות (הרזיה או מסה)',
                            'התקדמות במשקלים ובתרגילי הכוח'
                        ]
                    };

                case 'ask_nutrition':
                    if (messageText === 'כן' || messageText.includes('כן')) {
                        session.data.needsNutritionist = true;
                        return {
                            text: 'נעדכן את התזונאית שתיצור איתך קשר.',
                            shouldStartFlow2: true
                        };
                    } else if (messageText === 'לא' || messageText.includes('לא')) {
                        session.data.needsNutritionist = false;
                        return {
                            text: 'אין בעיה. בוא נעבור לשלב הבא.',
                            shouldStartFlow2: true
                        };
                    }
                    break;
            }

            return {
                text: 'מצטער, לא הבנתי. אנא נסה שוב או כתוב "קפלן מניאק" כדי להתחיל מחדש.'
            };
        } catch (error) {
            console.error('Error in Flow1Manager processMessage:', error);
            throw error;
        }
    }
}

module.exports = Flow1Manager; 