const adminTokenKey = 'adminToken';
const timeOptions = [10, 20, 30, 45, 60, 90, 120];
const pointOptions = [500, 750, 1000, 1500, 2000];

let currentQuiz = null;
let activeQuestionId = null;
let unsavedChanges = false;
let currentQuestionImageUrl = null;
let previousQuestionImageUrl = null;
let pendingUploadedImageUrl = null;

const loginPrompt = document.getElementById('loginPrompt');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const tokenInput = document.getElementById('adminTokenInput');
const editorContent = document.getElementById('editorContent');
const quizEditorTitle = document.getElementById('quizEditorTitle');
const statusMessage = document.getElementById('statusMessage');
const quizForm = document.getElementById('quizForm');
const quizTitleInput = document.getElementById('quizTitle');
const quizDescriptionInput = document.getElementById('quizDescription');
const quizCategorySelect = document.getElementById('quizCategory');
const saveQuizBtn = document.getElementById('saveQuizBtn');
const questionList = document.getElementById('questionList');
const addQuestionBtn = document.getElementById('addQuestionBtn');
const questionEditor = document.getElementById('questionEditor');
const questionEditorTitle = document.getElementById('questionEditorTitle');
const questionForm = document.getElementById('questionForm');
const questionTextInput = document.getElementById('questionText');
const questionTimeSelect = document.getElementById('questionTime');
const questionPointsSelect = document.getElementById('questionPoints');
const answerOptionsContainer = document.getElementById('answerOptions');
const addOptionBtn = document.getElementById('addOptionBtn');
const questionErrors = document.getElementById('questionErrors');
const cancelQuestionBtn = document.getElementById('cancelQuestionBtn');
const imagePreview = document.getElementById('imagePreview');
const imageUploadInput = document.getElementById('imageUpload');
const removeImageBtn = document.getElementById('removeImageBtn');

document.addEventListener('DOMContentLoaded', () => {
    loginForm.addEventListener('submit', handleLoginSubmit);
    saveQuizBtn.addEventListener('click', saveQuiz);
    quizForm.addEventListener('submit', (event) => {
        event.preventDefault();
        saveQuiz();
    });
    addQuestionBtn.addEventListener('click', () => openQuestionEditor());
    addOptionBtn.addEventListener('click', handleAddOption);
    cancelQuestionBtn.addEventListener('click', closeQuestionEditor);
    questionForm.addEventListener('submit', handleQuestionSubmit);
    imageUploadInput.addEventListener('change', handleImageUpload);
    removeImageBtn.addEventListener('click', handleRemoveImage);

    quizForm.querySelectorAll('input, textarea, select').forEach((element) => {
        element.addEventListener('input', markUnsaved);
        element.addEventListener('change', markUnsaved);
    });

    questionForm.addEventListener('input', markUnsaved);
    questionForm.addEventListener('change', markUnsaved);

    initializeEditor();
});

window.addEventListener('beforeunload', (event) => {
    if (!unsavedChanges) {
        return;
    }
    event.preventDefault();
    event.returnValue = '';
});

function getToken() {
    return sessionStorage.getItem(adminTokenKey) || '';
}

function setStatus(type, message) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
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
        markUnsaved();
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

    markUnsaved();
}

function showLoginPrompt(message = '') {
    loginPrompt.classList.remove('hidden');
    editorContent.classList.add('hidden');
    loginMessage.textContent = message;
    loginMessage.classList.toggle('visible', Boolean(message));
}

function showEditor() {
    loginPrompt.classList.add('hidden');
    editorContent.classList.remove('hidden');
}

