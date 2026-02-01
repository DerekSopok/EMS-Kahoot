# EMS Kahoot Game Engine

Real-time multiplayer quiz game engine built with Socket.IO and PostgreSQL.

## Features

- ✅ Real-time multiplayer quiz gameplay
- ✅ Supports up to 20 players per room
- ✅ 6-character room codes for easy joining
- ✅ Speed-based scoring system (500-1000 points per question)
- ✅ Live leaderboard updates
- ✅ PostgreSQL database integration
- ✅ Host controls (start, next question, end game)
- ✅ Player disconnect handling

## Architecture

### Core Components

1. **GameManager** (`src/socket/gameManager.js`)
   - Room state management
   - Player tracking
   - Answer submission and scoring
   - Leaderboard generation

2. **Socket Events** (`src/socket/events.js`)
   - Real-time event handlers
   - Host and player communication
   - Database queries for quiz data

3. **Scoring System** (`src/utils/scoring.js`)
   - Point calculation based on speed
   - Leaderboard sorting
   - Formula: `points = 1000 * (1 - (responseTime / timeLimit) * 0.5)`

## Socket.IO Events

### Host Events

#### `host:create-room`
Create a new game room.

**Emit:**
```javascript
socket.emit('host:create-room', {
    quizId: 1
});
```

**Response:**
```javascript
socket.on('host:create-room', (data) => {
    // data = { success: true, roomCode: "ABC123", quizTitle: "...", questionCount: 10 }
});
```

#### `host:start-game`
Start the game and send first question to all players.

**Emit:**
```javascript
socket.emit('host:start-game');
```

**Broadcast:**
- `game:question` → All players (without correct answer)
- `game:question-host` → Host only (with correct answer)

#### `host:next-question`
Advance to the next question.

**Emit:**
```javascript
socket.emit('host:next-question');
```

**Broadcast:**
- `game:question` → All players
- `game:ended` → If no more questions

#### `host:end-game`
End the game immediately.

**Emit:**
```javascript
socket.emit('host:end-game');
```

**Broadcast:**
- `game:ended` → All players with final leaderboard

#### `host:times-up`
Mark current question time as expired.

**Emit:**
```javascript
socket.emit('host:times-up');
```

**Broadcast:**
- `game:times-up` → All players with correct answer and leaderboard

#### `host:get-leaderboard`
Request current leaderboard.

**Emit:**
```javascript
socket.emit('host:get-leaderboard');
```

**Response:**
```javascript
socket.on('game:leaderboard', (data) => {
    // data = { leaderboard: [...], questionNumber: 1, totalQuestions: 10 }
});
```

### Player Events

#### `player:join-room`
Join a game room.

**Emit:**
```javascript
socket.emit('player:join-room', {
    roomCode: "ABC123",
    displayName: "John Doe"
});
```

**Response:**
```javascript
socket.on('player:join-room', (data) => {
    // data = { success: true, roomCode: "ABC123", playerName: "John Doe" }
});
```

**Broadcast:**
- `room:player-joined` → All in room

#### `player:submit-answer`
Submit an answer to current question.

**Emit:**
```javascript
socket.emit('player:submit-answer', {
    answerId: 123,
    responseTime: 5000 // milliseconds
});
```

**Response:**
```javascript
socket.on('player:answer-result', (data) => {
    // data = { isCorrect: true, points: 750, totalScore: 1500 }
});
```

**Broadcast:**
- `game:player-answered` → All in room (progress update)
- `game:times-up` → If all players answered

#### `player:leave`
Leave the current room.

**Emit:**
```javascript
socket.emit('player:leave');
```

**Broadcast:**
- `room:player-left` → All in room

### Server Broadcast Events

#### `room:player-joined`
A player joined the room.

```javascript
socket.on('room:player-joined', (data) => {
    // data = { playerName: "John", playerCount: 5, players: [...] }
});
```

#### `room:player-left`
A player left the room.

```javascript
socket.on('room:player-left', (data) => {
    // data = { playerName: "John", playerCount: 4, players: [...] }
});
```

#### `game:question`
New question sent to players.

```javascript
socket.on('game:question', (data) => {
    // data = {
    //     questionIndex: 0,
    //     questionNumber: 1,
    //     totalQuestions: 10,
    //     questionText: "What is MARCH?",
    //     timeLimit: 20,
    //     answers: [
    //         { id: 1, text: "Massive hemorrhage", order: 0 },
    //         { id: 2, text: "Month", order: 1 },
    //         ...
    //     ]
    // }
});
```

