const test = require('node:test');
const assert = require('node:assert/strict');

const GameManager = require('../src/socket/gameManager');

test('removes player from playersAnswered on disconnect', () => {
    const gameManager = new GameManager();
    const room = gameManager.createRoom('host-socket', 1, [
        {
            id: 1,
            question_text: 'Question?',
            time_limit: 20,
            points: 1000,
            answer_options: [
                { id: 1, option_text: 'A', is_correct: true, order_index: 1 }
            ]
        }
    ]);

    const player = gameManager.addPlayer(room.code, 'player-socket', 'Player');
    assert.ok(player);

    gameManager.startGame(room.code);
    const submitResult = gameManager.submitAnswer('player-socket', 1, 1000);
    assert.ok(submitResult);
    assert.equal(room.playersAnswered.size, 1);

    const removed = gameManager.removePlayer('player-socket');
    assert.equal(removed, true);
    assert.equal(room.playersAnswered.size, 0);
    assert.equal(gameManager.allPlayersAnswered(room.code), false);
});
