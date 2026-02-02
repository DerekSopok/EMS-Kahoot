/**
 * EMS Kahoot - Game Manager
 *
 * Manages room state, players, and game sessions for real-time multiplayer quiz.
 * Supports up to 20 players per room.
 */

const { calculatePoints } = require('../utils/scoring');

const MAX_PLAYERS_PER_ROOM = 20;

class GameManager {
    constructor() {
        this.rooms = new Map(); // roomCode -> Room
        this.hostSocketToRoom = new Map(); // hostSocketId -> roomCode
        this.playerSocketToRoom = new Map(); // playerSocketId -> roomCode
        this.playerIdToRoom = new Map(); // playerId -> roomCode
        this.playerIdToSocketId = new Map(); // playerId -> socketId
        this.socketIdToPlayerId = new Map(); // socketId -> playerId
    }

    /**
     * Generate a random 6-character room code
     * @returns {string} 6-character alphanumeric code
     */
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        // Ensure uniqueness
        if (this.rooms.has(code)) {
            return this.generateRoomCode();
        }
        return code;
    }

    /**
     * Generate a unique player ID
     * @returns {string} Unique player ID
     */
    generatePlayerId() {
        return `player_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
    }

    /**
     * Create a new game room
     * @param {string} hostSocketId - Socket ID of the host
     * @param {number} quizId - Database ID of the quiz
     * @param {Array} questions - Quiz questions from database
     * @returns {Object} Room object with code and initial state
     */
    createRoom(hostSocketId, quizId, questions) {
        const roomCode = this.generateRoomCode();

        const room = {
            code: roomCode,
            hostSocketId,
            quizId,
            questions,
            players: new Map(), // playerId -> Player
            status: 'waiting', // waiting, playing, finished
            currentQuestionIndex: 0,
            questionStartTime: null,
            playersAnswered: new Set(),
            createdAt: new Date(),
            hostDisconnectedAt: null
        };

        this.rooms.set(roomCode, room);
        this.hostSocketToRoom.set(hostSocketId, roomCode);

        return room;
    }

    /**
     * Get room by code
     * @param {string} roomCode - Room code
     * @returns {Object|null} Room object or null if not found
     */
    getRoom(roomCode) {
        return this.rooms.get(roomCode) || null;
    }

    /**
     * Get room by host socket ID
     * @param {string} hostSocketId - Host socket ID
     * @returns {Object|null} Room object or null if not found
     */
    getRoomByHost(hostSocketId) {
        const roomCode = this.hostSocketToRoom.get(hostSocketId);
        return roomCode ? this.rooms.get(roomCode) : null;
    }

    /**
     * Reassign host socket ID for a room
     * @param {string} roomCode - Room code
     * @param {string} newHostSocketId - New host socket ID
     * @returns {Object|null} Updated room or null if not found
     */
    reassignHost(roomCode, newHostSocketId) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            return null;
        }

        this.hostSocketToRoom.delete(room.hostSocketId);
        room.hostSocketId = newHostSocketId;
        room.hostDisconnectedAt = null;
        this.hostSocketToRoom.set(newHostSocketId, roomCode);

        return room;
    }

    /**
     * Get room by player socket ID
     * @param {string} playerSocketId - Player socket ID
     * @returns {Object|null} Room object or null if not found
     */
    getRoomByPlayer(playerSocketId) {
        const roomCode = this.playerSocketToRoom.get(playerSocketId);
        return roomCode ? this.rooms.get(roomCode) : null;
    }

    /**
     * Add a player to a room
     * @param {string} roomCode - Room code to join
     * @param {string} socketId - Player's socket ID
     * @param {string} displayName - Player's display name
     * @returns {Object|null} Player object if successful, null if room full or not found
     */
    addPlayer(roomCode, socketId, displayName) {
        const room = this.rooms.get(roomCode);

        if (!room) {
            return null;
        }

        // Check if room is full
        if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
            return null;
        }

        // Check if game already started
        if (room.status !== 'waiting') {
            return null;
        }

        const playerId = this.generatePlayerId();
        const player = {
            id: playerId,
            socketId,
            name: displayName,
            score: 0,
            answers: [], // { questionIndex, selectedOption, isCorrect, points, responseTime }
            joinedAt: new Date()
        };

        room.players.set(socketId, player);
        this.playerSocketToRoom.set(socketId, roomCode);
        this.playerIdToRoom.set(playerId, roomCode);
        this.playerIdToSocketId.set(playerId, socketId);
        this.socketIdToPlayerId.set(socketId, playerId);

        return player;
    }

    /**
     * Remove a player from their room
     * @param {string} socketId - Player's socket ID
     * @returns {boolean} True if player was removed, false otherwise
     */
    removePlayer(socketId) {
        const roomCode = this.playerSocketToRoom.get(socketId);
        if (!roomCode) {
            return false;
        }

        const room = this.rooms.get(roomCode);
        if (!room) {
            return false;
        }

        const playerId = this.socketIdToPlayerId.get(socketId);
        room.players.delete(socketId);
        this.playerSocketToRoom.delete(socketId);
        if (playerId) {
            this.playerIdToRoom.delete(playerId);
            this.playerIdToSocketId.delete(playerId);
            this.socketIdToPlayerId.delete(socketId);
        }

        return true;
    }

    /**
     * Remove a player by player ID
     * @param {string} playerId - Player ID
     * @returns {boolean} True if player was removed, false otherwise
     */
    removePlayerById(playerId) {
        const roomCode = this.playerIdToRoom.get(playerId);
        if (!roomCode) {
            return false;
        }

        const room = this.rooms.get(roomCode);
        if (!room) {
            return false;
        }

        const socketId = this.playerIdToSocketId.get(playerId);
        if (!socketId) {
            return false;
        }

        room.players.delete(socketId);
        this.playerSocketToRoom.delete(socketId);
        this.playerIdToRoom.delete(playerId);
        this.playerIdToSocketId.delete(playerId);
        this.socketIdToPlayerId.delete(socketId);

        return true;
    }

    /**
     * Get all players in a room
     * @param {string} roomCode - Room code
     * @returns {Array} Array of player objects
     */
    getPlayers(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            return [];
        }

        return Array.from(room.players.values());
    }

    /**
     * Get player by socket ID
     * @param {string} socketId - Player's socket ID
     * @returns {Object|null} Player object or null if not found
     */
    getPlayer(socketId) {
        const roomCode = this.playerSocketToRoom.get(socketId);
        if (!roomCode) {
            return null;
        }

        const room = this.rooms.get(roomCode);
        return room ? room.players.get(socketId) : null;
    }

    /**
     * Get player by player ID
     * @param {string} playerId - Player ID
     * @returns {Object|null} Player object or null if not found
     */
    getPlayerById(playerId) {
        const roomCode = this.playerIdToRoom.get(playerId);
        if (!roomCode) {
            return null;
        }

        const room = this.rooms.get(roomCode);
        if (!room) {
            return null;
        }

        const socketId = this.playerIdToSocketId.get(playerId);
        return socketId ? room.players.get(socketId) : null;
    }

    /**
     * Reassign player socket ID for reconnects
     * @param {string} roomCode - Room code
     * @param {string} playerId - Player ID
     * @param {string} newSocketId - New socket ID
     * @returns {Object|null} Updated player or null if not found
     */
    reassignPlayerSocket(roomCode, playerId, newSocketId) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            return null;
        }

        const oldSocketId = this.playerIdToSocketId.get(playerId);
        if (!oldSocketId) {
            return null;
        }

        const player = room.players.get(oldSocketId);
        if (!player) {
            return null;
        }

        room.players.delete(oldSocketId);
        player.socketId = newSocketId;
        room.players.set(newSocketId, player);

        this.playerSocketToRoom.delete(oldSocketId);
        this.playerSocketToRoom.set(newSocketId, roomCode);
        this.playerIdToSocketId.set(playerId, newSocketId);
        this.socketIdToPlayerId.delete(oldSocketId);
        this.socketIdToPlayerId.set(newSocketId, playerId);

        return player;
    }

    /**
     * Start a game
     * @param {string} roomCode - Room code
     * @returns {boolean} True if game started, false otherwise
     */
    startGame(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room || room.status !== 'waiting') {
            return false;
        }

        room.status = 'playing';
        room.currentQuestionIndex = 0;
        room.questionStartTime = Date.now();
        room.playersAnswered.clear();

        return true;
    }

    /**
     * Get current question for a room
     * @param {string} roomCode - Room code
     * @returns {Object|null} Question object or null if not found
     */
    getCurrentQuestion(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room || room.currentQuestionIndex >= room.questions.length) {
            return null;
        }

        return room.questions[room.currentQuestionIndex];
    }

    /**
     * Submit an answer for a player
     * @param {string} socketId - Player's socket ID
     * @param {number} selectedOptionId - Selected answer option ID
     * @param {number} responseTimeMs - Response time in milliseconds
     * @returns {Object|null} Result object with isCorrect and points, or null if invalid
     */
    submitAnswer(socketId, selectedOptionId, responseTimeMs) {
        const roomCode = this.playerSocketToRoom.get(socketId);
        if (!roomCode) {
            return null;
        }

        const room = this.rooms.get(roomCode);
        if (!room || room.status !== 'playing') {
            return null;
        }

        const player = room.players.get(socketId);
        if (!player) {
            return null;
        }

        // Check if player already answered this question
        if (room.playersAnswered.has(socketId)) {
            return null;
        }

        const question = room.questions[room.currentQuestionIndex];
        if (!question) {
            return null;
        }

        // Find the selected option and check if it's correct
        const selectedOption = question.answer_options.find(opt => opt.id === selectedOptionId);
        const isCorrect = selectedOption ? selectedOption.is_correct : false;

        // Calculate points
        const points = calculatePoints(isCorrect, responseTimeMs, question.time_limit);

        // Record the answer
        const answerRecord = {
            questionIndex: room.currentQuestionIndex,
            questionId: question.id,
            selectedOptionId,
            isCorrect,
            points,
            responseTimeMs
        };

        player.answers.push(answerRecord);
        player.score += points;
        room.playersAnswered.add(socketId);

        return {
            isCorrect,
            points,
            correctOptionId: question.answer_options.find(opt => opt.is_correct)?.id,
            totalScore: player.score
        };
    }

    /**
     * Check if all players have answered the current question
     * @param {string} roomCode - Room code
     * @returns {boolean} True if all players answered
     */
    allPlayersAnswered(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            return false;
        }

        return room.playersAnswered.size === room.players.size;
    }

    /**
     * Move to next question
     * @param {string} roomCode - Room code
     * @returns {boolean} True if moved to next question, false if no more questions
     */
    nextQuestion(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            return false;
        }

        room.currentQuestionIndex++;
        room.questionStartTime = Date.now();
        room.playersAnswered.clear();

        // Check if game is finished
        if (room.currentQuestionIndex >= room.questions.length) {
            room.status = 'finished';
            return false;
        }

        return true;
    }

    /**
     * Get leaderboard for a room
     * @param {string} roomCode - Room code
     * @returns {Array} Sorted array of players by score
     */
    getLeaderboard(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            return [];
        }

        return Array.from(room.players.values())
            .sort((a, b) => b.score - a.score)
            .map((player, index) => ({
                rank: index + 1,
                name: player.name,
                score: player.score,
                socketId: player.socketId
            }));
    }

    /**
     * End a game
     * @param {string} roomCode - Room code
     * @returns {boolean} True if game ended, false otherwise
     */
    endGame(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            return false;
        }

        room.status = 'finished';
        return true;
    }

    /**
     * Delete a room and clean up all references
     * @param {string} roomCode - Room code
     * @returns {boolean} True if room was deleted, false otherwise
     */
    deleteRoom(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            return false;
        }

        // Clean up host reference
        this.hostSocketToRoom.delete(room.hostSocketId);

        // Clean up all player references
        for (const socketId of room.players.keys()) {
            this.playerSocketToRoom.delete(socketId);
            const mappedPlayerId = this.socketIdToPlayerId.get(socketId);
            if (mappedPlayerId) {
                this.playerIdToRoom.delete(mappedPlayerId);
                this.playerIdToSocketId.delete(mappedPlayerId);
                this.socketIdToPlayerId.delete(socketId);
            }
        }

        // Delete the room
        this.rooms.delete(roomCode);

        return true;
    }

    /**
     * Get number of players answered for current question
     * @param {string} roomCode - Room code
     * @returns {number} Number of players who have answered
     */
    getPlayersAnsweredCount(roomCode) {
        const room = this.rooms.get(roomCode);
        return room ? room.playersAnswered.size : 0;
    }
}

module.exports = GameManager;
