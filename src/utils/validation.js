const LIMITS = {
    DISPLAY_NAME_MAX: 50,
    ROOM_CODE_LENGTH: 6,
    RESPONSE_TIME_MAX: 120000
};

function validateDisplayName(name) {
    if (!name || typeof name !== 'string') {
        return false;
    }

    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > LIMITS.DISPLAY_NAME_MAX) {
        return false;
    }

    return true;
}

function validateRoomCode(code) {
    if (!code || typeof code !== 'string') {
        return false;
    }

    const normalized = code.trim().toUpperCase();
    if (normalized.length !== LIMITS.ROOM_CODE_LENGTH) {
        return false;
    }

    return /^[A-Z0-9]+$/.test(normalized);
}

function validateAnswerId(answerId, question) {
    if (!Number.isInteger(answerId)) {
        return false;
    }

    if (!question || !Array.isArray(question.answer_options)) {
        return false;
    }

    const validIds = question.answer_options.map(opt => opt.id);
    return validIds.includes(answerId);
}

function validateResponseTime(time, timeLimitSeconds) {
    if (!Number.isFinite(time)) {
        return false;
    }

    if (!Number.isFinite(timeLimitSeconds)) {
        return false;
    }

    const maxAllowed = Math.min(timeLimitSeconds * 1000, LIMITS.RESPONSE_TIME_MAX);
    if (time < 0 || time > maxAllowed) {
        return false;
    }

    return true;
}

module.exports = {
    validateDisplayName,
    validateRoomCode,
    validateAnswerId,
    validateResponseTime,
    LIMITS
};
