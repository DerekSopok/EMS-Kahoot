const socket = io();
const params = new URLSearchParams(window.location.search);

const questionNum = document.getElementById('questionNum');
const playersAnswered = document.getElementById('playersAnswered');
const timerText = document.getElementById('timerText');
const timeValue = document.getElementById('num');
const questionText = document.getElementById('question');
const questionImageContainer = document.getElementById('questionImageContainer');
const questionImage = document.getElementById('questionImage');
const nextButton = document.getElementById('nextQButton');

const answerElements = [
    document.getElementById('answer1'),
    document.getElementById('answer2'),
    document.getElementById('answer3'),
    document.getElementById('answer4')
];

let roomCode = params.get('roomCode') || sessionStorage.getItem('hostRoomCode') || '';
let currentCorrectAnswerId = null;
let timerId = null;
let totalPlayers = 0;
let currentAnswerIds = [];

const updateTimer = (timeLimit) => {
    clearInterval(timerId);
    let remaining = timeLimit;
    let countdownPlayed = false;

    if (timeValue) {
        timeValue.textContent = ` ${remaining}`;
    }

    timerId = setInterval(() => {
        remaining -= 1;
        if (timeValue) {
            timeValue.textContent = ` ${remaining}`;
        }

        // Play countdown sound during last 5 seconds
        if (remaining === 5 && !countdownPlayed && typeof audioManager !== 'undefined') {
            audioManager.play('countdown');
            countdownPlayed = true;
        }

        if (remaining <= 0) {
            clearInterval(timerId);
            // Play time's up sound
            if (typeof audioManager !== 'undefined') {
                audioManager.play('timesUp');
            }
            socket.emit('host:times-up');
        }
    }, 1000);
};

const resetAnswers = () => {
    answerElements.forEach((element) => {
        if (!element) {
            return;
        }
        element.style.filter = 'none';
    });
};

const updateQuestionImage = (imageUrl) => {
    if (!questionImageContainer || !questionImage) {
        return;
    }

    if (imageUrl) {
        questionImage.src = imageUrl;
        questionImageContainer.style.display = 'flex';
        document.body.classList.add('has-question-image');
    } else {
        questionImage.removeAttribute('src');
        questionImageContainer.style.display = 'none';
        document.body.classList.remove('has-question-image');
    }
};

const renderQuestion = (data) => {
    currentCorrectAnswerId = data?.correctAnswerId || currentCorrectAnswerId;
    currentAnswerIds = Array.isArray(data.answers) ? data.answers.map(answer => answer.id) : [];

    if (questionNum) {
        questionNum.textContent = `Question ${data.questionNumber} / ${data.totalQuestions}`;
    }

    if (questionText) {
        questionText.textContent = data.questionText;
    }

    updateQuestionImage(data.imageUrl || null);

    if (playersAnswered) {
        playersAnswered.textContent = `Players Answered: 0 / ${totalPlayers}`;
    }

    resetAnswers();

    if (Array.isArray(data.answers)) {
        data.answers.forEach((answer, index) => {
            if (answerElements[index]) {
                answerElements[index].textContent = answer.text;
            }
        });
    }

    if (nextButton) {
        nextButton.style.display = 'none';
    }

    if (timerText) {
        timerText.style.display = 'block';
    }

    // Play question reveal sound
    if (typeof audioManager !== 'undefined') {
        audioManager.play('questionReveal');
    }

    updateTimer(data.timeLimit || 20);
};

const showResults = (data) => {
    clearInterval(timerId);

    if (playersAnswered) {
        playersAnswered.textContent = `Players Answered: ${data.playersAnswered} / ${data.totalPlayers}`;
    }

    if (timerText) {
        timerText.style.display = 'none';
    }

    if (currentCorrectAnswerId) {
        const correctIndex = currentAnswerIds.findIndex((answerId) => answerId === currentCorrectAnswerId);
        answerElements.forEach((element, index) => {
            if (!element) {
                return;
            }
            element.style.filter = index === correctIndex ? 'none' : 'grayscale(70%)';
        });
    }

    if (nextButton) {
        nextButton.style.display = 'block';
    }

    // Play leaderboard sound when showing results
    if (typeof audioManager !== 'undefined') {
        audioManager.play('leaderboard');
    }

    updateLeaderboard(data.leaderboard || []);
};

const updateLeaderboard = (leaderboard, showScores = false) => {
    const winners = [
        document.getElementById('winner1'),
        document.getElementById('winner2'),
        document.getElementById('winner3'),
        document.getElementById('winner4'),
        document.getElementById('winner5')
    ];

    const medals = ['🥇', '🥈', '🥉', '', ''];

    winners.forEach((element, index) => {
        if (!element) {
            return;
        }
        const entry = leaderboard[index];
        if (entry) {
            const medal = medals[index];
            const scoreText = showScores ? ` - ${entry.score.toLocaleString()} pts` : '';
            element.textContent = `${index + 1}. ${medal} ${entry.name}${scoreText}`;
        } else {
            element.textContent = `${index + 1}.`;
        }
    });
};

