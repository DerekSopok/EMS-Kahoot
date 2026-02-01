/**
 * EMS Kahoot - Scoring Utility
 *
 * Calculates points based on correctness and response speed.
 * Formula: points = correct ? Math.round(1000 * (1 - (responseTime / timeLimit) * 0.5)) : 0
 *
 * Base points: 1000
 * Speed bonus: Faster answers = more points (up to 50% bonus for instant answers)
 */

/**
 * Calculate points for an answer
 * @param {boolean} isCorrect - Whether the answer is correct
 * @param {number} responseTimeMs - Time taken to answer in milliseconds
 * @param {number} timeLimitSeconds - Total time limit for the question in seconds (default: 20)
 * @returns {number} Points earned (0 if incorrect, 500-1000 if correct)
 */
function calculatePoints(isCorrect, responseTimeMs, timeLimitSeconds = 20) {
    // No points for incorrect answers
    if (!isCorrect) {
        return 0;
    }

    // Convert time limit to milliseconds
    const timeLimitMs = timeLimitSeconds * 1000;

    // Ensure response time doesn't exceed time limit
    const actualResponseTime = Math.min(responseTimeMs, timeLimitMs);

    // Calculate points using the formula
    // points = 1000 * (1 - (responseTime / timeLimit) * 0.5)
    // This gives:
    // - Instant answer (0ms): 1000 points
    // - Half time (10s): 750 points
    // - Full time (20s): 500 points
    const points = Math.round(1000 * (1 - (actualResponseTime / timeLimitMs) * 0.5));

    return Math.max(500, Math.min(1000, points)); // Ensure points are between 500-1000
}

/**
 * Sort players by score (descending)
 * @param {Array} players - Array of player objects with score property
 * @returns {Array} Sorted array of players
 */
function sortPlayersByScore(players) {
    return players.sort((a, b) => b.score - a.score);
}

/**
 * Generate leaderboard from players
 * @param {Array} players - Array of player objects
 * @param {number} limit - Number of top players to return (default: 10)
 * @returns {Array} Top players with rank
 */
function generateLeaderboard(players, limit = 10) {
    const sorted = sortPlayersByScore([...players]);
    return sorted.slice(0, limit).map((player, index) => ({
        rank: index + 1,
        name: player.name,
        score: player.score,
        playerId: player.playerId
    }));
}

module.exports = {
    calculatePoints,
    sortPlayersByScore,
    generateLeaderboard
};
