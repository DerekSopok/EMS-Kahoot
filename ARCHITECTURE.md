# EMS Kahoot — System Architecture

## System Overview

EMS Kahoot is a real-time multiplayer quiz game designed for EMS (Emergency Medical Services) training. It follows a host-player model where one educator hosts a game and multiple students join via unique game pins.

## System Diagram

```
┌─────────────┐
│   Host UI   │ (Educator - displays questions, controls game flow)
│  (Browser)  │
└──────┬──────┘
       │
       │ Socket.IO (real-time)
       │
┌──────▼──────────────────────────┐
│      Express + Socket.IO        │
│         Server                  │
│   (Node.js + Express)           │
└──────┬──────────────────────────┘
       │
       ├─────────────┬──────────────┬─────────────┐
       │             │              │             │
┌──────▼──────┐ ┌───▼────┐  ┌──────▼──────┐ ┌───▼───────────┐
│  Player 1   │ │Player 2│  │  Player N   │ │ Quiz JSON     │
│  (Mobile)   │ │(Mobile)│  │   (Mobile)  │ │ (quizzes.json)│
└─────────────┘ └────────┘  └─────────────┘ └───────────────┘
```

## Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time Communication**: Socket.IO v2.1.1
- **Data Storage**: JSON file (`db/seeds/quizzes.json`) via `quizService`

### Frontend
- **Host Interface**: HTML, CSS, JavaScript (Vanilla)
- **Player Interface**: Mobile-responsive HTML/CSS/JS

### Hosting
- **Platform**: Render.com (free tier)
- **Database**: None (JSON file storage)

#### Render Build/Start Commands
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Notes**: Legacy Postgres migration/seed scripts are archived and should not be part of the build pipeline.

## Architecture

### Data Flow
- Quiz data: `db/seeds/quizzes.json` → `quizService` → API/Socket
- Game sessions: In-memory via `GameManager`
- Players: In-memory via `GameManager`

### Socket Events
- Handler: `src/socket/events.js`
- Game state: `src/socket/gameManager.js`
- Events: `host:create-room`, `host:join-room`, `player:join-room`, `player:rejoin-room`, etc.

### Removed (Legacy)
- MongoDB integration (deprecated)
- Legacy socket flow (`connection-legacy`)
- `server/utils/*` (consolidated into GameManager)

## Data Storage Contract (Current)

EMS Kahoot stores quiz content in a committed JSON seed file and keeps all live game state in memory:

- **Persistent (committed to GitHub):** `db/seeds/quizzes.json` contains quiz definitions, questions, and answer options.
- **Ephemeral (in-memory only):** game sessions, players, player answers, and leaderboards live in the Socket.IO game manager (`src/socket/gameManager.js`).
- **Users:** user accounts are not persisted in the current implementation (no user storage is active).

### Table-to-Storage Mapping

| Former DB Table | Current Storage |
| --- | --- |
| `quizzes`, `questions`, `answer_options` | `db/seeds/quizzes.json` (persistent JSON) |
| `game_sessions`, `players`, `player_answers` | In-memory maps in `src/socket/gameManager.js` |
| `users` | Not persisted (out of scope for current storage) |

### Data Lifecycle

- **Survives deploys:** Quiz content in `db/seeds/quizzes.json` (tracked in Git).
- **Ephemeral:** Active sessions, player state, answers, and leaderboards reset on server restart.

### Target State (PostgreSQL)

#### users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'educator', -- 'educator' or 'admin'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### quizzes
```sql
CREATE TABLE quizzes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  difficulty_level VARCHAR(50), -- 'EMT-Basic', 'EMT-Advanced', 'Paramedic'
  created_by INTEGER REFERENCES users(id),
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### questions
```sql
CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_order INTEGER NOT NULL,
  image_url VARCHAR(500), -- For ECG strips, etc.
  time_limit INTEGER DEFAULT 20, -- seconds
  points INTEGER DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### answer_options
```sql
CREATE TABLE answer_options (
  id SERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  option_order INTEGER NOT NULL -- 1-4
);
```

#### game_sessions
```sql
CREATE TABLE game_sessions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER REFERENCES quizzes(id),
  game_pin VARCHAR(6) UNIQUE NOT NULL,
  host_id INTEGER REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'lobby', -- 'lobby', 'active', 'completed'
  current_question INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### players
```sql
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_name VARCHAR(100) NOT NULL,
  socket_id VARCHAR(100),
  total_score INTEGER DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### player_answers
