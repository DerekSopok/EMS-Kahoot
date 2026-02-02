const test = require('node:test');
const assert = require('node:assert/strict');

const {
    validateDisplayName,
    validateRoomCode,
    validateAnswerId,
    validateResponseTime
} = require('../src/utils/validation');

test('rejects empty display names', () => {
    assert.equal(validateDisplayName(''), false);
});

test('rejects too-long display names', () => {
    assert.equal(validateDisplayName('a'.repeat(51)), false);
});

test('accepts valid display names', () => {
    assert.equal(validateDisplayName('Player1'), true);
});

test('validates room code format', () => {
    assert.equal(validateRoomCode('ABC123'), true);
    assert.equal(validateRoomCode('abc123'), true);
    assert.equal(validateRoomCode('ABC12'), false);
    assert.equal(validateRoomCode('ABC1234'), false);
    assert.equal(validateRoomCode('AB@123'), false);
});

test('validates answer ids against question options', () => {
    const question = {
        answer_options: [
            { id: 1, option_text: 'A' },
            { id: 2, option_text: 'B' }
        ]
    };

    assert.equal(validateAnswerId(1, question), true);
    assert.equal(validateAnswerId(3, question), false);
    assert.equal(validateAnswerId('1', question), false);
});

test('validates response time bounds', () => {
    assert.equal(validateResponseTime(5000, 20), true);
    assert.equal(validateResponseTime(-1, 20), false);
    assert.equal(validateResponseTime(200000, 20), false);
});
