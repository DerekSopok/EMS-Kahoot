/**
 * Results Service
 * Manages game results storage in JSON format
 */

const fs = require('fs').promises;
const path = require('path');

const RESULTS_FILE = path.join(__dirname, '../../db/seeds/results.json');

class ResultsService {
    constructor() {
        this.results = [];
        this.initialized = false;
    }

    /**
     * Initialize results storage
     */
    async initialize() {
        if (this.initialized) return;

        try {
            const data = await fs.readFile(RESULTS_FILE, 'utf8');
            this.results = JSON.parse(data);
        } catch (error) {
            // File doesn't exist yet, start with empty array
            if (error.code === 'ENOENT') {
                this.results = [];
                await this.saveResults();
            } else {
                throw error;
            }
        }

        this.initialized = true;
    }

    /**
     * Save results to file
     */
    async saveResults() {
        await fs.writeFile(
            RESULTS_FILE,
            JSON.stringify(this.results, null, 2),
            'utf8'
        );
    }

    /**
     * Store a game result
     * @param {Object} resultData - Game result data
     * @returns {Object} Saved result
     */
    async saveGameResult(resultData) {
        await this.initialize();

        const result = {
            id: Date.now(),
            quizId: resultData.quizId,
            quizTitle: resultData.quizTitle,
            roomCode: resultData.roomCode,
            playerCount: resultData.playerCount,
            startedAt: resultData.startedAt,
            endedAt: new Date().toISOString(),
            leaderboard: resultData.leaderboard || [],
            questionStats: resultData.questionStats || []
        };

        this.results.push(result);
        await this.saveResults();

        return result;
    }

    /**
     * Get all results
     * @returns {Array} All game results
     */
    async getAllResults() {
        await this.initialize();
        return this.results;
    }

    /**
     * Get results by quiz ID
     * @param {number} quizId - Quiz ID
     * @returns {Array} Results for the quiz
     */
    async getResultsByQuizId(quizId) {
        await this.initialize();
        return this.results.filter(r => r.quizId === quizId);
    }

    /**
     * Get result by ID
     * @param {number} id - Result ID
     * @returns {Object|null} Result or null
     */
    async getResultById(id) {
        await this.initialize();
        return this.results.find(r => r.id === id) || null;
    }

    /**
     * Delete a result
     * @param {number} id - Result ID
     */
    async deleteResult(id) {
        await this.initialize();
        const index = this.results.findIndex(r => r.id === id);

        if (index === -1) {
            throw new Error('Result not found');
        }

        this.results.splice(index, 1);
        await this.saveResults();
    }

    /**
     * Clear all results (for testing)
     */
    async clearAllResults() {
        await this.initialize();
        this.results = [];
        await this.saveResults();
    }
}

module.exports = new ResultsService();
