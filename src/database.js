class Database {
    constructor() {
        this.data = new Map();
        this.responses = [];
    }

    async saveResponse(phoneNumber, response) {
        const timestamp = new Date().toISOString();
        const entry = { timestamp, phoneNumber, response };
        this.responses.push(entry);
        return entry;
    }

    async getUserData(userId) {
        if (!this.data.has(userId)) {
            this.data.set(userId, {
                workouts: [],
                goals: {},
                lastWorkout: null,
                exerciseHistory: new Map(),
                lastWeightIncrease: new Map()
            });
        }
        return this.data.get(userId);
    }

    async updateUserData(userId, data) {
        this.data.set(userId, data);
        return data;
    }

    async getResponses() {
        return this.responses;
    }
}

module.exports = Database; 