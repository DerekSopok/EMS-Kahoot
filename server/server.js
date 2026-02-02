//Import dependencies
require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');

//Import Socket.IO event handlers
const { initializeSocketEvents } = require('../src/socket/events');

//Import services
const quizService = require('../src/services/quizService');
const adminAuth = require('../src/middleware/adminAuth');
const { CATEGORIES, validateQuiz, validateQuestion } = require('../src/utils/quizValidation');


const publicPath = path.join(__dirname, '../public');
var app = express();
var server = http.createServer(app);
var io = socketIO(server);

app.use(express.static(publicPath));
app.use(express.json());

app.use('/api/admin', adminAuth);

function buildValidationErrorResponse(errors) {
    return { error: 'Validation failed', details: errors };
}

function sanitizeAnswerOptions(answerOptions) {
    if (!Array.isArray(answerOptions)) {
        return answerOptions;
    }

    return answerOptions.map(option => ({
        option_text: typeof option.option_text === 'string' ? option.option_text.trim() : option.option_text,
        is_correct: Boolean(option.is_correct)
    }));
}

// API Routes
// Get all quizzes (using JSON file storage)
app.get('/api/quizzes', async (req, res) => {
    try {
        const quizzes = await quizService.loadQuizzes();
        // Filter to only public quizzes and add question_count
        const publicQuizzes = quizzes
            .filter(q => q.is_public !== false)
            .map(q => ({
                id: q.id,
                title: q.title,
                description: q.description || '',
                category: q.category || 'Other',
                created_at: q.created_at,
                question_count: q.questions ? q.questions.length : 0
            }));
        res.json(publicQuizzes);
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        res.status(500).json({ error: 'Failed to fetch quizzes' });
    }
});

// Get a specific quiz with questions (using JSON file storage)
app.get('/api/quizzes/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const quiz = await quizService.getQuizById(id);

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        res.json(quiz);
    } catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).json({ error: 'Failed to fetch quiz' });
    }
});

// Quiz Management API (JSON file based)
// Get all quizzes from JSON file
app.get('/api/admin/quizzes', async (req, res) => {
    try {
        const quizzes = await quizService.loadQuizzes();
        const summary = quizzes.map(quiz => ({
            id: quiz.id,
            title: quiz.title,
            description: quiz.description || '',
            category: quiz.category || 'General',
            questionCount: quiz.questions ? quiz.questions.length : 0,
            createdAt: quiz.created_at
        }));
        res.json(summary);
    } catch (error) {
        console.error('Error loading quizzes:', error);
        res.status(500).json({ error: 'Failed to load quizzes' });
    }
});

// Get a single quiz by ID from JSON file
app.get('/api/admin/quizzes/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const quiz = await quizService.getQuizById(id);

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        res.json(quiz);
    } catch (error) {
        console.error('Error loading quiz:', error);
        res.status(500).json({ error: 'Failed to load quiz' });
    }
});

// Create a new quiz
app.post('/api/admin/quizzes', async (req, res) => {
    try {
        const quizInput = {
            title: typeof req.body.title === 'string' ? req.body.title.trim() : req.body.title,
            description: typeof req.body.description === 'string' ? req.body.description.trim() : req.body.description,
            category: typeof req.body.category === 'string' ? req.body.category : req.body.category
        };
        const { valid, errors } = validateQuiz(quizInput);
        if (!valid) {
            return res.status(400).json(buildValidationErrorResponse(errors));
        }

        const newQuiz = await quizService.createQuiz({
            title: quizInput.title,
            description: quizInput.description || '',
            category: quizInput.category || 'General',
            is_public: req.body.is_public !== false
        });

        res.status(201).json(newQuiz);
    } catch (error) {
        console.error('Error creating quiz:', error);
        res.status(500).json({ error: 'Failed to create quiz' });
    }
});

// Update a quiz
app.put('/api/admin/quizzes/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existingQuiz = await quizService.getQuizById(id);

        if (!existingQuiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        const updates = {};
        if (req.body.title !== undefined) {
            updates.title = typeof req.body.title === 'string' ? req.body.title.trim() : req.body.title;
        }
        if (req.body.description !== undefined) {
            updates.description = typeof req.body.description === 'string' ? req.body.description.trim() : req.body.description;
        }
        if (req.body.category !== undefined) {
            updates.category = typeof req.body.category === 'string' ? req.body.category : req.body.category;
        }

        const mergedQuiz = {
            title: updates.title !== undefined ? updates.title : existingQuiz.title,
            description: updates.description !== undefined ? updates.description : existingQuiz.description,
            category: updates.category !== undefined ? updates.category : existingQuiz.category
        };
        const { valid, errors } = validateQuiz(mergedQuiz);
        if (!valid) {
            return res.status(400).json(buildValidationErrorResponse(errors));
        }

        const updatedQuiz = await quizService.updateQuiz(id, updates);
        res.json(updatedQuiz);
    } catch (error) {
        if (error.message === 'Quiz not found') {
            return res.status(404).json({ error: error.message });
        }
        console.error('Error updating quiz:', error);
        res.status(500).json({ error: 'Failed to update quiz' });
    }
});

