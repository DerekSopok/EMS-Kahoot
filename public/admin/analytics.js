let categoryChart = null;
let trendChart = null;

const adminTokenKey = 'adminToken';
const loginPrompt = document.getElementById('loginPrompt');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const tokenInput = document.getElementById('adminTokenInput');
const analyticsContent = document.getElementById('analyticsContent');

document.addEventListener('DOMContentLoaded', () => {
    loginForm.addEventListener('submit', handleLoginSubmit);

    if (getToken()) {
        showAnalytics();
        loadAnalytics();
    } else {
        showLoginPrompt();
    }
});

function getToken() {
    return sessionStorage.getItem(adminTokenKey) || '';
}

function showLoginPrompt(message = '') {
    loginPrompt.classList.remove('hidden');
    analyticsContent.classList.add('hidden');
    loginMessage.textContent = message;
    if (message) {
        loginMessage.classList.add('visible');
    } else {
        loginMessage.classList.remove('visible');
    }
}

function showAnalytics() {
    loginPrompt.classList.add('hidden');
    analyticsContent.classList.remove('hidden');
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
    showAnalytics();
    await loadAnalytics();
}

async function loadAnalytics() {
    try {
        await Promise.all([
            loadOverview(),
            loadCategoryChart(),
            loadHardestQuestions(),
            loadTrendChart()
        ]);
    } catch (error) {
        console.error('Error loading analytics:', error);
        if (error.message === 'Admin token required.' || error.message.includes('Unauthorized')) {
            showLoginPrompt('Invalid token or session expired.');
        }
    }
}

async function loadOverview() {
    const response = await fetch('/api/admin/analytics/overview', {
        headers: { 'X-Admin-Token': getToken() }
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error('Unauthorized');
        }
        throw new Error('Failed to load overview stats');
    }

    const stats = await response.json();

    document.getElementById('overview-stats').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${stats.totalGames}</div>
            <div class="stat-label">Total Games</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.totalPlayers}</div>
            <div class="stat-label">Total Players</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.averageScore.toLocaleString()}</div>
            <div class="stat-label">Avg Score</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.averageAccuracy}%</div>
            <div class="stat-label">Avg Accuracy</div>
        </div>
    `;
}

async function loadCategoryChart() {
    const response = await fetch('/api/admin/analytics/categories', {
        headers: { 'X-Admin-Token': getToken() }
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error('Unauthorized');
        }
        throw new Error('Failed to load category data');
    }

    const data = await response.json();

    const ctx = document.getElementById('category-chart').getContext('2d');

    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.category),
            datasets: [{
                label: 'Accuracy %',
                data: data.map(d => d.accuracy),
                backgroundColor: data.map(d =>
                    d.accuracy >= 80 ? '#26890C' :
                    d.accuracy >= 60 ? '#FFA602' : '#E21B3C'
                )
            }]
        },
        options: {
            indexAxis: 'y',
            scales: {
                x: { min: 0, max: 100 }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

async function loadHardestQuestions() {
    const response = await fetch('/api/admin/analytics/hardest-questions?limit=10', {
        headers: { 'X-Admin-Token': getToken() }
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error('Unauthorized');
        }
        throw new Error('Failed to load hardest questions');
    }

    const questions = await response.json();

    document.getElementById('hardest-questions').innerHTML = `
        <thead>
            <tr>
                <th>Question</th>
                <th>Quiz</th>
                <th>Accuracy</th>
                <th>Attempts</th>
            </tr>
        </thead>
        <tbody>
            ${questions.map(q => `
                <tr>
                    <td>${escapeHtml(q.questionText.substring(0, 50))}${q.questionText.length > 50 ? '...' : ''}</td>
                    <td>${escapeHtml(q.quizTitle)}</td>
                    <td class="${q.accuracy < 50 ? 'danger' : 'warning'}">${q.accuracy}%</td>
                    <td>${q.total}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
}

async function loadTrendChart() {
    const response = await fetch('/api/admin/analytics/trends?days=30', {
        headers: { 'X-Admin-Token': getToken() }
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new Error('Unauthorized');
        }
        throw new Error('Failed to load trend data');
    }

    const data = await response.json();

    const ctx = document.getElementById('trend-chart').getContext('2d');

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date),
            datasets: [
                {
                    label: 'Games',
                    data: data.map(d => d.games),
                    borderColor: '#1368CE',
                    tension: 0.3
                },
                {
                    label: 'Players',
                    data: data.map(d => d.players),
                    borderColor: '#26890C',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
