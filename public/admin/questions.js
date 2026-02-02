// Question editor functionality
let quizId = null;
let quiz = null;
let currentQuestion = null;
let currentQuestionImageUrl = null;
let previousQuestionImageUrl = null;
let pendingUploadedImageUrl = null;

// DOM elements
const quizTitle = document.getElementById('quizTitle');
const quizMeta = document.getElementById('quizMeta');
const questionsContainer = document.getElementById('questionsContainer');
const addQuestionBtn = document.getElementById('addQuestionBtn');
const editorPlaceholder = document.getElementById('editorPlaceholder');
const editorForm = document.getElementById('editorForm');
const questionForm = document.getElementById('questionForm');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const deleteQuestionBtn = document.getElementById('deleteQuestionBtn');
const adminTokenKey = 'adminToken';
const imagePreview = document.getElementById('imagePreview');
const imageUploadInput = document.getElementById('imageUpload');
const removeImageBtn = document.getElementById('removeImageBtn');

function promptForAdminToken(forcePrompt = false) {
    let token = sessionStorage.getItem(adminTokenKey);

    if (forcePrompt || !token) {
        token = window.prompt('Enter the admin token to access quiz questions:');
        if (token) {
            token = token.trim();
        }

        if (token) {
            sessionStorage.setItem(adminTokenKey, token);
        } else {
            sessionStorage.removeItem(adminTokenKey);
            token = '';
        }
    }

    return token;
}

async function adminFetch(url, options = {}) {
    let token = promptForAdminToken();
    if (!token) {
        throw new Error('Admin token is required to continue.');
    }

    const headers = { ...(options.headers || {}), 'X-Admin-Token': token };
    let response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        sessionStorage.removeItem(adminTokenKey);
        token = promptForAdminToken(true);
        if (!token) {
            throw new Error('Admin token is required to continue.');
        }
        const retryHeaders = { ...(options.headers || {}), 'X-Admin-Token': token };
        response = await fetch(url, { ...options, headers: retryHeaders });
    }

    return response;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Get quiz ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    quizId = parseInt(urlParams.get('quizId'));

    if (!quizId) {
        alert('No quiz ID provided');
        window.location.href = '/admin';
        return;
    }

    const token = promptForAdminToken();
    if (!token) {
        alert('Admin token is required to access this page.');
        window.location.href = '/admin';
        return;
    }

    loadQuiz();
    setupEventListeners();
});

// Event listeners
function setupEventListeners() {
    addQuestionBtn.addEventListener('click', () => openQuestionEditor());
    questionForm.addEventListener('submit', handleQuestionSubmit);
    cancelEditBtn.addEventListener('click', closeQuestionEditor);
    deleteQuestionBtn.addEventListener('click', handleDeleteQuestion);
    imageUploadInput.addEventListener('change', handleImageUpload);
    removeImageBtn.addEventListener('click', handleRemoveImage);
}

function isLocalImageUrl(url) {
    return typeof url === 'string' && url.startsWith('/images/questions/');
}

function setImagePreview(url) {
    if (!imagePreview) {
        return;
    }

    if (!url) {
        imagePreview.innerHTML = '<p class="muted">No image selected.</p>';
        removeImageBtn.disabled = true;
        return;
    }

    imagePreview.innerHTML = `<img src="${url}" alt="Question image preview">`;
    removeImageBtn.disabled = false;
}

function resetImageState() {
    currentQuestionImageUrl = null;
    previousQuestionImageUrl = null;
    pendingUploadedImageUrl = null;
    if (imageUploadInput) {
        imageUploadInput.value = '';
    }
    setImagePreview(null);
}

async function deleteImageByUrl(url) {
    if (!isLocalImageUrl(url)) {
        return;
    }

    const filename = url.split('/').pop();
    if (!filename) {
        return;
    }

    try {
        await adminFetch(`/api/admin/images/${filename}`, { method: 'DELETE' });
    } catch (error) {
        console.warn('Failed to delete image:', error.message);
    }
}

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    imagePreview.innerHTML = '<p class="muted">Uploading...</p>';
    removeImageBtn.disabled = true;

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await adminFetch('/api/admin/images', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }

        const data = await response.json();
        currentQuestionImageUrl = data.url;
        pendingUploadedImageUrl = data.url;
        setImagePreview(currentQuestionImageUrl);
    } catch (error) {
        console.error('Image upload failed:', error);
        imagePreview.innerHTML = `<p class="muted">Upload failed: ${error.message}</p>`;
        if (imageUploadInput) {
            imageUploadInput.value = '';
        }
    }
}

function handleRemoveImage() {
    const urlToDelete = currentQuestionImageUrl;
    currentQuestionImageUrl = null;
    setImagePreview(null);
    if (imageUploadInput) {
        imageUploadInput.value = '';
    }

    if (pendingUploadedImageUrl && pendingUploadedImageUrl === urlToDelete) {
        deleteImageByUrl(urlToDelete);
        pendingUploadedImageUrl = null;
    }
}

// Load quiz and questions
async function loadQuiz() {
    try {
        const response = await adminFetch(`/api/admin/quizzes/${quizId}`);
        if (!response.ok) throw new Error('Failed to load quiz');

        quiz = await response.json();
        displayQuizInfo();
        displayQuestions();
    } catch (error) {
        console.error('Error loading quiz:', error);
        alert('Error loading quiz: ' + error.message);
        window.location.href = '/admin';
    }
}

// Display quiz info
function displayQuizInfo() {
    quizTitle.textContent = quiz.title;
    quizMeta.textContent = `${quiz.category} • ${quiz.questions ? quiz.questions.length : 0} questions`;
}

