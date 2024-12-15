class ReminderSystem {
    constructor() {
        this.reminders = new Map();
        this.FIRST_REMINDER_DELAY = 12 * 60 * 60 * 1000;  // 12 hours
        this.SECOND_REMINDER_DELAY = 24 * 60 * 60 * 1000; // 24 hours
        this.CONVERSATION_TIMEOUT = 30 * 60 * 1000;       // 30 minutes
    }

    async scheduleReminder(userId, type) {
        const reminder = {
            userId,
            type,
            timestamp: Date.now(),
            attempts: 0,
            messages: {
                pre_workout: {
                    first: 'היי! רק רציתי להזכיר לך שיש לך אימון מתוכנן. אשמח לעזור לך לעקוב אחר הביצועים שלך 💪',
                    second: 'היי! חשוב לנו לעקוב אחר ההתקדמות שלך באימונים. אשמח אם תעדכן אותי כשתתפנה 🙏'
                },
                post_workout: {
                    first: 'היי! אשמח לשמוע איך היה האימון שלך היום 🏋️‍♂️',
                    second: 'היי! חשוב לנו לדעת איך היה האימון. זה עוזר לנו לעקוב אחר ההתקדמות שלך 📈'
                }
            }
        };

        this.reminders.set(userId, reminder);
        
        // Schedule first reminder after 12 hours
        setTimeout(() => this.sendReminder(userId, true), this.FIRST_REMINDER_DELAY);
    }

    async sendReminder(userId, isFirstReminder) {
        const reminder = this.reminders.get(userId);
        if (!reminder) return;

        try {
            const messages = reminder.messages[reminder.type];
            const message = isFirstReminder ? messages.first : messages.second;
            
            // Send the reminder message
            // Note: This requires the bot instance to be passed in or made available
            // In a real implementation, you'd want to emit an event or use a message queue
            console.log(`Sending reminder to ${userId}: ${message}`);
            
            if (isFirstReminder) {
                // Schedule second reminder after another 12 hours
                setTimeout(() => this.sendReminder(userId, false), this.FIRST_REMINDER_DELAY);
            } else {
                // After second reminder, remove the reminder
                this.reminders.delete(userId);
            }
        } catch (error) {
            console.error(`Error sending reminder to ${userId}:`, error);
        }
    }

    async checkConversationTimeout(userId, lastInteraction) {
        const timeSinceLastInteraction = Date.now() - lastInteraction;
        return timeSinceLastInteraction >= this.CONVERSATION_TIMEOUT;
    }

    async clearReminders(userId) {
        this.reminders.delete(userId);
    }
}

module.exports = ReminderSystem; 