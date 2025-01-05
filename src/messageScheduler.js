class MessageScheduler {
    constructor(bot) {
        this.bot = bot;
        this.checkInterval = 60000; // Check every minute
        this.intervalId = null;
    }

    start() {
        console.log('Message scheduler started');
        this.intervalId = setInterval(() => this.checkDelayedMessages(), this.checkInterval);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    async checkDelayedMessages() {
        try {
            console.log('Checking delayed messages at:', new Date().toISOString());
            const conversationManager = this.bot.conversationManager;
            const delayedMessages = conversationManager.flow2Manager.delayedMessages;
            console.log('Current delayed messages:', delayedMessages);

            const now = Date.now();
            for (const [scheduledTime, messageData] of delayedMessages) {
                if (scheduledTime <= now) {
                    // Send the delayed message
                    await this.bot.sendMessage(messageData.userId, messageData.message);
                    // Remove it from the map
                    delayedMessages.delete(scheduledTime);
                }
            }
        } catch (error) {
            console.error('Error checking delayed messages:', error);
        }
    }
}

module.exports = MessageScheduler; 