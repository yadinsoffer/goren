const { getAllActiveUsers } = require('./arboxApi');

class Flow0Manager {
    constructor() {
        this.sessions = new Map();
        this.verifiedUsers = new Map();
        this.activeUsers = null;
    }

    async getSession(userId) {
        if (!this.sessions.has(userId)) {
            this.sessions.set(userId, {
                state: 'initial',
                data: {
                    potentialMatches: [],
                    selectedUser: null
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
                case 'initial':
                    session.state = 'ask_name';
                    return {
                        text: 'היי! כדי שנוכל להתחיל, אנא הזן את שמך המלא'
                    };

                case 'ask_name':
                    // Load active users if not cached
                    if (!this.activeUsers) {
                        const response = await getAllActiveUsers(false, 1);
                        this.activeUsers = response;
                    }

                    // Search for matching users
                    const searchName = messageText.toLowerCase().trim();
                    const matchingUsers = this.activeUsers.filter(user => {
                        const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
                        const reverseName = `${user.last_name} ${user.first_name}`.toLowerCase();
                        return fullName.includes(searchName) || reverseName.includes(searchName);
                    });

                    if (matchingUsers.length === 0) {
                        return {
                            text: 'לא מצאתי משתמש עם השם הזה. אנא נסה שוב או פנה לצוות המועדון.'
                        };
                    } else if (matchingUsers.length === 1) {
                        session.state = 'verify_user';
                        session.data.selectedUser = matchingUsers[0];
                        return this.formatVerificationQuestion(matchingUsers[0]);
                    } else {
                        session.state = 'select_user';
                        session.data.potentialMatches = matchingUsers;
                        const buttons = matchingUsers.map((user, index) => ({
                            type: "reply",
                            reply: {
                                id: `user_${index}`,
                                title: `${user.first_name} ${user.last_name}`
                            }
                        }));
                        return {
                            text: 'מצאתי כמה משתמשים עם שם דומה. איזה מהם את/ה?',
                            buttons: buttons.map(b => b.reply.title)
                        };
                    }

                case 'select_user':
                    const selectedUserIndex = session.data.potentialMatches.findIndex(user => 
                        `${user.first_name} ${user.last_name}` === messageText
                    );
                    if (selectedUserIndex !== -1) {
                        session.state = 'verify_user';
                        session.data.selectedUser = session.data.potentialMatches[selectedUserIndex];
                        return this.formatVerificationQuestion(session.data.selectedUser);
                    }
                    return {
                        text: 'אנא בחר מהאפשרויות הקיימות'
                    };

                case 'verify_user':
                    if (messageText === 'כן') {
                        const verificationResult = await this.verifyUserIdentity(msg.from, session.data.selectedUser);
                        if (verificationResult) {
                            return {
                                text: 'תודה על האימות! אפשר להתחיל.',
                                shouldStartFlow1: true
                            };
                        }
                    } else if (messageText === 'לא') {
                        session.state = 'ask_name';
                        return {
                            text: 'אוקיי, אנא הזן את שמך המלא שוב'
                        };
                    }
                    break;
            }

            return {
                text: 'מצטער, לא הבנתי. אנא נסה שוב.'
            };
        } catch (error) {
            console.error('Error in Flow0Manager processMessage:', error);
            throw error;
        }
    }

    formatVerificationQuestion(user) {
        const messageText = `האם אתה ${user.first_name} ${user.last_name}?\nמספר טלפון: ${user.phone}\nתאריך לידה: ${user.birthday}`;
        return {
            text: messageText,
            buttons: ['כן', 'לא']
        };
    }

    async verifyUserIdentity(chatId, arboxUser) {
        this.verifiedUsers.set(chatId, {
            userId: arboxUser.user_fk,
            userDetails: arboxUser,
            verifiedAt: new Date()
        });
        return true;
    }

    isUserVerified(chatId) {
        return this.verifiedUsers.has(chatId);
    }

    getVerifiedUserData(chatId) {
        return this.verifiedUsers.get(chatId);
    }

    clearVerification(chatId) {
        this.verifiedUsers.delete(chatId);
    }
}

module.exports = Flow0Manager; 