function markUnsaved() {
    unsavedChanges = true;
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
    await initializeEditor();
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

async function initializeEditor() {
    if (!getToken()) {
        showLoginPrompt();
        return;
    }

    showEditor();
    await loadCategories();
    await loadQuiz();
}

async function loadCategories() {
    try {
        const response = await adminFetch('/api/admin/categories');
        if (!response.ok) {
            throw new Error('Failed to load categories');
        }
        const categories = await response.json();
        while (quizCategorySelect.firstChild) {
            quizCategorySelect.removeChild(quizCategorySelect.firstChild);
        }

        categories.forEach((category) => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            quizCategorySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading categories:', error);
        setStatus('error', 'Unable to load categories.');
    }
}

function getQuizIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get('quizId') || 'new';
}

async function loadQuiz() {
    const quizId = getQuizIdFromQuery();
    if (quizId === 'new') {
        currentQuiz = { title: '', description: '', category: '', questions: [] };
        renderQuizForm();
        renderQuestions();
        return;
    }

    try {
        setStatus('info', 'Loading quiz...');
        const response = await adminFetch(`/api/admin/quizzes/${quizId}`);
        if (!response.ok) {
            throw new Error('Failed to load quiz');
        }
        currentQuiz = await response.json();
        renderQuizForm();
        renderQuestions();
        setStatus('success', 'Quiz loaded.');
    } catch (error) {
        console.error('Error loading quiz:', error);
        setStatus('error', 'Unable to load quiz.');
    }
}

function renderQuizForm() {
    quizTitleInput.value = currentQuiz.title || '';
    quizDescriptionInput.value = currentQuiz.description || '';
    quizCategorySelect.value = currentQuiz.category || quizCategorySelect.options[0]?.value || '';
    addQuestionBtn.disabled = !currentQuiz.id;
    updateQuizTitle();
}

function updateQuizTitle() {
    if (currentQuiz && currentQuiz.title) {
        quizEditorTitle.textContent = `Editing: ${currentQuiz.title}`;
    } else {
        quizEditorTitle.textContent = 'Create a New Quiz';
    }
}

async function saveQuiz() {
    const title = quizTitleInput.value.trim();
    const description = quizDescriptionInput.value.trim();
    const category = quizCategorySelect.value;
    const errors = [];

    if (!title || title.length > 200) {
        errors.push('Title must be between 1 and 200 characters.');
    }
    if (description.length > 1000) {
        errors.push('Description must be under 1000 characters.');
    }
    if (!category) {
        errors.push('Category is required.');
    }

    if (errors.length) {
        setStatus('error', errors.join(' '));
        return;
    }

    try {
        setStatus('info', 'Saving quiz...');
        const method = currentQuiz.id ? 'PUT' : 'POST';
        const url = currentQuiz.id ? `/api/admin/quizzes/${currentQuiz.id}` : '/api/admin/quizzes';
        const response = await adminFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, category })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save quiz');
        }

        currentQuiz = await response.json();
        updateQuizTitle();
        addQuestionBtn.disabled = !currentQuiz.id;
        unsavedChanges = false;
        setStatus('success', 'Quiz saved.');

        if (!currentQuiz.id) {
            return;
        }
        if (getQuizIdFromQuery() === 'new') {
            window.history.replaceState({}, '', `/admin/quiz-editor.html?quizId=${currentQuiz.id}`);
        }
    } catch (error) {
        console.error('Error saving quiz:', error);
        setStatus('error', error.message || 'Unable to save quiz.');
    }
}

function renderQuestions() {
    while (questionList.firstChild) {
        questionList.removeChild(questionList.firstChild);
    }

    if (!currentQuiz.questions || !currentQuiz.questions.length) {
        const empty = document.createElement('p');
        empty.className = 'empty-text';
        empty.textContent = 'No questions yet. Add the first question to get started.';
        questionList.appendChild(empty);
        return;
    }

    currentQuiz.questions.forEach((question, index) => {
        const details = document.createElement('details');
        details.className = 'question-item';

        const summary = document.createElement('summary');
        summary.textContent = `${index + 1}. ${question.question_text}`;
        details.appendChild(summary);

        const content = document.createElement('div');
        content.className = 'question-content';

        const meta = document.createElement('p');
        meta.className = 'question-meta';
        meta.textContent = `Time: ${question.time_limit || 30}s • Points: ${question.points || 1000}`;
        content.appendChild(meta);

        const answersHeading = document.createElement('p');
        answersHeading.className = 'question-meta';
        answersHeading.textContent = 'Answer options:';
        content.appendChild(answersHeading);

        const answerList = document.createElement('ul');
        answerList.className = 'answer-list';
        (question.answer_options || []).forEach((option) => {
            const item = document.createElement('li');
            item.textContent = option.is_correct ? `✅ ${option.option_text}` : option.option_text;
            answerList.appendChild(item);
        });
        content.appendChild(answerList);

        const actions = document.createElement('div');
        actions.className = 'question-actions';

        const editButton = document.createElement('button');
        editButton.className = 'btn btn-sm btn-primary';
        editButton.type = 'button';
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', () => openQuestionEditor(question));

        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-sm btn-danger';
        deleteButton.type = 'button';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteQuestion(question.id));

        const upButton = document.createElement('button');
        upButton.className = 'btn btn-sm btn-secondary';
        upButton.type = 'button';
        upButton.textContent = 'Move Up';
        upButton.disabled = index === 0;
        upButton.addEventListener('click', () => moveQuestion(index, -1));

        const downButton = document.createElement('button');
        downButton.className = 'btn btn-sm btn-secondary';
        downButton.type = 'button';
        downButton.textContent = 'Move Down';
        downButton.disabled = index === currentQuiz.questions.length - 1;
        downButton.addEventListener('click', () => moveQuestion(index, 1));

        actions.append(editButton, upButton, downButton, deleteButton);
        content.appendChild(actions);

        details.appendChild(content);
        questionList.appendChild(details);
    });
}

