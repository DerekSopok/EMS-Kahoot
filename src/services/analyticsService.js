/**
 * Analytics Service
 * Aggregates game results data for performance insights
 */

const resultsService = require('./resultsService');
const quizService = require('./quizService');

class AnalyticsService {
    /**
     * Get overview statistics
     * @returns {Object} Overview stats
     */
    async getOverviewStats() {
        const results = await resultsService.getAllResults();

        return {
            totalGames: results.length,
            totalPlayers: results.reduce((sum, r) => sum + r.playerCount, 0),
            averageScore: this.calculateAverageScore(results),
            averageAccuracy: this.calculateAverageAccuracy(results)
        };
    }

    /**
     * Calculate average score across all games
     * @param {Array} results - Game results
     * @returns {number} Average score
     */
    calculateAverageScore(results) {
        if (results.length === 0) return 0;

        let totalScore = 0;
        let totalPlayers = 0;

        for (const result of results) {
            for (const player of result.leaderboard) {
                totalScore += player.score;
                totalPlayers++;
            }
        }

        return totalPlayers > 0 ? Math.round(totalScore / totalPlayers) : 0;
    }

    /**
     * Calculate average accuracy across all games
     * @param {Array} results - Game results
     * @returns {number} Average accuracy percentage
     */
    calculateAverageAccuracy(results) {
        if (results.length === 0) return 0;

        let totalCorrect = 0;
        let totalQuestions = 0;

        for (const result of results) {
            for (const stat of result.questionStats) {
                totalCorrect += stat.correctCount;
                totalQuestions += stat.correctCount + stat.incorrectCount;
            }
        }

        return totalQuestions > 0
            ? Math.round((totalCorrect / totalQuestions) * 100)
            : 0;
    }

    /**
     * Get performance by category
     * @returns {Array} Category performance data
     */
    async getPerformanceByCategory() {
        const results = await resultsService.getAllResults();
        const quizzes = await quizService.loadQuizzes();

        // Group results by quiz category
        const byCategory = {};

        for (const result of results) {
            const quiz = quizzes.find(q => q.id === result.quizId);
            const category = quiz?.category || 'Uncategorized';

            if (!byCategory[category]) {
                byCategory[category] = {
                    games: 0,
                    totalCorrect: 0,
                    totalQuestions: 0
                };
            }

            byCategory[category].games++;
            for (const stat of result.questionStats) {
                byCategory[category].totalCorrect += stat.correctCount;
                byCategory[category].totalQuestions += stat.correctCount + stat.incorrectCount;
            }
        }

        // Calculate accuracy per category
        return Object.entries(byCategory).map(([category, data]) => ({
            category,
            games: data.games,
            accuracy: Math.round((data.totalCorrect / data.totalQuestions) * 100) || 0
        })).sort((a, b) => a.accuracy - b.accuracy); // Lowest first (needs attention)
    }

    /**
     * Get hardest questions
     * @param {number} limit - Number of questions to return
     * @returns {Array} Hardest questions
     */
    async getHardestQuestions(limit = 10) {
        const results = await resultsService.getAllResults();
        const questionStats = {};

        for (const result of results) {
            for (const stat of result.questionStats) {
                const key = `${result.quizId}-${stat.questionId}`;

                if (!questionStats[key]) {
                    questionStats[key] = {
                        quizTitle: result.quizTitle,
                        questionText: stat.questionText,
                        correct: 0,
                        incorrect: 0
                    };
                }

                questionStats[key].correct += stat.correctCount;
                questionStats[key].incorrect += stat.incorrectCount;
            }
        }

        // Calculate accuracy and sort
        return Object.values(questionStats)
            .map(q => ({
                ...q,
                total: q.correct + q.incorrect,
                accuracy: Math.round((q.correct / (q.correct + q.incorrect)) * 100)
            }))
            .filter(q => q.total >= 5) // Minimum attempts
            .sort((a, b) => a.accuracy - b.accuracy)
            .slice(0, limit);
    }

    /**
     * Get trend data
     * @param {number} days - Number of days to look back
     * @returns {Array} Trend data
     */
    async getTrendData(days = 30) {
        const results = await resultsService.getAllResults();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const recent = results.filter(r => new Date(r.startedAt) >= cutoff);

        // Group by day
        const byDay = {};
        for (const result of recent) {
            const day = result.startedAt.split('T')[0];
            if (!byDay[day]) {
                byDay[day] = { games: 0, players: 0 };
            }
            byDay[day].games++;
            byDay[day].players += result.playerCount;
        }

        return Object.entries(byDay)
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
}

module.exports = new AnalyticsService();
