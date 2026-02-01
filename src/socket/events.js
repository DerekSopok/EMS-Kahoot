/**
 * EMS Kahoot - Socket.IO Event Handlers
 *
 * Handles all real-time events for multiplayer quiz gameplay.
 * Supports up to 20 players per room.
 */

const GameManager = require('./gameManager');

/**
 * Initialize Socket.IO event handlers
 * @param {Object} io - Socket.IO server instance
 * @param {Object} db - PostgreSQL database pool
 */
function initializeSocketEvents(io, db) {
    const gameManager = new GameManager();

    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);

        // ===========================
        // HOST EVENTS
        // ===========================

        /**
         * Host creates a new room
         * Expects: { quizId: number }
         * Emits: { success: boolean, roomCode: string, error?: string }
         */
        socket.on('host:create-room', async (data) => {
            try {
                const { quizId } = data;

                // Fetch quiz and questions from database
                const quizQuery = `
                    SELECT q.*,
                           json_agg(
                               json_build_object(
                                   'id', qu.id,
                                   'question_text', qu.question_text,
                                   'time_limit', qu.time_limit,
                                   'points', qu.points,
                                   'order_index', qu.order_index,
                                   'answer_options', (
                                       SELECT json_agg(
                                           json_build_object(
                                               'id', ao.id,
                                               'option_text', ao.option_text,
                                               'is_correct', ao.is_correct,
                                               'order_index', ao.order_index
                                           ) ORDER BY ao.order_index
                                       )
                                       FROM answer_options ao
                                       WHERE ao.question_id = qu.id
                                   )
                               ) ORDER BY qu.order_index
                           ) as questions
                    FROM quizzes q
                    LEFT JOIN questions qu ON q.id = qu.quiz_id
                    WHERE q.id = $1
                    GROUP BY q.id
                `;

                const result = await db.query(quizQuery, [quizId]);

                if (result.rows.length === 0) {
                    socket.emit('host:create-room', {
                        success: false,
                        error: 'Quiz not found'
                    });
                    return;
                }

                const quiz = result.rows[0];
                const questions = quiz.questions;

                if (!questions || questions.length === 0) {
                    socket.emit('host:create-room', {
                        success: false,
                        error: 'Quiz has no questions'
                    });
                    return;
                }

                // Create room
                const room = gameManager.createRoom(socket.id, quizId, questions);

                // Join the room
                socket.join(room.code);

                console.log(`Room created: ${room.code} by host ${socket.id}`);

                socket.emit('host:create-room', {
                    success: true,
                    roomCode: room.code,
                    quizTitle: quiz.title,
                    questionCount: questions.length
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
         * Player joins a room
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
                    playerName: displayName
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
            handlePlayerDisconnect(socket);
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

                    gameManager.removePlayer(socket.id);
                    socket.leave(room.code);

                    // Broadcast to room
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
                }
            } catch (error) {
                console.error('Error handling player disconnect:', error);
            }
        }

        /**
         * Handle host disconnect
         */
        function handleHostDisconnect(socket) {
            try {
                const room = gameManager.getRoomByHost(socket.id);

                if (room) {
                    // Notify all players that host disconnected
                    io.to(room.code).emit('room:host-disconnect', {
                        message: 'Host has disconnected. Game ended.'
                    });

                    // Clean up room
                    gameManager.deleteRoom(room.code);

                    console.log(`Host disconnected, room ${room.code} deleted`);
                }
            } catch (error) {
                console.error('Error handling host disconnect:', error);
            }
        }
    });

    return gameManager;
}

module.exports = { initializeSocketEvents };
