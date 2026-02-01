# Google Gemini Instructions

## Initial Setup - Read These First

1. **AGENT_CONTEXT.md** - Current development state and session information
2. **ARCHITECTURE.md** - Complete system design and database schema
3. **ROADMAP.md** - Development phases and current tasks
4. **CHANGELOG.md** - Version history and recent changes

## Project Summary

**EMS Kahoot** is a multiplayer quiz application for Emergency Medical Services (EMT/Paramedic) training, similar to Kahoot but specialized for EMS education.

### Technology Stack
- **Backend**: Node.js v18+, Express.js v4
- **Real-time**: Socket.IO v2.1.1
- **Database**: PostgreSQL (migrating from MongoDB)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Hosting**: Render.com (free tier)

### Key Features
- Real-time multiplayer quiz gameplay
- Host (educator) controls game flow
- Players (students) join via game pins
- Question display with timer
- Scoring system with time bonuses
- Leaderboard at end of game

## Coding Standards

### Modern JavaScript (ES6+)

**Required Patterns**:
- ✅ `const` and `let` (never `var`)
- ✅ Arrow functions `() => {}`
- ✅ Template literals `` `Hello ${name}` ``
- ✅ Async/await for asynchronous code
- ✅ Destructuring `const { name, id } = user`
- ✅ Spread operator `{ ...object }`

**Example**:
```javascript
// ✅ GOOD: Modern, clean, maintainable
const createGameSession = async (quizId, hostId) => {
  const gamePin = generateGamePin();

  try {
    const query = `
      INSERT INTO game_sessions (quiz_id, host_id, game_pin)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await db.query(query, [quizId, hostId, gamePin]);
    return result.rows[0];
  } catch (error) {
    console.error('Failed to create game session:', error);
    throw new Error('Could not create game session');
  }
};

// ❌ BAD: Old style, callbacks, var
var createGame = function(quiz, host, cb) {
  var pin = Math.random() * 10000;
  db.query('INSERT INTO game_sessions VALUES (' + quiz + ',' + host + ',' + pin + ')', function(err, res) {
    if(err) return cb(err);
    cb(null, res);
  });
};
```

### Code Organization

**Function Size**: Keep functions under 50 lines. If longer, break into smaller functions.

**Single Responsibility**: Each function should do ONE thing well.

**Naming Conventions**:
- Variables and functions: `camelCase`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Database tables/columns: `snake_case`
- Files: `camelCase.js` or `kebab-case.js`

**Example**:
```javascript
// Good naming
const MAX_PLAYERS_PER_GAME = 50;
const getUserById = async (userId) => { /* ... */ };
class GameSession { /* ... */ }

// Bad naming
const x = 50;
const gU = async (id) => { /* ... */ };
class gamesession { /* ... */ }
```

## Database Guidelines (PostgreSQL)

### SQL Injection Prevention

**ALWAYS** use parameterized queries:

```javascript
// ✅ SAFE: Parameterized query
const result = await db.query(
  'SELECT * FROM users WHERE email = $1 AND active = $2',
  [email, true]
);

// ❌ DANGEROUS: String concatenation (SQL injection!)
const result = await db.query(
  `SELECT * FROM users WHERE email = '${email}'`
);
```

### Transaction Handling

For multi-step operations, use transactions:

```javascript
const createQuizWithQuestions = async (quizData, questions) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Insert quiz
    const quizResult = await client.query(
      'INSERT INTO quizzes (name, created_by) VALUES ($1, $2) RETURNING id',
      [quizData.name, quizData.userId]
    );

    const quizId = quizResult.rows[0].id;

    // Insert questions
    for (const question of questions) {
      await client.query(
        'INSERT INTO questions (quiz_id, question_text) VALUES ($1, $2)',
        [quizId, question.text]
      );
    }

    await client.query('COMMIT');
    return quizId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

## Socket.IO Guidelines

### Event Naming
- Use kebab-case: `player-join`, `host-start-game`, `question-answered`
- Be descriptive and clear
- Prefix by role if helpful: `host-*`, `player-*`

### Event Validation

**ALWAYS** validate socket event data:

```javascript
socket.on('player-join', async (data) => {
  // Input validation
  if (!data || typeof data !== 'object') {
    return socket.emit('error', { message: 'Invalid request format' });
  }

  if (!data.pin || !/^\d{5}$/.test(data.pin)) {
    return socket.emit('error', { message: 'Invalid game pin format' });
  }

  if (!data.name || data.name.length === 0 || data.name.length > 50) {
    return socket.emit('error', { message: 'Name must be 1-50 characters' });
  }

  // Sanitize input
  const sanitizedName = data.name.trim();

  // Process join logic...
  try {
    const game = await findGameByPin(data.pin);
    if (!game) {
      return socket.emit('error', { message: 'Game not found' });
    }

    await addPlayerToGame(game.id, socket.id, sanitizedName);
    socket.emit('join-success', { gameId: game.id });
  } catch (error) {
    console.error('Error in player-join:', error);
    socket.emit('error', { message: 'Failed to join game' });
  }
});
```

### Error Handling

Always handle errors gracefully and emit meaningful error messages to clients.

## Git Workflow

### Commit Message Format

Use conventional commits:

```
<type>: <description>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code change without adding features or fixing bugs
- `test`: Adding tests
- `chore`: Maintenance (dependencies, config, etc.)
- `style`: Code formatting only

**Examples**:
```
feat: add user authentication with JWT

fix: resolve player disconnection handling bug

docs: update ARCHITECTURE.md with Socket.IO events

refactor: convert MongoDB queries to PostgreSQL

test: add integration tests for quiz creation

chore: update Socket.IO to v4.5.0
```

### Branch Strategy

- Work on feature branch: `claude/setup-ems-kahoot-repo-c2EMQ`
- Commit frequently with clear messages
- Push regularly to backup work

## Error Handling Best Practices

### Try-Catch for Async Operations

```javascript
const fetchUserQuizzes = async (userId) => {
  try {
    const result = await db.query(
      'SELECT * FROM quizzes WHERE created_by = $1 ORDER BY created_at DESC',
      [userId]
    );

    if (result.rows.length === 0) {
      return []; // Return empty array, not error
    }

    return result.rows;
  } catch (error) {
    console.error(`Error fetching quizzes for user ${userId}:`, error);
    throw new Error('Failed to fetch user quizzes');
  }
};
```

### Meaningful Error Messages

```javascript
// ✅ Good: Helpful error message
throw new Error('Quiz ID must be a positive integer');

// ❌ Bad: Vague error message
throw new Error('Invalid input');
```

## Security Checklist

Before committing ANY code:

- [ ] **Input validation**: All user inputs validated
- [ ] **SQL injection**: Only parameterized queries used
- [ ] **XSS prevention**: User content sanitized before display
- [ ] **Authentication**: Protected routes check authentication
- [ ] **Authorization**: Users can only access their own data
- [ ] **Rate limiting**: Prevent abuse of endpoints
- [ ] **No secrets**: API keys and passwords in .env, not code
- [ ] **Dependencies**: No known vulnerabilities (`npm audit`)

## Testing Approach

### Manual Testing Workflow

Before completing a feature, test:

1. **Happy path**: Normal user flow works correctly
2. **Edge cases**: Empty inputs, max lengths, special characters
3. **Error cases**: Invalid data, network failures, disconnections
4. **Mobile**: Test on actual mobile device or emulator
5. **Multiple players**: Test with 2-3 simultaneous players

### Example Test Scenario

```markdown
Feature: Player joins game