#### `game:times-up`
Question time expired or all players answered.

```javascript
socket.on('game:times-up', (data) => {
    // data = {
    //     correctAnswerId: 1,
    //     correctAnswerText: "Massive hemorrhage",
    //     leaderboard: [...],
    //     playersAnswered: 5,
    //     totalPlayers: 5
    // }
});
```

#### `game:leaderboard`
Current standings.

```javascript
socket.on('game:leaderboard', (data) => {
    // data = {
    //     leaderboard: [
    //         { rank: 1, name: "John", score: 2500, socketId: "..." },
    //         { rank: 2, name: "Jane", score: 2300, socketId: "..." },
    //         ...
    //     ],
    //     questionNumber: 3,
    //     totalQuestions: 10
    // }
});
```

#### `game:ended`
Game finished with final results.

```javascript
socket.on('game:ended', (data) => {
    // data = {
    //     leaderboard: [...]
    // }
});
```

#### `room:host-disconnect`
Host disconnected, game ended.

```javascript
socket.on('room:host-disconnect', (data) => {
    // data = { message: "Host has disconnected. Game ended." }
});
```

## Scoring System

Points are calculated based on correctness and speed:

- **Base Points:** 1000
- **Formula:** `points = 1000 * (1 - (responseTime / timeLimit) * 0.5)`
- **Range:** 500-1000 points per correct answer
- **Incorrect:** 0 points

### Examples

| Response Time | Points Earned |
|--------------|---------------|
| 0s (instant) | 1000 pts      |
| 5s           | 875 pts       |
| 10s (50%)    | 750 pts       |
| 15s (75%)    | 625 pts       |
| 20s (full)   | 500 pts       |

## API Endpoints

### `GET /api/quizzes`
Get all public quizzes.

**Response:**
```json
[
    {
        "id": 1,
        "title": "EMT Trauma Assessment",
        "description": "...",
        "category": "EMS",
        "created_at": "2024-01-01T00:00:00.000Z",
        "question_count": 5
    }
]
```

### `GET /api/quizzes/:id`
Get a specific quiz with questions (without answers).

**Response:**
```json
{
    "id": 1,
    "title": "EMT Trauma Assessment",
    "questions": [
        {
            "id": 1,
            "question_text": "...",
            "time_limit": 20,
            "order_index": 0,
            "answer_count": 4
        }
    ]
}
```

## Database Schema

Uses PostgreSQL with the following tables:
- `quizzes` - Quiz metadata
- `questions` - Questions for each quiz
- `answer_options` - Answer choices (with correct flag)
- `game_sessions` - Active/completed game sessions
- `players` - Players in each session
- `player_answers` - Individual answers and scores

## Usage Example

### Host Flow
```javascript
// 1. Create room
socket.emit('host:create-room', { quizId: 1 });

// 2. Wait for players to join (listen to room:player-joined)

// 3. Start game
socket.emit('host:start-game');

// 4. After question time expires
socket.emit('host:times-up');

// 5. Show leaderboard, then next question
socket.emit('host:next-question');

// 6. Repeat 4-5 until all questions done

// 7. Game automatically ends or manually:
socket.emit('host:end-game');
```

### Player Flow
```javascript
// 1. Join room
socket.emit('player:join-room', {
    roomCode: "ABC123",
    displayName: "John Doe"
});

// 2. Wait for game to start (listen to game:question)

// 3. Submit answer
socket.emit('player:submit-answer', {
    answerId: 123,
    responseTime: 5000
});

// 4. See result (listen to player:answer-result)

// 5. Repeat 3-4 for each question

// 6. View final leaderboard (listen to game:ended)
```

## Configuration

Set environment variables in `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/ems_kahoot
NODE_ENV=development
PORT=3000
```

## Limits

- **Max players per room:** 20
- **Room code length:** 6 characters (alphanumeric)
- **Question time limit:** Configurable per question (default: 20s)
- **Points range:** 500-1000 per correct answer

## Future Enhancements

- [ ] Persist game sessions to database
- [ ] Player analytics and history
- [ ] Custom quiz creation UI
- [ ] Power-ups and bonuses
- [ ] Team mode
- [ ] Spectator mode
- [ ] Replay functionality
