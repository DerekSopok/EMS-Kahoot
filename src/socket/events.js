/**
 * EMS Kahoot - Socket.IO Event Handlers
 *
 * Handles all real-time events for multiplayer quiz gameplay.
 * Supports up to 20 players per room.
 */

const GameManager = require('./gameManager');
const quizService = require('../services/quizService');

/**
 * Initialize Socket.IO event handlers
 * @param {Object} io - Socket.IO server instance
 */
function initializeSocketEvents(io) {
    const gameManager = new GameManager();
    const hostDisconnectTimers = new Map();
    const playerDisconnectTimers = new Map();

    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);

        // ===========================
        // QUIZ LIST EVENT (for create page)
        // ===========================

        /**
         * Request quiz names for the create page
         * Used by /create/ page to show available quizzes
         * Emits: gameNamesData with array of quiz objects
         */
        socket.on('requestDbNames', async () => {
            try {
                const quizzes = await quizService.loadQuizzes();
                // Transform to match expected format by frontend
                const quizData = quizzes
                    .filter(q => q.is_public !== false)
                    .map(q => ({
                        id: q.id,
                        name: q.title
                    }));
                socket.emit('gameNamesData', quizData);
            } catch (error) {
                console.error('Error fetching quiz names:', error);
                socket.emit('gameNamesData', []);
            }
        });

        // ===========================
        // HOST EVENTS
        // ===========================

        /**
         * Host creates a new room (new API)
         * Expects: { quizId: number }
         * Emits: { success: boolean, roomCode: string, error?: string }
         */
        socket.on('host:create-room', async (data) => {
            try {
                const { quizId } = data;

                // Fetch quiz and questions from JSON file storage
                const quiz = await quizService.getQuizById(quizId);

                if (!quiz) {
                    socket.emit('host:create-room', {
                        success: false,
                        error: 'Quiz not found'
                    });
                    return;
                }

                const formattedQuestions = quizService.formatQuestionsForGame(quiz);

                if (formattedQuestions.length === 0) {
                    socket.emit('host:create-room', {
                        success: false,
                        error: 'Quiz has no questions'
                    });
                    return;
                }

                // Create room
                const room = gameManager.createRoom(socket.id, quizId, formattedQuestions);

                // Join the room
                socket.join(room.code);

                console.log(`Room created: ${room.code} by host ${socket.id}`);

                socket.emit('host:create-room', {
                    success: true,
                    roomCode: room.code,
                    quizTitle: quiz.title,
                    questionCount: formattedQuestions.length
                });

            } catch (error) {
                console.error('Error creating room:', error);
                socket.emit('host:create-room', {
                    success: false,
                    error: 'Failed to create room'
                });
            }
        });

        /**
         * Host re-joins an existing room (e.g., page navigation)
         * Expects: { roomCode: string }
         * Emits: { success: boolean, roomCode: string, status: string, players: Array, question?: Object }
         */
        socket.on('host:join-room', (data) => {
            try {
                const roomCode = data?.roomCode?.toUpperCase();
                if (!roomCode) {
                    socket.emit('host:join-room', { success: false, error: 'Room code required' });
                    return;
                }

                const room = gameManager.getRoom(roomCode);
                if (!room) {
                    socket.emit('host:join-room', { success: false, error: 'Room not found' });
                    return;
                }

                const reconnectTimer = hostDisconnectTimers.get(roomCode);
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    hostDisconnectTimers.delete(roomCode);
                }

                if (room.hostSocketId !== socket.id) {
                    gameManager.reassignHost(roomCode, socket.id);
                }

                socket.join(roomCode);

                const players = gameManager.getPlayers(roomCode).map(p => ({
                    name: p.name,
                    id: p.socketId,
                    score: p.score,
                    playerId: p.id
                }));

                const response = {
                    success: true,
                    roomCode,
                    status: room.status,
                    players,
                    playerCount: players.length
                };

                if (room.status === 'playing') {
                    const question = gameManager.getCurrentQuestion(roomCode);
                    if (question) {
                        const correctOption = question.answer_options.find(opt => opt.is_correct);
                        response.question = {
                            questionIndex: room.currentQuestionIndex,
                            questionNumber: room.currentQuestionIndex + 1,
                            totalQuestions: room.questions.length,
                            questionText: question.question_text,
                            timeLimit: question.time_limit,
                            answers: question.answer_options.map(opt => ({
                                id: opt.id,
                                text: opt.option_text,
                                order: opt.order_index
                            })),
                            correctAnswerId: correctOption?.id
                        };
                    }
                }

                socket.emit('host:join-room', response);
            } catch (error) {
                console.error('Error rejoining room:', error);
                socket.emit('host:join-room', { success: false, error: 'Failed to join room' });
            }
        });

        /**
         * Host starts the game
         * Emits to all players: game:question with first question (without correct answer)
         */
        socket.on('host:start-game', () => {
            try {
                const room = gameManager.getRoomByHost(socket.id);

                if (!room) {
                    socket.emit('error', { message: 'Room not found' });
                    return;
                }

                if (room.players.size === 0) {
                    socket.emit('error', { message: 'No players in room' });
                    return;
                }

                // Start the game
                gameManager.startGame(room.code);

                const question = gameManager.getCurrentQuestion(room.code);

                if (!question) {
                    socket.emit('error', { message: 'No questions available' });
                    return;
                }

                // Prepare question data (no correct answer for players)
                const questionData = {
                    questionIndex: room.currentQuestionIndex,
                    questionNumber: room.currentQuestionIndex + 1,
                    totalQuestions: room.questions.length,
                    questionText: question.question_text,
                    timeLimit: question.time_limit,
                    answers: question.answer_options.map(opt => ({
                        id: opt.id,
                        text: opt.option_text,
                        order: opt.order_index
                    }))
                };

                // Send to all in room (host gets correct answer, players don't)
                io.to(room.code).emit('game:question', questionData);

                // Send correct answer only to host
                const correctOption = question.answer_options.find(opt => opt.is_correct);
                socket.emit('game:question-host', {
                    ...questionData,
                    correctAnswerId: correctOption?.id
                });

                console.log(`Game started in room ${room.code}`);

            } catch (error) {
                console.error('Error starting game:', error);
                socket.emit('error', { message: 'Failed to start game' });
            }
        });

        /**
         * Host advances to next question
         * Emits: game:question to all players
         */
        socket.on('host:next-question', () => {
            try {
                const room = gameManager.getRoomByHost(socket.id);

                if (!room) {
                    socket.emit('error', { message: 'Room not found' });
                    return;
                }

                // Get current question results before moving to next
                const leaderboard = gameManager.getLeaderboard(room.code);

                // Move to next question
                const hasNext = gameManager.nextQuestion(room.code);

                if (!hasNext) {
                    // Game is finished
                    const finalLeaderboard = gameManager.getLeaderboard(room.code);

                    io.to(room.code).emit('game:ended', {
                        leaderboard: finalLeaderboard
                    });

                    console.log(`Game ended in room ${room.code}`);
                    return;
                }

                // Send next question
                const question = gameManager.getCurrentQuestion(room.code);

                const questionData = {
                    questionIndex: room.currentQuestionIndex,
                    questionNumber: room.currentQuestionIndex + 1,
                    totalQuestions: room.questions.length,
                    questionText: question.question_text,
                    timeLimit: question.time_limit,
                    answers: question.answer_options.map(opt => ({
                        id: opt.id,
                        text: opt.option_text,
                        order: opt.order_index
                    }))
                };

                io.to(room.code).emit('game:question', questionData);

                // Send correct answer only to host
                const correctOption = question.answer_options.find(opt => opt.is_correct);
                socket.emit('game:question-host', {
                    ...questionData,
                    correctAnswerId: correctOption?.id
                });

                console.log(`Next question in room ${room.code}`);

            } catch (error) {
                console.error('Error advancing question:', error);
                socket.emit('error', { message: 'Failed to advance question' });
            }
        });

        /**
         * Host ends the game
         * Emits: game:ended with final leaderboard
         */
        socket.on('host:end-game', () => {
            try {
                const room = gameManager.getRoomByHost(socket.id);

                if (!room) {
                    socket.emit('error', { message: 'Room not found' });
                    return;
                }

                gameManager.endGame(room.code);

                const finalLeaderboard = gameManager.getLeaderboard(room.code);

                io.to(room.code).emit('game:ended', {
                    leaderboard: finalLeaderboard
                });

                console.log(`Host ended game in room ${room.code}`);

            } catch (error) {
                console.error('Error ending game:', error);
                socket.emit('error', { message: 'Failed to end game' });
            }
        });

        /**
         * Host requests current leaderboard
         * Emits: game:leaderboard
         */
        socket.on('host:get-leaderboard', () => {
            try {
                const room = gameManager.getRoomByHost(socket.id);

                if (!room) {
                    socket.emit('error', { message: 'Room not found' });
                    return;
                }

                const leaderboard = gameManager.getLeaderboard(room.code);

                socket.emit('game:leaderboard', {
                    leaderboard,
                    questionNumber: room.currentQuestionIndex + 1,
                    totalQuestions: room.questions.length
                });

            } catch (error) {
                console.error('Error getting leaderboard:', error);
                socket.emit('error', { message: 'Failed to get leaderboard' });
            }
        });

        /**
         * Host marks question time as up
         * Emits: game:times-up to all players with correct answer and leaderboard
         */
        socket.on('host:times-up', () => {
            try {
                const room = gameManager.getRoomByHost(socket.id);

                if (!room) {
                    socket.emit('error', { message: 'Room not found' });
                    return;
                }

                const question = gameManager.getCurrentQuestion(room.code);
                if (!question) {
                    return;
                }

                const correctOption = question.answer_options.find(opt => opt.is_correct);
                const leaderboard = gameManager.getLeaderboard(room.code);
                const playersAnswered = gameManager.getPlayersAnsweredCount(room.code);

                io.to(room.code).emit('game:times-up', {
                    correctAnswerId: correctOption?.id,
                    correctAnswerText: correctOption?.option_text,
                    leaderboard,
                    playersAnswered,
                    totalPlayers: room.players.size
                });

                console.log(`Time's up in room ${room.code}`);

            } catch (error) {
                console.error('Error marking time up:', error);
            }
        });

        // ===========================
        // PLAYER EVENTS
        // ===========================

        /**
         * Player joins a room (new API)
         * Expects: { roomCode: string, displayName: string }
         * Emits: { success: boolean, error?: string }
         * Broadcasts: room:player-joined to all in room
         */
        socket.on('player:join-room', (data) => {
            try {
                const { roomCode, displayName } = data;

                if (!roomCode || !displayName) {
                    socket.emit('player:join-room', {
                        success: false,
                        error: 'Room code and display name are required'
                    });
                    return;
                }

                const room = gameManager.getRoom(roomCode.toUpperCase());

                if (!room) {
                    socket.emit('player:join-room', {
                        success: false,
                        error: 'Room not found'
                    });
                    return;
                }

                // Try to add player
                const player = gameManager.addPlayer(roomCode.toUpperCase(), socket.id, displayName);

                if (!player) {
                    socket.emit('player:join-room', {
                        success: false,
                        error: 'Room is full or game already started'
                    });
                    return;
                }

                // Join the room
                socket.join(roomCode.toUpperCase());

                socket.emit('player:join-room', {
                    success: true,
                    roomCode: roomCode.toUpperCase(),
                    playerName: displayName,
                    playerId: player.id
                });

                // Broadcast to all in room
                const players = gameManager.getPlayers(roomCode.toUpperCase());
                io.to(roomCode.toUpperCase()).emit('room:player-joined', {
                    playerName: displayName,
                    playerCount: players.length,
                    players: players.map(p => ({
                        name: p.name,
                        id: p.socketId
                    }))
                });

                console.log(`Player ${displayName} joined room ${roomCode.toUpperCase()}`);

            } catch (error) {
                console.error('Error joining room:', error);
                socket.emit('player:join-room', {
                    success: false,
                    error: 'Failed to join room'
                });
            }
        });

        /**
         * Player re-joins an existing room (e.g., page navigation)
         * Expects: { roomCode: string, playerId: string }
         * Emits: { success: boolean, playerName?: string, playerScore?: number, status?: string, question?: Object }
         */
        socket.on('player:rejoin-room', (data) => {
            try {
                const roomCode = data?.roomCode?.toUpperCase();
                const playerId = data?.playerId;

                if (!roomCode || !playerId) {
                    socket.emit('player:rejoin-room', { success: false, error: 'Room code and player ID required' });
                    return;
                }

                const room = gameManager.getRoom(roomCode);
                if (!room) {
                    socket.emit('player:rejoin-room', { success: false, error: 'Room not found' });
                    return;
                }

                const reconnectTimer = playerDisconnectTimers.get(playerId);
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    playerDisconnectTimers.delete(playerId);
                }

                const player = gameManager.reassignPlayerSocket(roomCode, playerId, socket.id);
                if (!player) {
                    socket.emit('player:rejoin-room', { success: false, error: 'Player not found' });
                    return;
                }

                socket.join(roomCode);

                const response = {
                    success: true,
                    playerName: player.name,
                    playerScore: player.score,
                    status: room.status
                };

                if (room.status === 'playing') {
                    const question = gameManager.getCurrentQuestion(roomCode);
                    if (question) {
                        response.question = {
                            questionIndex: room.currentQuestionIndex,
                            questionNumber: room.currentQuestionIndex + 1,
                            totalQuestions: room.questions.length,
                            questionText: question.question_text,
                            timeLimit: question.time_limit,
                            answers: question.answer_options.map(opt => ({
                                id: opt.id,
                                text: opt.option_text,
                                order: opt.order_index
                            }))
                        };
                    }
                }

                socket.emit('player:rejoin-room', response);
            } catch (error) {
                console.error('Error rejoining room:', error);
                socket.emit('player:rejoin-room', { success: false, error: 'Failed to rejoin room' });
            }
        });

        /**
         * Player submits an answer
         * Expects: { answerId: number, responseTime: number }
         * Emits: player:answer-result with feedback
         * Broadcasts: game:player-answered to room (for progress tracking)
         */
        socket.on('player:submit-answer', (data) => {
            try {
                const { answerId, responseTime } = data;

                const room = gameManager.getRoomByPlayer(socket.id);

                if (!room) {
                    socket.emit('error', { message: 'Room not found' });
                    return;
                }

                if (room.status !== 'playing') {
                    socket.emit('error', { message: 'Game is not active' });
                    return;
                }

                // Submit answer
                const result = gameManager.submitAnswer(socket.id, answerId, responseTime);

                if (!result) {
                    socket.emit('error', { message: 'Failed to submit answer' });
                    return;
                }

                // Send result to player
                socket.emit('player:answer-result', {
                    isCorrect: result.isCorrect,
                    points: result.points,
                    totalScore: result.totalScore
                });

                // Broadcast answer count to room
                const playersAnswered = gameManager.getPlayersAnsweredCount(room.code);
                io.to(room.code).emit('game:player-answered', {
                    playersAnswered,
                    totalPlayers: room.players.size
                });

                // Check if all players have answered
                if (gameManager.allPlayersAnswered(room.code)) {
                    const question = gameManager.getCurrentQuestion(room.code);
                    const correctOption = question.answer_options.find(opt => opt.is_correct);
                    const leaderboard = gameManager.getLeaderboard(room.code);

                    io.to(room.code).emit('game:times-up', {
                        correctAnswerId: correctOption?.id,
                        correctAnswerText: correctOption?.option_text,
                        leaderboard,
                        playersAnswered,
                        totalPlayers: room.players.size
                    });
                }

                console.log(`Player ${socket.id} answered in room ${room.code}`);

            } catch (error) {
                console.error('Error submitting answer:', error);
                socket.emit('error', { message: 'Failed to submit answer' });
            }
        });

        /**
         * Player leaves the room
         */
        socket.on('player:leave', () => {
            removePlayerImmediately(socket);
        });

        // ===========================
        // DISCONNECT HANDLING
        // ===========================

        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
            handlePlayerDisconnect(socket);
            handleHostDisconnect(socket);
        });

        /**
         * Handle player disconnect
         */
        function handlePlayerDisconnect(socket) {
            try {
                const room = gameManager.getRoomByPlayer(socket.id);

                if (room) {
                    const player = gameManager.getPlayer(socket.id);
                    const playerName = player ? player.name : 'Unknown';
                    const playerId = player ? player.id : null;

                    if (!playerId) {
                        gameManager.removePlayer(socket.id);
                        socket.leave(room.code);
                        return;
                    }

                    if (playerDisconnectTimers.has(playerId)) {
                        return;
                    }

                    const disconnectTimer = setTimeout(() => {
                        const removed = gameManager.removePlayerById(playerId);
                        if (!removed) {
                            return;
                        }

                        const players = gameManager.getPlayers(room.code);
                        io.to(room.code).emit('room:player-left', {
                            playerName,
                            playerCount: players.length,
                            players: players.map(p => ({
                                name: p.name,
                                id: p.socketId
                            }))
                        });

                        console.log(`Player ${playerName} left room ${room.code}`);
                        playerDisconnectTimers.delete(playerId);
                    }, 10000);

                    playerDisconnectTimers.set(playerId, disconnectTimer);
                }
            } catch (error) {
                console.error('Error handling player disconnect:', error);
            }
        }

        function removePlayerImmediately(socket) {
            try {
                const room = gameManager.getRoomByPlayer(socket.id);

                if (!room) {
                    return;
                }

                const player = gameManager.getPlayer(socket.id);
                const playerName = player ? player.name : 'Unknown';
                const playerId = player ? player.id : null;

                if (playerId && playerDisconnectTimers.has(playerId)) {
                    clearTimeout(playerDisconnectTimers.get(playerId));
                    playerDisconnectTimers.delete(playerId);
                }

                gameManager.removePlayer(socket.id);
                socket.leave(room.code);

                const players = gameManager.getPlayers(room.code);
                io.to(room.code).emit('room:player-left', {
                    playerName,
                    playerCount: players.length,
                    players: players.map(p => ({
                        name: p.name,
                        id: p.socketId
                    }))
                });

                console.log(`Player ${playerName} left room ${room.code}`);
            } catch (error) {
                console.error('Error removing player:', error);
            }
        }

        /**
         * Handle host disconnect
         */
        function handleHostDisconnect(socket) {
            try {
                const room = gameManager.getRoomByHost(socket.id);

                if (room) {
                    if (hostDisconnectTimers.has(room.code)) {
                        return;
                    }

                    room.hostDisconnectedAt = Date.now();

                    const disconnectTimer = setTimeout(() => {
                        const currentRoom = gameManager.getRoom(room.code);
                        if (!currentRoom || currentRoom.hostSocketId !== socket.id) {
                            hostDisconnectTimers.delete(room.code);
                            return;
                        }

                        io.to(room.code).emit('room:host-disconnect', {
                            message: 'Host has disconnected. Game ended.'
                        });

                        gameManager.deleteRoom(room.code);
                        hostDisconnectTimers.delete(room.code);

                        console.log(`Host disconnected, room ${room.code} deleted`);
                    }, 10000);

                    hostDisconnectTimers.set(room.code, disconnectTimer);
                }
            } catch (error) {
                console.error('Error handling host disconnect:', error);
            }
        }
    });

    return gameManager;
}

module.exports = { initializeSocketEvents };
