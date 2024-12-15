class WeeklySummary {
    constructor() {
        this.summaries = new Map();
    }

    async generateWeeklySummary(userId, userData) {
        const workouts = userData.weeklyProgress || [];
        const recentWorkouts = workouts.filter(w => 
            w.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000
        );

        let message = `סיכום שבועי 📊\n\n`;
        
        // Add completed workouts
        message += '🏋️ אימונים שהושלמו:\n';
        if (recentWorkouts.length > 0) {
            recentWorkouts.forEach(workout => {
                const rating = workout.rating ? `(דירוג: ${workout.rating}/5)` : '';
                message += `- ${workout.type || 'אימון'}: ${workout.performance || ''} ${rating}\n`;
            });
        } else {
            message += 'לא נרשמו אימונים השבוע\n';
        }

        // Add achievements
        const achievements = this.getAchievements(recentWorkouts, userData);
        if (achievements.length > 0) {
            message += '\n🏆 הישגים השבוע:\n';
            achievements.forEach(achievement => {
                message += `- ${achievement}\n`;
            });
        }

        // Add pain/challenges section if any were reported
        const painReports = recentWorkouts.filter(w => w.pain || w.challenges);
        if (painReports.length > 0) {
            message += '\n⚠️ נקודות לתשומת לב:\n';
            painReports.forEach(report => {
                if (report.pain) {
                    message += `- דווח על כאב: ${report.pain}\n`;
                }
                if (report.challenges) {
                    message += `- אתגר: ${report.challenges}\n`;
                }
            });
            message += '\nמומלץ לשתף את המאמן בנקודות אלו באימון הבא.\n';
        }

        // Add motivational message
        message += '\n💪 מוטיבציה לשבוע הבא:\n';
        if (recentWorkouts.length >= 3) {
            message += 'כל הכבוד על ההתמדה! אתה בדרך הנכונה להשגת המטרות שלך.';
        } else if (recentWorkouts.length > 0) {
            message += 'התחלה טובה! בוא נשאף להגביר את התדירות בשבוע הבא.';
        } else {
            message += 'שבוע חדש = הזדמנות חדשה! בוא נתחיל אותו בכוח ומוטיבציה 💪';
        }

        return message;
    }

    getAchievements(workouts, userData) {
        const achievements = [];
        
        // Workout frequency achievements
        if (workouts.length >= 3) {
            achievements.push('השלמת 3 אימונים או יותר השבוע! 🎯');
        }

        // Performance improvements
        workouts.forEach(workout => {
            if (workout.type === 'כוח' && workout.performance) {
                const previousMax = userData.exerciseWeights?.[workout.exercise];
                if (previousMax && parseFloat(workout.performance) > parseFloat(previousMax)) {
                    achievements.push(`שיפרת את השיא שלך ב${workout.exercise}! 💪`);
                }
            }
        });

        // Consistency achievements
        const consistentRatings = workouts.filter(w => w.rating >= 4).length;
        if (consistentRatings >= 2) {
            achievements.push('שמרת על רמת אימון גבוהה! המשך כך 🌟');
        }

        return achievements;
    }

    async clearWeeklySummary(userId) {
        this.summaries.delete(userId);
    }
}

module.exports = WeeklySummary; 