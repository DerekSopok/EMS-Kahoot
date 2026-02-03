// Practice Mode JavaScript

let currentQuiz = null;
let currentQuestionIndex = 0;
let score = 0;
let answers = [];
let startTime = null;

// Utility function to escape HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Load quizzes on index page
async function loadQuizzes() {
  try {
    const response = await fetch('/api/practice/quizzes');
    const quizzes = await response.json();

    // Extract unique categories
    const categories = [...new Set(quizzes.map(q => q.category).filter(Boolean))];
    populateCategoryFilter(categories);

    renderQuizGrid(quizzes);
  } catch (error) {
    console.error('Error loading quizzes:', error);
    document.getElementById('quiz-grid').innerHTML = '<p class="error">Failed to load quizzes. Please try again.</p>';
  }
}

function populateCategoryFilter(categories) {
  const filter = document.getElementById('category-filter');
  if (!filter) return;

  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    filter.appendChild(option);
  });

  filter.addEventListener('change', filterQuizzes);
}

async function filterQuizzes() {
  const selectedCategory = document.getElementById('category-filter').value;
  const response = await fetch('/api/practice/quizzes');
  const quizzes = await response.json();

  const filtered = selectedCategory
    ? quizzes.filter(q => q.category === selectedCategory)
    : quizzes;

  renderQuizGrid(filtered);
}

function renderQuizGrid(quizzes) {
  const grid = document.getElementById('quiz-grid');
  if (!grid) return;

  if (quizzes.length === 0) {
    grid.innerHTML = '<p class="no-quizzes">No quizzes available.</p>';
    return;
  }

  grid.innerHTML = quizzes.map(q => `
    <div class="quiz-card" onclick="startPractice(${q.id})">
      <h3>${escapeHtml(q.title)}</h3>
      <p>${escapeHtml(q.description || 'No description available')}</p>
      <div class="quiz-meta">
        <span class="category">${escapeHtml(q.category || 'General')}</span>
        <span class="questions">${q.questionCount} question${q.questionCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  `).join('');
}

async function startPractice(quizId) {
  try {
    const response = await fetch(`/api/practice/quizzes/${quizId}`);
    if (!response.ok) {
      throw new Error('Quiz not found');
    }
    currentQuiz = await response.json();
    currentQuestionIndex = 0;
    score = 0;
    answers = [];
    startTime = Date.now();

    // Navigate to quiz page with quiz ID
    window.location.href = `/practice/quiz.html?id=${quizId}`;
  } catch (error) {
    console.error('Error starting practice:', error);
    alert('Failed to load quiz. Please try again.');
  }
}

// Load quiz and show first question on quiz page
async function loadQuizAndStart() {
  const urlParams = new URLSearchParams(window.location.search);
  const quizId = urlParams.get('id');

  if (!quizId) {
    document.getElementById('question-container').innerHTML = '<p class="error">No quiz selected.</p>';
    return;
  }

  try {
    const response = await fetch(`/api/practice/quizzes/${quizId}`);
    if (!response.ok) {
      throw new Error('Quiz not found');
    }
    currentQuiz = await response.json();
    currentQuestionIndex = 0;
    score = 0;
    answers = [];
    startTime = Date.now();

    showQuestion();
  } catch (error) {
    console.error('Error loading quiz:', error);
    document.getElementById('question-container').innerHTML = '<p class="error">Failed to load quiz. <a href="/practice">Go back</a></p>';
  }
}

function showQuestion() {
  const question = currentQuiz.questions[currentQuestionIndex];
  const container = document.getElementById('question-container');

  container.innerHTML = `
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${((currentQuestionIndex) / currentQuiz.questions.length) * 100}%"></div>
    </div>

    <div class="progress-text">
      Question ${currentQuestionIndex + 1} of ${currentQuiz.questions.length}
    </div>

    ${question.image_url ? `<img src="${escapeHtml(question.image_url)}" class="question-image" alt="Question image">` : ''}

    <h2 class="question-text">${escapeHtml(question.question_text)}</h2>

    <div class="answers-grid">
      ${question.answer_options.map((opt, i) => `
        <button class="answer-btn answer-${i % 4}" onclick="submitAnswer(${opt.id})">
          ${escapeHtml(opt.option_text)}
        </button>
      `).join('')}
    </div>
  `;
}