```sql
CREATE TABLE player_answers (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id),
  selected_answer INTEGER REFERENCES answer_options(id),
  is_correct BOOLEAN,
  time_taken INTEGER, -- milliseconds
  points_earned INTEGER DEFAULT 0,
  answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Socket.IO Events

### Host Events

**Emitted by Host:**
- `host:create-room` - Create a room for a quiz
  - Payload: `{ quizId }`
  - Response: `{ success, roomCode, quizTitle, questionCount }`
- `host:join-room` - Rejoin an existing room after navigation
  - Payload: `{ roomCode }`
  - Response: `{ success, status, players, question? }`
- `host:start-game` - Start the game
- `host:next-question` - Advance to the next question
- `host:times-up` - Mark time as up for the current question
- `host:end-game` - End the game and emit final leaderboard
- `host:get-leaderboard` - Request the current leaderboard

**Received by Host:**
- `room:player-joined` - Player list updates
- `room:player-left` - Player list updates
- `game:question-host` - Question data with correct answer
- `game:player-answered` - Answer count updates
- `game:times-up` - Correct answer + leaderboard
- `game:ended` - Final leaderboard

### Player Events

**Emitted by Player:**
- `player:join-room` - Join a room from the lobby
  - Payload: `{ roomCode, displayName }`
  - Response: `{ success, playerId }`
- `player:rejoin-room` - Rejoin an existing room after navigation
  - Payload: `{ roomCode, playerId }`
  - Response: `{ success, status, question? }`
- `player:submit-answer` - Submit an answer
  - Payload: `{ answerId, responseTime }`
- `player:leave` - Leave the room

**Received by Player:**
- `game:question` - Question data (no correct answer)
- `player:answer-result` - Answer feedback and updated score
- `game:times-up` - Correct answer + leaderboard
- `game:ended` - Final leaderboard
- `room:host-disconnect` - Host left game

### Shared Events
- `disconnect` - Socket disconnection (automatic)

## API Endpoints (Future)

### Authentication
- `POST /api/auth/register` - Create educator account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Quizzes
- `GET /api/quizzes` - List all quizzes
- `GET /api/quizzes/:id` - Get quiz details
- `POST /api/quizzes` - Create quiz
- `PUT /api/quizzes/:id` - Update quiz
- `DELETE /api/quizzes/:id` - Delete quiz

### Questions
- `POST /api/quizzes/:id/questions` - Add question
- `PUT /api/questions/:id` - Update question
- `DELETE /api/questions/:id` - Delete question

### Game Sessions
- `GET /api/sessions/:pin` - Get session info
- `GET /api/sessions/:id/results` - Get game results

## File Structure

```
EMS-Kahoot/
├── server/
│   ├── server.js                 # Main server file
│   └── middleware/
│       └── adminAuth.js          # Admin token middleware
├── src/
│   ├── socket/
│   │   ├── events.js             # Socket.IO event handlers
│   │   └── gameManager.js        # In-memory game/session manager
│   └── services/
│       └── quizService.js        # JSON quiz storage
├── public/
│   ├── index.html               # Home page
│   ├── host/                    # Host lobby + game pages
│   ├── player/                  # Player lobby + game pages
│   ├── css/
│   └── js/
│       ├── hostLobby.js
│       ├── hostGameView.js
│       ├── playerGame.js
│       ├── lobby.js
│       └── create.js
├── db/
│   └── seeds/                   # Seed data
│       └── quizzes.json
├── .agent-instructions/         # AI agent handoff files
├── package.json
└── README.md
```

## Key Design Decisions

### Real-time Architecture
- Socket.IO handles all game state synchronization
- Server maintains authoritative game state
- Clients receive updates via event broadcasting

### Game State Management
- In-memory storage for active games and players via `GameManager`
- JSON file for persistent quiz data via `quizService`

### Security Considerations
- Validate all client inputs
- Rate limit Socket.IO connections
- Sanitize quiz content to prevent XSS
- Implement CORS properly for Socket.IO

### Scalability Notes
- Current architecture: Single server instance
- Future: Redis for shared session state across instances
- Future: Message queue for async tasks (image processing, etc.)

## Migration Path (JSON → PostgreSQL)

1. Create PostgreSQL schema
2. Write migration script for existing quiz data in `db/seeds/quizzes.json`
3. Update server.js to use PostgreSQL client
4. Replace quizService reads/writes with pg queries
5. Test all game flows
6. Deploy with database backup strategy

## EMS-Specific Features (Planned)

### Question Types
- Multiple choice (current)
- True/False
- Scenario-based (multi-step)
- Image-based (ECG strips, trauma photos)

### Difficulty Tagging
- EMT-Basic
- EMT-Intermediate
- Paramedic
- Continuing Education

### Content Areas
- Airway Management
- Cardiology
- Trauma
- Medical Emergencies
- Pharmacology
- Protocols

### Analytics (Future)
- Question difficulty analysis
- Common wrong answers
- Student performance tracking
- Protocol reference links
