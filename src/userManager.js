class UserManager {
    constructor() {
        this.users = new Map();
    }

    async getUser(userId) {
        if (!this.users.has(userId)) {
            this.users.set(userId, {
                id: userId,
                lastInteraction: Date.now(),
                goals: [],
                preferences: {},
                workoutHistory: []
            });
        }
        return this.users.get(userId);
    }

    async updateUser(userId, data) {
        const user = await this.getUser(userId);
        Object.assign(user, data);
        user.lastInteraction = Date.now();
        return user;
    }

    async updateLastInteraction(userId) {
        const user = await this.getUser(userId);
        user.lastInteraction = Date.now();
        return user;
    }

    async addWorkout(userId, workout) {
        const user = await this.getUser(userId);
        user.workoutHistory.push({
            ...workout,
            timestamp: Date.now()
        });
        return user;
    }
}

module.exports = UserManager; 