socket.on('connect', () => {
    if (!roomCode) {
        window.location.href = '/';
        return;
    }

    socket.emit('host:join-room', { roomCode });
});

socket.on('host:join-room', (data) => {
    if (!data?.success) {
        window.location.href = '/';
        return;
    }

    roomCode = data.roomCode;
    totalPlayers = data.playerCount || 0;
    sessionStorage.setItem('hostRoomCode', roomCode);

    if (data.status === 'waiting') {
        socket.emit('host:start-game');
    }

    if (data.question) {
        currentCorrectAnswerId = data.question.correctAnswerId || null;
        renderQuestion(data.question);
    }
});

socket.on('game:question', (data) => {
    currentCorrectAnswerId = null;
    renderQuestion(data);
});

socket.on('game:question-host', (data) => {
    currentCorrectAnswerId = data.correctAnswerId || null;
});

socket.on('game:player-answered', (data) => {
    if (playersAnswered) {
        playersAnswered.textContent = `Players Answered: ${data.playersAnswered} / ${data.totalPlayers}`;
    }
});

socket.on('game:times-up', (data) => {
    totalPlayers = data.totalPlayers || totalPlayers;
    showResults(data);
});

socket.on('game:ended', (data) => {
    clearInterval(timerId);

    // Hide question elements
    if (questionNum) {
        questionNum.style.display = 'none';
    }
    if (playersAnswered) {
        playersAnswered.style.display = 'none';
    }
    if (timerText) {
        timerText.style.display = 'none';
    }
    if (nextButton) {
        nextButton.style.display = 'none';
    }
    updateQuestionImage(null);

    // Hide answer grid
    answerElements.forEach((element) => {
        if (element) {
            element.style.display = 'none';
        }
    });

    // Update question text to show Game Over with quiz title
    if (questionText) {
        questionText.textContent = '🏆 Game Over!';
        questionText.style.marginTop = '60px';
        questionText.style.marginBottom = '20px';
    }

    // Add quiz title if available
    const quizTitle = data.quizTitle;
    if (quizTitle) {
        const titleElement = document.createElement('h3');
        titleElement.id = 'game-over-subtitle';
        titleElement.textContent = quizTitle;
        titleElement.style.cssText = 'text-align: center; color: rgba(255,255,255,0.9); font-size: 1.8rem; font-weight: 600; margin-bottom: 40px; font-family: "Raleway", sans-serif;';
        if (questionText && questionText.parentNode) {
            questionText.parentNode.insertBefore(titleElement, questionText.nextSibling);
        }
    }

    // Show leaderboard title and winners
    const winnerTitle = document.getElementById('winnerTitle');
    if (winnerTitle) {
        winnerTitle.textContent = 'Final Leaderboard';
        winnerTitle.style.display = 'block';
    }

    // Show winner elements
    const winners = [
        document.getElementById('winner1'),
        document.getElementById('winner2'),
        document.getElementById('winner3'),
        document.getElementById('winner4'),
        document.getElementById('winner5')
    ];

    winners.forEach((element) => {
        if (element) {
            element.style.display = 'block';
        }
    });

    // Play winner celebration sound
    if (typeof audioManager !== 'undefined') {
        audioManager.play('winner');
    }

    // Update leaderboard with scores
    updateLeaderboard(data.leaderboard || [], true);

    // Add game over actions
    const actionsContainer = document.createElement('div');
    actionsContainer.id = 'game-over-actions';
    actionsContainer.style.cssText = 'text-align: center; margin-top: 40px;';

    const playAgainBtn = document.createElement('button');
    playAgainBtn.textContent = 'Play Again';
    playAgainBtn.onclick = () => location.reload();
    playAgainBtn.style.cssText = 'margin: 0 10px; padding: 15px 30px; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; background: white; color: var(--color-background); font-weight: 700; font-family: "Raleway", sans-serif;';

    const dashboardBtn = document.createElement('button');
    dashboardBtn.textContent = 'Back to Dashboard';
    dashboardBtn.onclick = () => location.href = '/admin';
    dashboardBtn.style.cssText = 'margin: 0 10px; padding: 15px 30px; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; background: rgba(255,255,255,0.2); color: white; font-weight: 700; font-family: "Raleway", sans-serif; border: 2px solid white;';

    actionsContainer.appendChild(playAgainBtn);
    actionsContainer.appendChild(dashboardBtn);

    const winner5 = document.getElementById('winner5');
    if (winner5 && winner5.parentNode) {
        winner5.parentNode.insertBefore(actionsContainer, winner5.nextSibling);
    }
});

function nextQuestion() {
    socket.emit('host:next-question');
}

function toggleMute() {
    if (typeof audioManager === 'undefined') {
        return;
    }

    const muted = audioManager.toggleMute();
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
        muteBtn.textContent = muted ? '🔇' : '🔊';
    }
    localStorage.setItem('audioMuted', muted);
}

// Restore mute preference on load
window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('audioMuted') === 'true' && typeof audioManager !== 'undefined') {
        audioManager.toggleMute();
        const muteBtn = document.getElementById('mute-btn');
        if (muteBtn) {
            muteBtn.textContent = '🔇';
        }
    }
});
