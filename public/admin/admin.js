// Admin page functionality
let quizzes = [];
let currentQuiz = null;

// DOM elements
const quizzesContainer = document.getElementById('quizzesContainer');
const createQuizBtn = document.getElementById('createQuizBtn');
const quizModal = document.getElementById('quizModal');
const quizForm = document.getElementById('quizForm');
const modalTitle = document.getElementById('modalTitle');
const closeBtn = document.querySelector('.close');
const cancelBtn = document.getElementById('cancelBtn');
const categoryFilter = document.getElementById('categoryFilter');
const searchInput = document.getElementById('searchInput');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadQuizzes();
    setupEventListeners();
});

// Event listeners
function setupEventListeners() {
    createQuizBtn.addEventListener('click', () => openQuizModal());
    closeBtn.addEventListener('click', closeQuizModal);
    cancelBtn.addEventListener('click', closeQuizModal);
    quizForm.addEventListener('submit', handleQuizSubmit);
    categoryFilter.addEventListener('change', filterQuizzes);
    searchInput.addEventListener('input', filterQuizzes);

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === quizModal) {
            closeQuizModal();
        }
    });
}

// Load all quizzes
async function loadQuizzes() {
    try {
        const response = await fetch('/api/admin/quizzes');
        if (!response.ok) throw new Error('Failed to load quizzes');

        quizzes = await response.json();
        displayQuizzes(quizzes);
    } catch (error) {
        console.error('Error loading quizzes:', error);
        quizzesContainer.innerHTML = '<div class="loading">Error loading quizzes. Please refresh the page.</div>';
    }
}

// Display quizzes
function displayQuizzes(quizzesToShow) {
    if (quizzesToShow.length === 0) {
        quizzesContainer.innerHTML = `
            <div class="empty-state">
                <h3>No quizzes found</h3>
                <p>Create your first quiz to get started!</p>
                <button class="btn btn-primary" onclick="openQuizModal()">Create New Quiz</button>
            </div>
        `;
        return;
    }

    quizzesContainer.innerHTML = quizzesToShow.map(quiz => `
        <div class="quiz-card" data-id="${quiz.id}">
            <div class="quiz-header">
                <h3 class="quiz-title">${escapeHtml(quiz.title)}</h3>
                <span class="quiz-category">${escapeHtml(quiz.category)}</span>
            </div>
            <p class="quiz-description">${escapeHtml(quiz.description) || 'No description'}</p>
            <div class="quiz-stats">
                <span>📝 ${quiz.questions ? quiz.questions.length : 0} questions</span>
                <span>${quiz.is_public ? '🌐 Public' : '🔒 Private'}</span>
            </div>
            <div class="quiz-actions">
                <button class="btn btn-sm btn-primary" onclick="editQuiz(${quiz.id})">Edit</button>
                <button class="btn btn-sm btn-success" onclick="manageQuestions(${quiz.id})">Questions</button>
                <button class="btn btn-sm btn-danger" onclick="deleteQuiz(${quiz.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// Filter quizzes
function filterQuizzes() {
    const category = categoryFilter.value;
    const searchTerm = searchInput.value.toLowerCase();

    let filtered = quizzes;

    if (category) {
        filtered = filtered.filter(q => q.category === category);
    }

    if (searchTerm) {
        filtered = filtered.filter(q =>
            q.title.toLowerCase().includes(searchTerm) ||
            (q.description && q.description.toLowerCase().includes(searchTerm))
        );
    }

    displayQuizzes(filtered);
}

// Open quiz modal
function openQuizModal(quiz = null) {
    currentQuiz = quiz;

    if (quiz) {
        modalTitle.textContent = 'Edit Quiz';
        document.getElementById('quizId').value = quiz.id;
        document.getElementById('quizTitle').value = quiz.title;
        document.getElementById('quizDescription').value = quiz.description || '';
        document.getElementById('quizCategory').value = quiz.category;
        document.getElementById('quizPublic').checked = quiz.is_public;
    } else {
        modalTitle.textContent = 'Create New Quiz';
        quizForm.reset();
        document.getElementById('quizId').value = '';
    }

    quizModal.classList.add('show');
}

// Close quiz modal
function closeQuizModal() {
    quizModal.classList.remove('show');
    quizForm.reset();
    currentQuiz = null;
}

// Handle quiz form submission
async function handleQuizSubmit(e) {
    e.preventDefault();

    const quizId = document.getElementById('quizId').value;
    const quizData = {
        title: document.getElementById('quizTitle').value.trim(),
        description: document.getElementById('quizDescription').value.trim(),
        category: document.getElementById('quizCategory').value,
        is_public: document.getElementById('quizPublic').checked
    };

    try {
        let response;
        if (quizId) {
            // Update existing quiz
            response = await fetch(`/api/admin/quizzes/${quizId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quizData)
            });
        } else {
            // Create new quiz
            response = await fetch('/api/admin/quizzes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quizData)
            });
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save quiz');
        }

        const savedQuiz = await response.json();
        alert(`Quiz "${savedQuiz.title}" saved successfully!`);
        closeQuizModal();
        await loadQuizzes();

        // If this was a new quiz, redirect to question editor
        if (!quizId) {
            manageQuestions(savedQuiz.id);
        }
    } catch (error) {
        console.error('Error saving quiz:', error);
        alert('Error: ' + error.message);
    }
}

// Edit quiz
async function editQuiz(quizId) {
    try {
        const response = await fetch(`/api/admin/quizzes/${quizId}`);
        if (!response.ok) throw new Error('Failed to load quiz');

        const quiz = await response.json();
        openQuizModal(quiz);
    } catch (error) {
        console.error('Error loading quiz:', error);
        alert('Error loading quiz: ' + error.message);
    }
}

// Delete quiz
async function deleteQuiz(quizId) {
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) return;

    if (!confirm(`Are you sure you want to delete "${quiz.title}"? This cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/quizzes/${quizId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete quiz');

        alert('Quiz deleted successfully!');
        await loadQuizzes();
    } catch (error) {
        console.error('Error deleting quiz:', error);
        alert('Error deleting quiz: ' + error.message);
    }
}

// Manage questions - redirect to question editor
function manageQuestions(quizId) {
    window.location.href = `/admin/questions.html?quizId=${quizId}`;
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