async function moveQuestion(index, direction) {
    if (!currentQuiz?.id) {
        return;
    }
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentQuiz.questions.length) {
        return;
    }

    const updated = [...currentQuiz.questions];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    const questionIds = updated.map((question) => question.id);

    try {
        setStatus('info', 'Reordering questions...');
        const response = await adminFetch(`/api/admin/quizzes/${currentQuiz.id}/questions/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionIds })
        });
        if (!response.ok) {
            throw new Error('Failed to reorder questions');
        }
        currentQuiz.questions = await response.json();
        renderQuestions();
        setStatus('success', 'Questions reordered.');
    } catch (error) {
        console.error('Error reordering questions:', error);
        setStatus('error', 'Unable to reorder questions.');
    }
}

function openQuestionEditor(question = null) {
    if (!currentQuiz?.id) {
        setStatus('error', 'Save the quiz before adding questions.');
        return;
    }

    questionEditor.classList.remove('hidden');
    questionErrors.textContent = '';

    if (question) {
        activeQuestionId = question.id;
        questionEditorTitle.textContent = 'Edit Question';
        questionTextInput.value = question.question_text || '';
        questionTimeSelect.value = question.time_limit || timeOptions[2];
        questionPointsSelect.value = question.points || pointOptions[2];
        previousQuestionImageUrl = question.image_url || null;
        currentQuestionImageUrl = question.image_url || null;
        pendingUploadedImageUrl = null;
        setImagePreview(currentQuestionImageUrl);
        if (imageUploadInput) {
            imageUploadInput.value = '';
        }
        const options = Array.isArray(question.answer_options) && question.answer_options.length
            ? question.answer_options
            : createEmptyOptions(4);
        renderAnswerOptions(options);
    } else {
        activeQuestionId = null;
        questionEditorTitle.textContent = 'Add Question';
        questionTextInput.value = '';
        questionTimeSelect.value = timeOptions[2];
        questionPointsSelect.value = pointOptions[2];
        renderAnswerOptions(createEmptyOptions(4));
        resetImageState();
    }

    questionEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeQuestionEditor() {
    questionEditor.classList.add('hidden');
    questionForm.reset();
    questionErrors.textContent = '';
    activeQuestionId = null;
    if (pendingUploadedImageUrl && pendingUploadedImageUrl !== previousQuestionImageUrl) {
        deleteImageByUrl(pendingUploadedImageUrl);
    }
    resetImageState();
}

function populateSelectOptions(selectElement, options) {
    while (selectElement.firstChild) {
        selectElement.removeChild(selectElement.firstChild);
    }
    options.forEach((option) => {
        const optionEl = document.createElement('option');
        optionEl.value = option;
        optionEl.textContent = option;
        selectElement.appendChild(optionEl);
    });
}

populateSelectOptions(questionTimeSelect, timeOptions);
populateSelectOptions(questionPointsSelect, pointOptions);

function createEmptyOptions(count) {
    return Array.from({ length: count }, () => ({ option_text: '', is_correct: false }));
}

function renderAnswerOptions(options) {
    if (options.length && !options.some((option) => option.is_correct)) {
        options[0].is_correct = true;
    }
    while (answerOptionsContainer.firstChild) {
        answerOptionsContainer.removeChild(answerOptionsContainer.firstChild);
    }

    options.forEach((option, index) => {
        const row = document.createElement('div');
        row.className = 'answer-option';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'correctAnswer';
        radio.value = String(index);
        radio.checked = Boolean(option.is_correct);

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.placeholder = `Answer ${index + 1}`;
        textInput.value = option.option_text || '';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-danger btn-sm';
        removeBtn.textContent = 'Remove';
        removeBtn.disabled = options.length <= 4;
        removeBtn.addEventListener('click', () => removeAnswerOption(index));

        row.append(radio, textInput, removeBtn);
        answerOptionsContainer.appendChild(row);
    });

    addOptionBtn.disabled = options.length >= 6;
}

function readAnswerOptions() {
    const rows = Array.from(answerOptionsContainer.querySelectorAll('.answer-option'));
    return rows.map((row, index) => {
        const textInput = row.querySelector('input[type="text"]');
        const radio = row.querySelector('input[type="radio"]');
        return {
            option_text: textInput.value.trim(),
            is_correct: radio.checked
        };
    });
}

function handleAddOption() {
    const options = readAnswerOptions();
    if (options.length >= 6) {
        return;
    }
    options.push({ option_text: '', is_correct: false });
    renderAnswerOptions(options);
}

function removeAnswerOption(index) {
    const options = readAnswerOptions();
    if (options.length <= 4) {
        return;
    }
    options.splice(index, 1);
    const hasCorrect = options.some((option) => option.is_correct);
    if (!hasCorrect && options.length) {
        options[0].is_correct = true;
    }
    renderAnswerOptions(options);
}

function showQuestionErrors(errors) {
    questionErrors.textContent = errors.join(' ');
}

async function handleQuestionSubmit(event) {
    event.preventDefault();
    const questionText = questionTextInput.value.trim();
    const timeLimit = parseInt(questionTimeSelect.value, 10);
    const points = parseInt(questionPointsSelect.value, 10);
    const options = readAnswerOptions();
    const errors = [];

    if (!questionText) {
        errors.push('Question text is required.');
    }

    if (options.length < 4 || options.length > 6) {
        errors.push('Provide 4 to 6 answer options.');
    }

    if (options.some((option) => !option.option_text)) {
        errors.push('All answer options must have text.');
    }

    const correctCount = options.filter((option) => option.is_correct).length;
    if (correctCount !== 1) {
        errors.push('Select exactly one correct answer.');
    }

    if (errors.length) {
        showQuestionErrors(errors);
        return;
    }

    try {
        setStatus('info', activeQuestionId ? 'Updating question...' : 'Adding question...');
        const method = activeQuestionId ? 'PUT' : 'POST';
        const url = activeQuestionId
            ? `/api/admin/quizzes/${currentQuiz.id}/questions/${activeQuestionId}`
            : `/api/admin/quizzes/${currentQuiz.id}/questions`;
        const response = await adminFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_text: questionText,
                time_limit: timeLimit,
                points,
                image_url: currentQuestionImageUrl || null,
                answer_options: options
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save question');
        }

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
        unsavedChanges = false;
        setStatus('success', 'Question saved.');
    } catch (error) {
        console.error('Error saving question:', error);
        showQuestionErrors([error.message || 'Unable to save question.']);
        setStatus('error', 'Unable to save question.');
    }
}

async function deleteQuestion(questionId) {
    if (!currentQuiz?.id) {
        return;
    }
    const confirmDelete = window.confirm('Delete this question? This cannot be undone.');
    if (!confirmDelete) {
        return;
    }

    try {
        const question = currentQuiz?.questions?.find((entry) => entry.id === questionId);
        const imageUrl = question?.image_url || null;
        setStatus('info', 'Deleting question...');
        const response = await adminFetch(`/api/admin/quizzes/${currentQuiz.id}/questions/${questionId}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error('Failed to delete question');
        }
        await loadQuiz();
        if (imageUrl) {
            await deleteImageByUrl(imageUrl);
        }
        setStatus('success', 'Question deleted.');
    } catch (error) {
        console.error('Error deleting question:', error);
        setStatus('error', 'Unable to delete question.');
    }
}