function submitAnswer(answerId) {
  const question = currentQuiz.questions[currentQuestionIndex];
  const selectedOption = question.answer_options.find(o => o.id === answerId);
  const correctOption = question.answer_options.find(o => o.is_correct);
  const isCorrect = correctOption.id === answerId;

  // Store answer
  answers.push({
    questionId: question.id,
    answerId,
    correct: isCorrect,
    timeMs: Date.now() - startTime
  });

  if (isCorrect) {
    score += question.points || 1000;
  }

  // Show feedback
  showFeedback(isCorrect, correctOption, question, selectedOption);
}

function showFeedback(isCorrect, correctOption, question, selectedOption) {
  const container = document.getElementById('question-container');

  container.innerHTML = `
    <div class="feedback ${isCorrect ? 'correct' : 'incorrect'}">
      <h2>${isCorrect ? '✅ Correct!' : '❌ Incorrect'}</h2>

      ${!isCorrect ? `
        <div class="answer-comparison">
          <p><strong>Your answer:</strong> ${escapeHtml(selectedOption.option_text)}</p>
          <p><strong>Correct answer:</strong> ${escapeHtml(correctOption.option_text)}</p>
        </div>
      ` : ''}

      ${question.rationale ? `
        <div class="rationale">
          <h3>💡 Explanation:</h3>
          <p>${escapeHtml(question.rationale)}</p>
        </div>
      ` : ''}

      <button onclick="nextQuestion()" class="btn-primary">
        ${currentQuestionIndex < currentQuiz.questions.length - 1 ? 'Next Question →' : 'See Results 🎯'}
      </button>
    </div>
  `;
}

function nextQuestion() {
  currentQuestionIndex++;

  if (currentQuestionIndex >= currentQuiz.questions.length) {
    showPracticeResults();
  } else {
    startTime = Date.now();
    showQuestion();
  }
}

function showPracticeResults() {
  const correctCount = answers.filter(a => a.correct).length;
  const totalQuestions = currentQuiz.questions.length;
  const percentage = Math.round((correctCount / totalQuestions) * 100);

  const container = document.getElementById('question-container');
  container.innerHTML = `
    <div class="practice-results">
      <h1>Practice Complete! 🎉</h1>

      <div class="score-circle ${percentage >= 80 ? 'passing' : percentage >= 60 ? 'good' : 'needs-work'}">
        <span class="percentage">${percentage}%</span>
        <span class="fraction">${correctCount}/${totalQuestions}</span>
      </div>

      <div class="score-breakdown">
        <p class="total-score">Total Score: <strong>${score.toLocaleString()}</strong> points</p>
      </div>

      <h3>📝 Review Your Answers</h3>
      <div class="answer-review">
        ${currentQuiz.questions.map((q, i) => `
          <div class="review-item ${answers[i].correct ? 'correct' : 'incorrect'}">
            <span class="icon">${answers[i].correct ? '✅' : '❌'}</span>
            <span class="question-preview">${escapeHtml(q.question_text.substring(0, 60))}${q.question_text.length > 60 ? '...' : ''}</span>
          </div>
        `).join('')}
      </div>

      <div class="actions">
        <button onclick="retryQuiz()" class="btn-primary">🔄 Try Again</button>
        <button onclick="location.href='/practice'" class="btn-secondary">📚 Choose Another Quiz</button>
      </div>
    </div>
  `;
}

function retryQuiz() {
  currentQuestionIndex = 0;
  score = 0;
  answers = [];
  startTime = Date.now();
  showQuestion();
}

// Initialize based on current page
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're on the quiz selection page or quiz page
  if (window.location.pathname.includes('/practice/quiz.html')) {
    loadQuizAndStart();
  } else if (window.location.pathname.includes('/practice')) {
    loadQuizzes();
  }
});
