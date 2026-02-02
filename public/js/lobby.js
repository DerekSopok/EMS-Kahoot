const socket = io();

socket.on('connect', () => {
    const params = new URLSearchParams(window.location.search);
    const displayName = params.get('name');
    const roomCode = params.get('pin');

    if (!displayName || !roomCode) {
        window.location.href = '../';
        return;
    }

    socket.emit('player:join-room', {
        displayName,
        roomCode
    });
});

socket.on('player:join-room', (data) => {
    if (!data?.success) {
        window.location.href = '../';
        return;
    }

    sessionStorage.setItem('playerId', data.playerId);
    sessionStorage.setItem('playerRoomCode', data.roomCode);
    sessionStorage.setItem('playerName', data.playerName);
});

socket.on('game:question', () => {
    const roomCode = sessionStorage.getItem('playerRoomCode');
    if (!roomCode) {
        window.location.href = '../';
        return;
    }
    window.location.href = `/player/game/?roomCode=${encodeURIComponent(roomCode)}`;
});

socket.on('room:host-disconnect', () => {
    window.location.href = '../';
});

