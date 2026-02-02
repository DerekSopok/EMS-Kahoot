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


const publicPath = path.join(__dirname, '../public');
var app = express();
var server = http.createServer(app);
var io = socketIO(server);

app.use(express.static(publicPath));
app.use(express.json());

app.use('/api/admin', adminAuth);

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
        res.json(quizzes);
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
        // Validate required fields
        if (!req.body.title || req.body.title.trim().length < 3) {
            return res.status(400).json({ error: 'Title must be at least 3 characters' });
        }

        if (req.body.title.length > 200) {
            return res.status(400).json({ error: 'Title must not exceed 200 characters' });
        }

        const newQuiz = await quizService.createQuiz({
            title: req.body.title.trim(),
            description: req.body.description || '',
            category: req.body.category || 'Other',
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

        // Validate required fields
        if (req.body.title && req.body.title.trim().length < 3) {
            return res.status(400).json({ error: 'Title must be at least 3 characters' });
        }

        if (req.body.title && req.body.title.length > 200) {
            return res.status(400).json({ error: 'Title must not exceed 200 characters' });
        }

        const updatedQuiz = await quizService.updateQuiz(id, req.body);
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
        const deletedQuiz = await quizService.deleteQuiz(id);
        res.json(deletedQuiz);
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

        // Validate question text
        if (!req.body.question_text || req.body.question_text.trim().length < 10) {
            return res.status(400).json({ error: 'Question must be at least 10 characters' });
        }

        if (req.body.question_text.length > 500) {
            return res.status(400).json({ error: 'Question must not exceed 500 characters' });
        }

        // Validate time limit
        const timeLimit = req.body.time_limit || 20;
        if (timeLimit < 10 || timeLimit > 60) {
            return res.status(400).json({ error: 'Time limit must be between 10 and 60 seconds' });
        }

        // Validate points
        const points = req.body.points || 1000;
        if (points < 100 || points > 2000) {
            return res.status(400).json({ error: 'Points must be between 100 and 2000' });
        }

        // Validate answer options
        if (!req.body.answer_options || req.body.answer_options.length !== 4) {
            return res.status(400).json({ error: 'Must provide exactly 4 answer options' });
        }

        const correctCount = req.body.answer_options.filter(a => a.is_correct).length;
        if (correctCount !== 1) {
            return res.status(400).json({ error: 'Must have exactly 1 correct answer' });
        }

        const newQuestion = await quizService.addQuestion(quizId, req.body);
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

        // Validate question text if provided
        if (req.body.question_text && req.body.question_text.trim().length < 10) {
            return res.status(400).json({ error: 'Question must be at least 10 characters' });
        }

        if (req.body.question_text && req.body.question_text.length > 500) {
            return res.status(400).json({ error: 'Question must not exceed 500 characters' });
        }

        // Validate time limit if provided
        if (req.body.time_limit && (req.body.time_limit < 10 || req.body.time_limit > 60)) {
            return res.status(400).json({ error: 'Time limit must be between 10 and 60 seconds' });
        }

        // Validate points if provided
        if (req.body.points && (req.body.points < 100 || req.body.points > 2000)) {
            return res.status(400).json({ error: 'Points must be between 100 and 2000' });
        }

        // Validate answer options if provided
        if (req.body.answer_options) {
            if (req.body.answer_options.length !== 4) {
                return res.status(400).json({ error: 'Must provide exactly 4 answer options' });
            }

            const correctCount = req.body.answer_options.filter(a => a.is_correct).length;
            if (correctCount !== 1) {
                return res.status(400).json({ error: 'Must have exactly 1 correct answer' });
            }
        }

        const updatedQuestion = await quizService.updateQuestion(quizId, questionId, req.body);
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

        const deletedQuestion = await quizService.deleteQuestion(quizId, questionId);
        res.json(deletedQuestion);
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

        if (!req.body.questionIds || !Array.isArray(req.body.questionIds)) {
            return res.status(400).json({ error: 'Must provide questionIds array' });
        }

        const reorderedQuestions = await quizService.reorderQuestions(quizId, req.body.questionIds);
        res.json(reorderedQuestions);
    } catch (error) {
        if (error.message === 'Quiz not found' || error.message.startsWith('Question not found')) {
            return res.status(404).json({ error: error.message });
        }
        console.error('Error reordering questions:', error);
        res.status(500).json({ error: 'Failed to reorder questions' });
    }
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
