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

    // Update player count
    const playerCountEl = document.getElementById('player-count');
    if (playerCountEl) {
        playerCountEl.textContent = players.length;
    }
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

    // Generate QR code with join URL
    const joinUrl = `${window.location.origin}/?code=${roomCode}`;

    // Display base URL (without protocol)
    const baseUrlEl = document.getElementById('base-url');
    if (baseUrlEl) {
        const hostname = window.location.hostname;
        const port = window.location.port;
        baseUrlEl.textContent = port ? `${hostname}:${port}` : hostname;
    }

    // Generate QR code
    const qrCanvas = document.getElementById('qr-code');
    if (qrCanvas) {
        if (typeof QRCode === 'undefined') {
            console.error('QRCode library not loaded');
            qrCanvas.style.display = 'none';
            return;
        }

        try {
            QRCode.toCanvas(qrCanvas, joinUrl, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#46178F',  // Kahoot purple
                    light: '#FFFFFF'
                }
            }, function(error) {
                if (error) {
                    console.error('QR Code generation error:', error);
                    qrCanvas.style.display = 'none';
                } else {
                    console.log('QR Code generated successfully for:', joinUrl);
                }
            });
        } catch (error) {
            console.error('QR Code exception:', error);
            qrCanvas.style.display = 'none';
        }
    } else {
        console.error('QR canvas element not found');
    }

    // Show join URL below QR
    const joinUrlEl = document.getElementById('join-url');
    if (joinUrlEl) {
        joinUrlEl.textContent = joinUrl;
    }

    // Play lobby music when room is created
    if (typeof audioManager !== 'undefined') {
        audioManager.playMusic('lobbyMusic');
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

    // Stop lobby music and play countdown when game starts
    if (typeof audioManager !== 'undefined') {
        audioManager.stopMusic();
        audioManager.play('countdown');
    }

    window.location.href = `/host/game/?roomCode=${encodeURIComponent(roomCode)}`;
}

function endGame() {
    window.location.href = '/';
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
