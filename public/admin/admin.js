let quizzes = [];

const adminTokenKey = 'adminToken';
const loginPrompt = document.getElementById('loginPrompt');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const tokenInput = document.getElementById('adminTokenInput');
const dashboard = document.getElementById('dashboard');
const quizList = document.getElementById('quiz-list');
const emptyState = document.getElementById('quiz-empty');
const statusMessage = document.getElementById('statusMessage');
const createQuizBtn = document.getElementById('createQuizBtn');
const emptyCreateBtn = document.getElementById('emptyCreateBtn');
const tableWrapper = document.querySelector('.table-wrapper');

document.addEventListener('DOMContentLoaded', () => {
    createQuizBtn.addEventListener('click', handleCreateQuiz);
    emptyCreateBtn.addEventListener('click', handleCreateQuiz);
    loginForm.addEventListener('submit', handleLoginSubmit);

    if (getToken()) {
        showDashboard();
        loadQuizzes();
    } else {
        showLoginPrompt();
    }
});

function getToken() {
    return sessionStorage.getItem(adminTokenKey) || '';
}

function handleCreateQuiz() {
    window.location.href = '/admin/quiz-editor.html?quizId=new';
}

function showLoginPrompt(message = '') {
    loginPrompt.classList.remove('hidden');
    dashboard.classList.add('hidden');
    loginMessage.textContent = message;
    if (message) {
        loginMessage.classList.add('visible');
    } else {
        loginMessage.classList.remove('visible');
    }
}

function showDashboard() {
    loginPrompt.classList.add('hidden');
    dashboard.classList.remove('hidden');
}

function setStatus(type, message) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    const token = tokenInput.value.trim();
    if (!token) {
        showLoginPrompt('Token is required.');
        return;
    }
    sessionStorage.setItem(adminTokenKey, token);
    tokenInput.value = '';
    showDashboard();
    await loadQuizzes();
}

async function adminFetch(url, options = {}) {
    const token = getToken();
    if (!token) {
        showLoginPrompt('Please enter your admin token.');
        throw new Error('Admin token required.');
    }

    const headers = { ...(options.headers || {}), 'X-Admin-Token': token };
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        sessionStorage.removeItem(adminTokenKey);
        showLoginPrompt('Session expired. Please enter your token again.');
        throw new Error('Unauthorized');
    }

    return response;
}

async function loadQuizzes() {
    try {
        setStatus('info', 'Loading quizzes...');
        const response = await adminFetch('/api/admin/quizzes');
        if (!response.ok) {
            throw new Error('Failed to load quizzes');
        }
        quizzes = await response.json();
        renderQuizList(quizzes);
        setStatus('success', 'Quizzes loaded.');
    } catch (error) {
        console.error('Error loading quizzes:', error);
        setStatus('error', 'Unable to load quizzes. Please try again.');
    }
}

function renderQuizList(quizzesToShow) {
    while (quizList.firstChild) {
        quizList.removeChild(quizList.firstChild);
    }

    if (!quizzesToShow.length) {
        emptyState.classList.remove('hidden');
        tableWrapper.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    tableWrapper.classList.remove('hidden');

    quizzesToShow.forEach((quiz) => {
        const row = document.createElement('tr');

        row.appendChild(createCell(quiz.title, 'Title'));
        row.appendChild(createCell(quiz.category || 'General', 'Category'));
        row.appendChild(createCell(String(quiz.questionCount || 0), 'Questions'));

        const actionsCell = document.createElement('td');
        actionsCell.setAttribute('data-label', 'Actions');
        actionsCell.classList.add('table-actions');

        const editButton = document.createElement('button');
        editButton.className = 'btn btn-sm btn-primary';
        editButton.type = 'button';
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', () => editQuiz(quiz.id));

        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-sm btn-danger';
        deleteButton.type = 'button';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteQuiz(quiz.id));

        const duplicateButton = document.createElement('button');
        duplicateButton.className = 'btn btn-sm btn-secondary';
        duplicateButton.type = 'button';
        duplicateButton.textContent = 'Duplicate';
        duplicateButton.addEventListener('click', () => duplicateQuiz(quiz.id));

        actionsCell.append(editButton, duplicateButton, deleteButton);
        row.appendChild(actionsCell);
        quizList.appendChild(row);
    });
}

function createCell(text, label) {
    const cell = document.createElement('td');
    cell.setAttribute('data-label', label);
    cell.textContent = text;
    return cell;
}

function editQuiz(quizId) {
    window.location.href = `/admin/quiz-editor.html?quizId=${quizId}`;
}

async function deleteQuiz(quizId) {
    const quiz = quizzes.find((item) => item.id === quizId);
    if (!quiz) {
        return;
    }

    const confirmDelete = window.confirm(`Delete "${quiz.title}"? This cannot be undone.`);
    if (!confirmDelete) {
        return;
    }

    try {
        setStatus('info', 'Deleting quiz...');
        const response = await adminFetch(`/api/admin/quizzes/${quizId}`, { method: 'DELETE' });
        if (!response.ok) {
            throw new Error('Failed to delete quiz');
        }
        await loadQuizzes();
        setStatus('success', 'Quiz deleted.');
    } catch (error) {
        console.error('Error deleting quiz:', error);
        setStatus('error', 'Unable to delete quiz.');
    }
}

async function duplicateQuiz(quizId) {
    try {
        setStatus('info', 'Duplicating quiz...');
        const quizResponse = await adminFetch(`/api/admin/quizzes/${quizId}`);
        if (!quizResponse.ok) {
            throw new Error('Failed to load quiz');
        }
        const quiz = await quizResponse.json();
        const newQuizResponse = await adminFetch('/api/admin/quizzes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: `${quiz.title} (Copy)`,
                description: quiz.description || '',
                category: quiz.category || 'General',
                is_public: quiz.is_public !== false
            })
        });

        if (!newQuizResponse.ok) {
            throw new Error('Failed to create duplicate quiz');
        }

        const newQuiz = await newQuizResponse.json();
        if (Array.isArray(quiz.questions) && quiz.questions.length) {
            for (const question of quiz.questions) {
                await adminFetch(`/api/admin/quizzes/${newQuiz.id}/questions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        question_text: question.question_text,
                        time_limit: question.time_limit,
                        points: question.points,
                        answer_options: question.answer_options
                    })
                });
            }
        }

        await loadQuizzes();
        setStatus('success', 'Quiz duplicated.');
    } catch (error) {
        console.error('Error duplicating quiz:', error);
        setStatus('error', 'Unable to duplicate quiz.');
    }
}
