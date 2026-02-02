const fs = require('fs').promises;
const path = require('path');
const githubService = require('./githubService');

class QuizService {
    constructor() {
        this.filePath = path.join(__dirname, '../../db/seeds/quizzes.json');
    }

    /**
     * Quiz storage shape (db/seeds/quizzes.json):
     * {
     *   id, title, description, category, is_public, created_at?, updated_at?,
     *   questions: [{
     *     id, question_text, question_type, time_limit, points, order_index, image_url?,
     *     answer_options: [{ id?, option_text, is_correct, order_index }]
     *   }]
     * }
     *
     * Socket/gameplay uses the same quiz/question/answer fields, but requires
     * stable option IDs and order indices for gameplay selection. See
     * formatQuestionsForGame for the normalization used by socket events.
     */

    async saveQuizzes(quizzesData, action = 'update', quizTitle = '') {
        // Save to local file
        await fs.writeFile(
            this.filePath,
            JSON.stringify(quizzesData, null, 2),
            'utf-8'
        );

        // Auto-commit to GitHub (async, non-blocking)
        const commitMessage = githubService.generateCommitMessage(action, quizTitle);
        githubService.commitQuizzesFile(quizzesData, commitMessage)
            .catch(err => console.error('Background GitHub commit failed:', err));

        return quizzesData;
    }

    async loadQuizzes() {
        try {
            const data = await fs.readFile(this.filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            // If file doesn't exist, return empty array
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    async getQuizById(id) {
        const quizzes = await this.loadQuizzes();
        return quizzes.find(q => q.id === id);
    }

    /**
     * Normalize quiz questions to the format expected by GameManager/socket events.
     * This keeps gameplay selection stable without altering stored quiz data.
     */
    formatQuestionsForGame(quiz) {
        const questions = quiz?.questions || [];

        return questions.map((q, index) => ({
            id: q.id,
            question_text: q.question_text,
            time_limit: q.time_limit || 20,
            points: q.points || 1000,
            order_index: q.order_index || index + 1,
            answer_options: (q.answer_options || []).map((opt, optIndex) => ({
                id: opt.id || optIndex + 1,
                option_text: opt.option_text,
                is_correct: opt.is_correct,
                order_index: opt.order_index || optIndex + 1
            }))
        }));
    }

    async createQuiz(quizData) {
        const quizzes = await this.loadQuizzes();

        // Generate new ID
        const newId = quizzes.length > 0
            ? Math.max(...quizzes.map(q => q.id || 0)) + 1
            : 1;

        const newQuiz = {
            id: newId,
            title: quizData.title,
            description: quizData.description || '',
            category: quizData.category || 'Other',
            is_public: quizData.is_public !== false,
            created_at: new Date().toISOString(),
            questions: []
        };

        quizzes.push(newQuiz);
        await this.saveQuizzes(quizzes, 'create', newQuiz.title);

        return newQuiz;
    }

    async updateQuiz(id, quizData) {
        const quizzes = await this.loadQuizzes();
        const index = quizzes.findIndex(q => q.id === id);

        if (index === -1) {
            throw new Error('Quiz not found');
        }

        // Update quiz metadata only (not questions)
        quizzes[index] = {
            ...quizzes[index],
            title: quizData.title || quizzes[index].title,
            description: quizData.description !== undefined ? quizData.description : quizzes[index].description,
            category: quizData.category || quizzes[index].category,
            is_public: quizData.is_public !== undefined ? quizData.is_public : quizzes[index].is_public,
            updated_at: new Date().toISOString()
        };

        await this.saveQuizzes(quizzes, 'update', quizzes[index].title);

        return quizzes[index];
    }

    async deleteQuiz(id) {
        const quizzes = await this.loadQuizzes();
        const index = quizzes.findIndex(q => q.id === id);

        if (index === -1) {
            throw new Error('Quiz not found');
        }

        const deletedQuiz = quizzes[index];
        quizzes.splice(index, 1);

        await this.saveQuizzes(quizzes, 'delete', deletedQuiz.title);

        return deletedQuiz;
    }

    async addQuestion(quizId, questionData) {
        const quizzes = await this.loadQuizzes();
        const quiz = quizzes.find(q => q.id === quizId);

        if (!quiz) {
            throw new Error('Quiz not found');
        }

        if (!quiz.questions) {
            quiz.questions = [];
        }

        // Generate new question ID
        const newQuestionId = quiz.questions.length > 0
            ? Math.max(...quiz.questions.map(q => q.id || 0)) + 1
            : 1;

        const newQuestion = {
            id: newQuestionId,
            question_text: questionData.question_text,
            question_type: questionData.question_type || 'multiple_choice',
            time_limit: questionData.time_limit || 20,
            points: questionData.points || 1000,
            order_index: questionData.order_index || quiz.questions.length + 1,
            image_url: questionData.image_url || null,
            answer_options: questionData.answer_options || []
        };

        quiz.questions.push(newQuestion);

        await this.saveQuizzes(quizzes, 'update', quiz.title);

        return newQuestion;
    }

    async updateQuestion(quizId, questionId, questionData) {
        const quizzes = await this.loadQuizzes();
        const quiz = quizzes.find(q => q.id === quizId);

        if (!quiz) {
            throw new Error('Quiz not found');
        }

        const questionIndex = quiz.questions.findIndex(q => q.id === questionId);

        if (questionIndex === -1) {
            throw new Error('Question not found');
        }

        quiz.questions[questionIndex] = {
            ...quiz.questions[questionIndex],
            question_text: questionData.question_text || quiz.questions[questionIndex].question_text,
            time_limit: questionData.time_limit || quiz.questions[questionIndex].time_limit,
            points: questionData.points || quiz.questions[questionIndex].points,
            order_index: questionData.order_index !== undefined ? questionData.order_index : quiz.questions[questionIndex].order_index,
            image_url: questionData.image_url !== undefined ? questionData.image_url : quiz.questions[questionIndex].image_url,
            answer_options: questionData.answer_options || quiz.questions[questionIndex].answer_options
        };

        await this.saveQuizzes(quizzes, 'update', quiz.title);

        return quiz.questions[questionIndex];
    }

    async deleteQuestion(quizId, questionId) {
        const quizzes = await this.loadQuizzes();
        const quiz = quizzes.find(q => q.id === quizId);

        if (!quiz) {
            throw new Error('Quiz not found');
        }

        const questionIndex = quiz.questions.findIndex(q => q.id === questionId);

        if (questionIndex === -1) {
            throw new Error('Question not found');
        }

        const deletedQuestion = quiz.questions[questionIndex];
        quiz.questions.splice(questionIndex, 1);

        // Reorder remaining questions
        quiz.questions.forEach((q, idx) => {
            q.order_index = idx + 1;
        });

        await this.saveQuizzes(quizzes, 'update', quiz.title);

        return deletedQuestion;
    }

    async reorderQuestions(quizId, questionIds) {
        const quizzes = await this.loadQuizzes();
        const quiz = quizzes.find(q => q.id === quizId);

        if (!quiz) {
            throw new Error('Quiz not found');
        }

        // Create a map of question id to question
        const questionMap = {};
        quiz.questions.forEach(q => {
            questionMap[q.id] = q;
        });

        // Reorder questions based on the provided order
        quiz.questions = questionIds.map((id, index) => {
            const question = questionMap[id];
            if (!question) {
                throw new Error('Question not found: ' + id);
            }
            question.order_index = index + 1;
            return question;
        });

        await this.saveQuizzes(quizzes, 'update', quiz.title);

        return quiz.questions;
    }
}

module.exports = new QuizService();
