const CATEGORIES = [
    'Airway Management',
    'Cardiac Emergencies',
    'Trauma',
    'Pharmacology',
    'Medical Emergencies',
    'Pediatrics',
    'OB/GYN',
    'Operations',
    'General'
];

function validateQuiz(quiz) {
    const errors = [];

    if (!quiz.title || quiz.title.length < 1 || quiz.title.length > 200) {
        errors.push('Title must be 1-200 characters');
    }

    if (quiz.description && quiz.description.length > 1000) {
        errors.push('Description must be under 1000 characters');
    }

    if (quiz.category && !CATEGORIES.includes(quiz.category)) {
        errors.push('Invalid category');
    }

    return { valid: errors.length === 0, errors };
}

function validateQuestion(question) {
    const errors = [];

    if (!question.question_text || question.question_text.length < 1) {
        errors.push('Question text is required');
    }

    if (!question.answer_options || question.answer_options.length < 2) {
        errors.push('At least 2 answer options required');
    }

    if (question.answer_options && question.answer_options.length > 6) {
        errors.push('Maximum 6 answer options');
    }

    if (question.answer_options) {
        const correctCount = question.answer_options.filter(option => option.is_correct).length;
        if (correctCount !== 1) {
            errors.push('Exactly one correct answer required');
        }
    }

    if (question.time_limit && (question.time_limit < 5 || question.time_limit > 120)) {
        errors.push('Time limit must be 5-120 seconds');
    }

    if (question.image_url !== undefined && question.image_url !== null) {
        if (typeof question.image_url !== 'string' || question.image_url.length > 500) {
            errors.push('Image URL must be a string under 500 characters');
        }
    }

    return { valid: errors.length === 0, errors };
}

module.exports = {
    CATEGORIES,
    validateQuiz,
    validateQuestion
};
