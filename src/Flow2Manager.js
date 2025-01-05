class Flow2Manager {
    constructor() {
        this.sessions = new Map();
        this.delayedMessages = new Map();
        this.exerciseOrder = [
            '5RM BACK SQUAT',
            '5RM BENCH PRESS',
            '5RM DEADLIFT',
            '5RM STRICT PRESS',
            '5RM BENT OVER ROW',
            '1RM POWER CLEAN',
            'MAXIMUM PULL UPS',
            'MAXIMUM DIPS'
        ];
    }

    async getSession(userId) {
        if (!this.sessions.has(userId)) {
            this.sessions.set(userId, {
                state: 'flow_2_start',
                data: {
                    currentExerciseIndex: 0,
                    exerciseData: {}
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

            switch (session.state) {
                case 'flow_2_start':
                    if (messageText === 'המשך') {
                        session.state = 'flow_2_exercise';
                        return {
                            text: 'שאלה סילוף של הביצועים שלך. כך נוכל לעקוב אחרי ההתפתחות ולכוון אותך לכיוון הנכון',
                            buttons: ['המשך']
                        };
                    }
                    break;

                case 'flow_2_exercise':
                    if (messageText === 'המשך') {
                        const exercise = this.exerciseOrder[session.data.currentExerciseIndex];
                        return {
                            text: `מה הביצוע שלך ב-${exercise}?`,
                            buttons: ['כן אני יכול', 'תזכיר לי מחר']
                        };
                    } else if (messageText === 'כן אני יכול') {
                        const exercise = this.exerciseOrder[session.data.currentExerciseIndex];
                        return {
                            text: `אנא הזן את הביצוע שלך ב-${exercise}`
                        };
                    } else if (messageText === 'תזכיר לי מחר') {
                        const exercise = this.exerciseOrder[session.data.currentExerciseIndex];
                        const scheduledTime = Date.now() + (24 * 60 * 60 * 1000);
                        this.delayedMessages.set(scheduledTime, {
                            userId: msg.from,
                            message: {
                                text: `מה הביצוע שלך ב-${exercise}?`,
                                buttons: ['כן אני יכול', 'תזכיר לי מחר']
                            }
                        });
                        session.data.currentExerciseIndex++;
                        
                        if (session.data.currentExerciseIndex >= this.exerciseOrder.length) {
                            session.state = 'flow_2_complete';
                            return {
                                text: 'תודה. שמרנו את כל הביצועים במערכת כדי לעקוב אחרי ההתפתחות'
                            };
                        } else {
                            const nextExercise = this.exerciseOrder[session.data.currentExerciseIndex];
                            return {
                                text: `מה הביצוע שלך ב-${nextExercise}?`,
                                buttons: ['כן אני יכול', 'תזכיר לי מחר']
                            };
                        }
                    } else if (this.isValidPerformanceData(messageText)) {
                        const exercise = this.exerciseOrder[session.data.currentExerciseIndex];
                        session.data.exerciseData[exercise] = messageText;
                        session.data.currentExerciseIndex++;

                        if (session.data.currentExerciseIndex >= this.exerciseOrder.length) {
                            session.state = 'flow_2_complete';
                            return {
                                text: 'תודה. שמרנו את כל הביצועים במערכת כדי לעקוב אחרי ההתפתחות'
                            };
                        } else {
                            const nextExercise = this.exerciseOrder[session.data.currentExerciseIndex];
                            return {
                                text: `מה הביצוע שלך ב-${nextExercise}?`,
                                buttons: ['כן אני יכול', 'תזכיר לי מחר']
                            };
                        }
                    }
                    break;
            }

            return {
                text: 'מצטער, לא הבנתי. אנא נסה שוב.'
            };
        } catch (error) {
            console.error('Error in Flow2Manager processMessage:', error);
            throw error;
        }
    }

    isValidPerformanceData(text) {
        return /^\d+(\s*\w+)?$/.test(text);
    }
}

module.exports = Flow2Manager; 