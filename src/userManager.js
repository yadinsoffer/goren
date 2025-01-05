const { getAllActiveUsers } = require('./arboxApi');

class UserManager {
    constructor() {
        this.verifiedUsers = new Map(); // Store verified users by chat ID
        this.activeUsers = null; // Cache for active users from Arbox
    }

    async findUsersByName(name) {
        // Load active users if not cached
        if (!this.activeUsers) {
            const response = await getAllActiveUsers(false, 1);
            this.activeUsers = response;
        }

        // Search for users with matching first or last name (case insensitive)
        const searchName = name.toLowerCase().trim();
        return this.activeUsers.filter(user => {
            const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
            const reverseName = `${user.last_name} ${user.first_name}`.toLowerCase();
            return fullName.includes(searchName) || reverseName.includes(searchName);
        });
    }

    async verifyUserIdentity(chatId, arboxUser, providedAnswer) {
        // Format the verification data for display
        const verificationData = {
            phone: arboxUser.phone ? `*${arboxUser.phone.slice(-4)}` : null,
            birthday: arboxUser.birthday ? new Date(arboxUser.birthday).toLocaleDateString('he-IL') : null
        };

        if (providedAnswer.toLowerCase() === 'yes') {
            // Store the verified user data
            this.verifiedUsers.set(chatId, {
                userId: arboxUser.user_fk,
                userDetails: arboxUser,
                verifiedAt: new Date()
            });
            return true;
        }
        return false;
    }

    isUserVerified(chatId) {
        return this.verifiedUsers.has(chatId);
    }

    getVerifiedUserData(chatId) {
        return this.verifiedUsers.get(chatId);
    }

    formatVerificationQuestion(user, chatId) {
        const messageText = `האם אתה ${user.first_name} ${user.last_name}?\nמספר טלפון: ${user.phone}\nתאריך לידה: ${user.birthday}`;
        return {
            messaging_product: "whatsapp",
            to: chatId,
            recipient_type: "individual",
            type: "interactive",
            interactive: {
                type: "button",
                body: {
                    text: messageText
                },
                action: {
                    buttons: [
                        {
                            type: "reply",
                            reply: {
                                id: "yes_verify",
                                title: "כן"
                            }
                        },
                        {
                            type: "reply",
                            reply: {
                                id: "no_verify",
                                title: "לא"
                            }
                        }
                    ]
                }
            }
        };
    }

    clearVerification(chatId) {
        this.verifiedUsers.delete(chatId);
    }
}

module.exports = UserManager; 