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

const updateLeaderboard = (leaderboard) => {
    const winners = [
        document.getElementById('winner1'),
        document.getElementById('winner2'),
        document.getElementById('winner3'),
        document.getElementById('winner4'),
        document.getElementById('winner5')
    ];

    winners.forEach((element, index) => {
        if (!element) {
            return;
        }
        const entry = leaderboard[index];
        if (entry) {
            element.textContent = `${index + 1}. ${entry.name}`;
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
    if (questionText) {
        questionText.textContent = 'GAME OVER';
    }
    updateQuestionImage(null);
    if (timerText) {
        timerText.style.display = 'none';
    }
    if (playersAnswered) {
        playersAnswered.textContent = '';
    }
    if (nextButton) {
        nextButton.style.display = 'none';
    }

    // Play winner celebration sound
    if (typeof audioManager !== 'undefined') {
        audioManager.play('winner');
    }

    updateLeaderboard(data.leaderboard || []);
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
