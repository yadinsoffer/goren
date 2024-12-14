class ReminderSystem {
    constructor() {
        this.reminders = new Map();
        this.REMINDER_DELAY = 12 * 60 * 60 * 1000; // 12 hours
        this.CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    }

    async scheduleReminder(userId, type) {
        const reminder = {
            userId,
            type,
            timestamp: Date.now(),
            attempts: 0
        };

        this.reminders.set(userId, reminder);
        
        setTimeout(() => this.sendReminder(userId), this.REMINDER_DELAY);
    }

    async sendReminder(userId) {
        const reminder = this.reminders.get(userId);
        if (!reminder) return;

        if (reminder.attempts === 0) {
            reminder.attempts++;
            setTimeout(() => this.sendReminder(userId), this.REMINDER_DELAY);
        } else if (reminder.attempts === 1) {
            this.reminders.delete(userId);
        }
    }

    async checkConversationTimeout(userId, lastInteraction) {
        const timeSinceLastInteraction = Date.now() - lastInteraction;
        return timeSinceLastInteraction >= this.CONVERSATION_TIMEOUT;
    }
}

module.exports = ReminderSystem; 