✅ Valid pin + valid name → Player joins successfully
✅ Valid pin + empty name → Error: "Name required"
✅ Valid pin + 51-char name → Error: "Name too long"
❌ Invalid pin format → Error: "Invalid game pin"
❌ Valid pin but game doesn't exist → Error: "Game not found"
```

## EMS-Specific Guidelines

### Medical Content Accuracy

**CRITICAL**: This is a medical education tool. Accuracy is paramount.

- **Verify facts**: Cross-reference NREMT standards and protocols
- **Cite sources**: Reference protocols in question metadata
- **Subject matter experts**: Partner with EMTs/Paramedics for content review
- **Updates**: Medical guidelines change - plan for content updates
- **Disclaimer**: Include disclaimer that this is a training tool, not medical advice

### Question Quality Standards

Good EMS questions:
- ✅ Clear and unambiguous
- ✅ Single correct answer
- ✅ Realistic scenario
- ✅ Age-appropriate content
- ✅ Educational value (teaches something)
- ✅ Difficulty-appropriate for target level

Example:
```
Question: "A 45-year-old male is experiencing chest pain radiating to left arm,
diaphoresis, and shortness of breath. Vital signs: BP 150/90, HR 110, RR 22.
What is your FIRST priority?"

A) Administer aspirin
B) Obtain 12-lead ECG
C) Administer oxygen and assess SpO2
D) Transport immediately

Correct: C
Difficulty: EMT-Basic
Category: Cardiology
Protocol Reference: ACS Initial Assessment
```

## Session Handoff Protocol

### Before Ending Your Session

**MANDATORY STEPS**:

1. **Commit all changes**:
   ```bash
   git add .
   git commit -m "feat: descriptive message"
   ```

2. **Update AGENT_CONTEXT.md**:
   ```markdown
   ## Last Session
   - Agent: Google Gemini
   - Date: 2026-02-01
   - Commit: [git commit hash]
   - Completed: [list tasks]
   - In Progress: [current task]
   - Blockers: [any issues]
   - Next Steps: [what should happen next]
   ```

3. **Update CHANGELOG.md** under `[Unreleased]` section

4. **Update ROADMAP.md** - Check off completed tasks

5. **Push to GitHub**:
   ```bash
   git push -u origin claude/setup-ems-kahoot-repo-c2EMQ
   ```

6. **Tag milestone** (if completing a phase):
   ```bash
   git tag v0.1.0-handoff-system
   git push --tags
   ```

## Common Pitfalls to Avoid

1. ❌ **Mixing refactoring with new features** → Separate commits
2. ❌ **Skipping input validation** → Always validate user input
3. ❌ **String concatenation in SQL** → Use parameterized queries
4. ❌ **Trusting client data** → Server validates everything
5. ❌ **Hardcoding config** → Use environment variables
6. ❌ **Poor error messages** → Be specific and helpful
7. ❌ **Leaving debug logs** → Remove console.logs before commit
8. ❌ **Breaking existing features** → Test before committing

## Useful Commands

```bash
# Development
npm install              # Install dependencies
npm start                # Start server
npm run dev              # Start with nodemon (auto-reload)

# Database
npm run migrate          # Run database migrations
npm run seed             # Seed sample data

# Git
git status               # Check current status
git log -5 --oneline     # View recent commits
git branch               # Show current branch
git add .                # Stage all changes
git commit -m "message"  # Commit with message
git push -u origin branch-name  # Push to remote
git tag v0.1.0           # Create version tag
git push --tags          # Push tags

# Testing
npm test                 # Run tests (when implemented)
```

## Resources & Documentation

- **Project Docs**: AGENT_CONTEXT.md, ARCHITECTURE.md, ROADMAP.md
- **Node.js**: https://nodejs.org/docs/latest/api/
- **Express**: https://expressjs.com/en/guide/routing.html
- **Socket.IO**: https://socket.io/docs/v4/
- **PostgreSQL**: https://www.postgresql.org/docs/current/
- **NREMT**: https://www.nremt.org/ (EMS content standards)

## Questions or Blockers?

If you encounter issues:

1. Check ARCHITECTURE.md for design decisions
2. Review existing code for patterns
3. Document blocker in AGENT_CONTEXT.md
4. Provide context: what you tried, what failed, error messages
5. Suggest possible solutions if you have ideas

## Philosophy

Write code that:
- ✅ Works correctly
- ✅ Is easy to understand
- ✅ Is easy to maintain
- ✅ Follows project conventions
- ✅ Helps the next developer (human or AI)

**Remember**: This project helps train emergency medical professionals. Your code quality directly impacts medical education. Take pride in writing clean, maintainable, secure code.

---

**Good luck! You're contributing to a project that helps save lives through better EMS training.**
