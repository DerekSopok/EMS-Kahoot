const socket = io();
const params = new URLSearchParams(window.location.search);
const quizId = Number(params.get('quizId'));

const gamePinText = document.getElementById('gamePinText');
const playersList = document.getElementById('players');
const startButton = document.getElementById('start');

let roomCode = '';

if (startButton) {
    startButton.disabled = true;
}

const updatePlayerList = (players = []) => {
    if (!playersList) {
        return;
    }

    playersList.value = players.map(player => player.name).join('\n');
};

socket.on('connect', () => {
    if (!quizId) {
        window.location.href = '/create/';
        return;
    }

    socket.emit('host:create-room', { quizId });
});

socket.on('host:create-room', (data) => {
    if (!data?.success) {
        window.location.href = '/create/';
        return;
    }

    roomCode = data.roomCode;
    sessionStorage.setItem('hostRoomCode', roomCode);

    if (gamePinText) {
        gamePinText.textContent = roomCode;
    }

    if (startButton) {
        startButton.disabled = false;
    }
});

socket.on('room:player-joined', (data) => {
    updatePlayerList(data?.players || []);
});

socket.on('room:player-left', (data) => {
    updatePlayerList(data?.players || []);
});

function startGame() {
    if (!roomCode) {
        return;
    }

    window.location.href = `/host/game/?roomCode=${encodeURIComponent(roomCode)}`;
}

function endGame() {
    window.location.href = '/';
}