// Display questions list
function displayQuestions() {
    if (!quiz.questions || quiz.questions.length === 0) {
        questionsContainer.innerHTML = `
            <div class="empty-state">
                <p>No questions yet.</p>
                <p>Click "Add Question" to create your first question!</p>
            </div>
        `;
        return;
    }

    questionsContainer.innerHTML = quiz.questions
        .sort((a, b) => a.order_index - b.order_index)
        .map(q => `
            <div class="question-item ${currentQuestion && currentQuestion.id === q.id ? 'active' : ''}"
                 onclick="selectQuestion(${q.id})">
                <div class="question-item-number">Question ${q.order_index}</div>
                <div class="question-item-text">${escapeHtml(q.question_text)}</div>
                <div class="question-item-meta">
                    <span>⏱️ ${q.time_limit}s</span>
                    <span>⭐ ${q.points} pts</span>
                </div>
            </div>
        `).join('');
}

// Select a question to edit
function selectQuestion(questionId) {
    const question = quiz.questions.find(q => q.id === questionId);
    if (!question) return;

    openQuestionEditor(question);
}

// Open question editor
function openQuestionEditor(question = null) {
    currentQuestion = question;

    editorPlaceholder.style.display = 'none';
    editorForm.style.display = 'block';

    if (question) {
        // Edit mode
        document.getElementById('questionId').value = question.id;
        document.getElementById('questionText').value = question.question_text;
        document.getElementById('timeLimit').value = question.time_limit;
        document.getElementById('points').value = question.points;
        previousQuestionImageUrl = question.image_url || null;
        currentQuestionImageUrl = question.image_url || null;
        pendingUploadedImageUrl = null;
        setImagePreview(currentQuestionImageUrl);
        if (imageUploadInput) {
            imageUploadInput.value = '';
        }

        // Set answers
        if (question.answer_options && question.answer_options.length === 4) {
            question.answer_options.forEach((answer, index) => {
                document.getElementById(`answer${index}`).value = answer.option_text;
                if (answer.is_correct) {
                    document.querySelector(`input[name="correctAnswer"][value="${index}"]`).checked = true;
                }
            });
        }

        deleteQuestionBtn.style.display = 'block';
    } else {
        // Create mode
        questionForm.reset();
        document.getElementById('questionId').value = '';
        document.getElementById('timeLimit').value = '20';
        document.getElementById('points').value = '1000';
        deleteQuestionBtn.style.display = 'none';
        resetImageState();
    }

    // Update active state in list
    displayQuestions();

    // Scroll to editor on mobile
    if (window.innerWidth <= 768) {
        editorForm.scrollIntoView({ behavior: 'smooth' });
    }
}

// Close question editor
function closeQuestionEditor() {
    editorPlaceholder.style.display = 'block';
    editorForm.style.display = 'none';
    currentQuestion = null;
    questionForm.reset();
    if (pendingUploadedImageUrl && pendingUploadedImageUrl !== previousQuestionImageUrl) {
        deleteImageByUrl(pendingUploadedImageUrl);
    }
    resetImageState();
    displayQuestions();
}

// Handle question form submission
async function handleQuestionSubmit(e) {
    e.preventDefault();

    const questionId = document.getElementById('questionId').value;
    const questionData = {
        question_text: document.getElementById('questionText').value.trim(),
        time_limit: parseInt(document.getElementById('timeLimit').value),
        points: parseInt(document.getElementById('points').value),
        image_url: currentQuestionImageUrl || null,
        answer_options: []
    };

    // Get answer options
    const correctAnswerIndex = parseInt(document.querySelector('input[name="correctAnswer"]:checked').value);

    for (let i = 0; i < 4; i++) {
        const answerText = document.getElementById(`answer${i}`).value.trim();
        if (!answerText) {
            alert('Please fill in all 4 answer options');
            return;
        }

        questionData.answer_options.push({
            option_text: answerText,
            is_correct: i === correctAnswerIndex,
            order_index: i + 1
        });
    }

    try {
        let response;
        if (questionId) {
            // Update existing question
            response = await adminFetch(`/api/admin/quizzes/${quizId}/questions/${questionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(questionData)
            });
        } else {
            // Create new question
            response = await adminFetch(`/api/admin/quizzes/${quizId}/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(questionData)
            });
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save question');
        }

        alert('Question saved successfully!');
        const imageUrlToDelete = previousQuestionImageUrl && previousQuestionImageUrl !== currentQuestionImageUrl
            ? previousQuestionImageUrl
            : null;
        await loadQuiz();
        if (imageUrlToDelete) {
            await deleteImageByUrl(imageUrlToDelete);
        }
        previousQuestionImageUrl = currentQuestionImageUrl;
        pendingUploadedImageUrl = null;
        closeQuestionEditor();
    } catch (error) {
        console.error('Error saving question:', error);
        alert('Error: ' + error.message);
    }
}

// Handle delete question
async function handleDeleteQuestion() {
    if (!currentQuestion) return;

    if (!confirm('Are you sure you want to delete this question? This cannot be undone.')) {
        return;
    }

    try {
        const imageUrl = currentQuestion?.image_url || null;
        const response = await adminFetch(`/api/admin/quizzes/${quizId}/questions/${currentQuestion.id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete question');

        alert('Question deleted successfully!');
        if (imageUrl) {
            await deleteImageByUrl(imageUrl);
        }
        await loadQuiz();
        closeQuestionEditor();
    } catch (error) {
        console.error('Error deleting question:', error);
        alert('Error deleting question: ' + error.message);
    }
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
