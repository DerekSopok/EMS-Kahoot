const socket = io();
const params = new URLSearchParams(window.location.search);
const roomCode = params.get('roomCode') || sessionStorage.getItem('playerRoomCode');
const playerId = sessionStorage.getItem('playerId');
const playerName = sessionStorage.getItem('playerName');

const answerButtons = [
    document.getElementById('answer1'),
    document.getElementById('answer2'),
    document.getElementById('answer3'),
    document.getElementById('answer4')
];

let playerAnswered = false;
let questionStartTime = null;
let currentAnswerIds = [];

const messageEl = document.getElementById('message');
const nameText = document.getElementById('nameText');
const scoreText = document.getElementById('scoreText');

const showMessage = (text) => {
    if (messageEl) {
        messageEl.textContent = text;
        messageEl.style.display = 'block';
    }
};

const resetButtons = () => {
    answerButtons.forEach((button) => {
        if (button) {
            button.style.visibility = 'visible';
        }
    });
    if (messageEl) {
        messageEl.style.display = 'none';
    }
    document.body.style.backgroundColor = '#FFFFFF';
    playerAnswered = false;
};

const renderQuestion = (data) => {
    currentAnswerIds = Array.isArray(data.answers) ? data.answers.map(answer => answer.id) : [];
    answerButtons.forEach((button, index) => {
        if (button && data.answers && data.answers[index]) {
            button.textContent = data.answers[index].text;
        }
    });

    questionStartTime = Date.now();
    resetButtons();
};

socket.on('connect', () => {
    if (!roomCode || !playerId) {
        window.location.href = '../../';
        return;
    }

    socket.emit('player:rejoin-room', {
        roomCode,
        playerId
    });
});

socket.on('player:rejoin-room', (data) => {
    if (!data?.success) {
        window.location.href = '../../';
        return;
    }

    if (nameText) {
        nameText.textContent = `Name: ${data.playerName || playerName || ''}`;
    }

    if (scoreText) {
        scoreText.textContent = `Score: ${data.playerScore || 0}`;
    }

    if (data.question) {
        renderQuestion(data.question);
    }
});

function answerSubmitted(index) {
    if (playerAnswered || questionStartTime === null) {
        return;
    }

    const answerId = currentAnswerIds[index - 1];
    if (!answerId) {
        return;
    }

    const responseTime = Date.now() - questionStartTime;
    playerAnswered = true;

    socket.emit('player:submit-answer', {
        answerId,
        responseTime
    });

    answerButtons.forEach((button) => {
        if (button) {
            button.style.visibility = 'hidden';
        }
    });
    showMessage('Answer Submitted! Waiting on other players...');
}

socket.on('player:answer-result', (data) => {
    if (data?.isCorrect) {
        document.body.style.backgroundColor = '#4CAF50';
        showMessage('Correct!');
        // Play correct answer sound
        if (typeof audioManager !== 'undefined') {
            audioManager.play('correct');
        }
    } else {
        document.body.style.backgroundColor = '#f94a1e';
        showMessage('Incorrect!');
        // Play wrong answer sound
        if (typeof audioManager !== 'undefined') {
            audioManager.play('wrong');
        }
    }

    if (scoreText) {
        scoreText.textContent = `Score: ${data?.totalScore || 0}`;
    }
});

socket.on('game:question', (data) => {
    renderQuestion(data);
});

socket.on('game:times-up', () => {
    answerButtons.forEach((button) => {
        if (button) {
            button.style.visibility = 'hidden';
        }
    });
    if (!playerAnswered) {
        showMessage("Time's up!");
    }
});

socket.on('game:ended', () => {
    answerButtons.forEach((button) => {
        if (button) {
            button.style.visibility = 'hidden';
        }
    });
    showMessage('GAME OVER');
});

socket.on('room:host-disconnect', () => {
    window.location.href = '../../';
});

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