// Delete a quiz
app.delete('/api/admin/quizzes/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await quizService.deleteQuiz(id);
        res.json({ success: true });
    } catch (error) {
        if (error.message === 'Quiz not found') {
            return res.status(404).json({ error: error.message });
        }
        console.error('Error deleting quiz:', error);
        res.status(500).json({ error: 'Failed to delete quiz' });
    }
});

// Add a question to a quiz
app.post('/api/admin/quizzes/:id/questions', async (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        const questionInput = {
            question_text: typeof req.body.question_text === 'string' ? req.body.question_text.trim() : req.body.question_text,
            time_limit: req.body.time_limit,
            points: req.body.points,
            answer_options: sanitizeAnswerOptions(req.body.answer_options)
        };
        const { valid, errors } = validateQuestion(questionInput);
        if (!valid) {
            return res.status(400).json(buildValidationErrorResponse(errors));
        }

        const newQuestion = await quizService.addQuestion(quizId, questionInput);
        res.status(201).json(newQuestion);
    } catch (error) {
        if (error.message === 'Quiz not found') {
            return res.status(404).json({ error: error.message });
        }
        console.error('Error adding question:', error);
        res.status(500).json({ error: 'Failed to add question' });
    }
});

// Update a question
app.put('/api/admin/quizzes/:quizId/questions/:questionId', async (req, res) => {
    try {
        const quizId = parseInt(req.params.quizId);
        const questionId = parseInt(req.params.questionId);
        const quiz = await quizService.getQuizById(quizId);

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        const existingQuestion = quiz.questions?.find(question => question.id === questionId);
        if (!existingQuestion) {
            return res.status(404).json({ error: 'Question not found' });
        }

        const updates = {};
        if (req.body.question_text !== undefined) {
            updates.question_text = typeof req.body.question_text === 'string' ? req.body.question_text.trim() : req.body.question_text;
        }
        if (req.body.time_limit !== undefined) {
            updates.time_limit = req.body.time_limit;
        }
        if (req.body.points !== undefined) {
            updates.points = req.body.points;
        }
        if (req.body.answer_options !== undefined) {
            updates.answer_options = sanitizeAnswerOptions(req.body.answer_options);
        }

        const mergedQuestion = {
            question_text: updates.question_text !== undefined ? updates.question_text : existingQuestion.question_text,
            time_limit: updates.time_limit !== undefined ? updates.time_limit : existingQuestion.time_limit,
            points: updates.points !== undefined ? updates.points : existingQuestion.points,
            answer_options: updates.answer_options !== undefined ? updates.answer_options : existingQuestion.answer_options
        };
        const { valid, errors } = validateQuestion(mergedQuestion);
        if (!valid) {
            return res.status(400).json(buildValidationErrorResponse(errors));
        }

        const updatedQuestion = await quizService.updateQuestion(quizId, questionId, updates);
        res.json(updatedQuestion);
    } catch (error) {
        if (error.message === 'Quiz not found' || error.message === 'Question not found') {
            return res.status(404).json({ error: error.message });
        }
        console.error('Error updating question:', error);
        res.status(500).json({ error: 'Failed to update question' });
    }
});

// Delete a question
app.delete('/api/admin/quizzes/:quizId/questions/:questionId', async (req, res) => {
    try {
        const quizId = parseInt(req.params.quizId);
        const questionId = parseInt(req.params.questionId);

        await quizService.deleteQuestion(quizId, questionId);
        res.json({ success: true });
    } catch (error) {
        if (error.message === 'Quiz not found' || error.message === 'Question not found') {
            return res.status(404).json({ error: error.message });
        }
        console.error('Error deleting question:', error);
        res.status(500).json({ error: 'Failed to delete question' });
    }
});

// Reorder questions
app.put('/api/admin/quizzes/:id/questions/reorder', async (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        const quiz = await quizService.getQuizById(quizId);

        if (!req.body.questionIds || !Array.isArray(req.body.questionIds)) {
            return res.status(400).json({ error: 'Must provide questionIds array' });
        }

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        const questionIds = req.body.questionIds.map(id => parseInt(id));
        const uniqueIds = new Set(questionIds);
        const quizQuestionIds = new Set((quiz.questions || []).map(question => question.id));
        if (questionIds.length !== uniqueIds.size || questionIds.length !== quizQuestionIds.size) {
            return res.status(400).json({ error: 'questionIds must include each question exactly once' });
        }

        for (const id of uniqueIds) {
            if (!quizQuestionIds.has(id)) {
                return res.status(400).json({ error: 'questionIds must match existing quiz questions' });
            }
        }

        const reorderedQuestions = await quizService.reorderQuestions(quizId, questionIds);
        res.json(reorderedQuestions);
    } catch (error) {
        if (error.message === 'Quiz not found' || error.message.startsWith('Question not found')) {
            return res.status(404).json({ error: error.message });
        }
        console.error('Error reordering questions:', error);
        res.status(500).json({ error: 'Failed to reorder questions' });
    }
});

app.get('/api/admin/categories', (req, res) => {
    res.json(CATEGORIES);
});

//Starting server on port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

// Initialize new Socket.IO event handlers with JSON file storage
initializeSocketEvents(io);

console.log('EMS Kahoot game engine initialized');
console.log('- Socket.IO events configured');
console.log('- JSON file storage enabled');
console.log('- Max players per room: 20');
