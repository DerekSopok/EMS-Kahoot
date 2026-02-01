# GitHub Copilot / Codex Instructions

## Before Starting

1. **Read AGENT_CONTEXT.md** - Check current project state
2. **Read ROADMAP.md** - See what phase we're in
3. **Check git status** - Verify your branch and uncommitted changes
4. **Review recent commits** - Understand what was just done

## Project Overview

**EMS Kahoot** is a real-time multiplayer quiz game for Emergency Medical Services training.

**Tech Stack**:
- Node.js + Express.js (backend)
- Socket.IO (real-time communication)
- PostgreSQL (database - migrating from MongoDB)
- Vanilla JavaScript (frontend - removing jQuery)
- Render.com (hosting)

## Code Style Guidelines

### JavaScript Standards
```javascript
// ✅ Good: Modern ES6+, async/await
const fetchQuiz = async (quizId) => {
  try {
    const result = await db.query('SELECT * FROM quizzes WHERE id = $1', [quizId]);
    return result.rows[0];
  } catch (error) {
    console.error(`Error fetching quiz ${quizId}:`, error);
    throw error;
  }
};

// ❌ Bad: Callbacks, var, poor naming
var getQ = function(id, cb) {
  db.query('SELECT * FROM quizzes WHERE id = ' + id, function(e, r) {
    cb(e, r);
  });
};
```

### Conventions
- **Use**: const/let, arrow functions, template literals, async/await
- **Avoid**: var, callbacks, string concatenation
- **Functions**: Under 50 lines, single responsibility
- **Names**: Descriptive (getUserById not gU)
- **Comments**: Explain WHY, not WHAT

## Database (PostgreSQL)

### Always Use Parameterized Queries
```javascript
// ✅ Safe from SQL injection
const users = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [userEmail]
);

// ❌ NEVER DO THIS - SQL injection vulnerability!
const users = await db.query(
  `SELECT * FROM users WHERE email = '${userEmail}'`
);
```

### Use Transactions for Multi-Step Operations
```javascript
const client = await db.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO quizzes ...');
  await client.query('INSERT INTO questions ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## Socket.IO Events

### Event Naming Convention
- Use kebab-case: `player-join`, `host-start-game`
- Be descriptive: `answer-submitted` not `ans`
- Prefix by role when needed: `host-*`, `player-*`

### Always Validate Input
```javascript
socket.on('player-join', (data) => {
  // Validate all inputs
  if (!data.pin || typeof data.pin !== 'string') {
    return socket.emit('error', { message: 'Invalid game pin' });
  }

  if (!data.name || data.name.length > 50) {
    return socket.emit('error', { message: 'Invalid player name' });
  }

  // Process event...
});
```

## Git Commit Messages

Use conventional commits:

```
feat: add user authentication system
fix: resolve scoring calculation bug
docs: update README with deployment steps
refactor: convert server.js to async/await
test: add unit tests for quiz model
chore: update npm dependencies
```

## File Structure

```
server/
├── server.js           # Main server file
├── config/
│   └── db.js          # Database connection
├── models/            # Database models
├── routes/            # API routes
├── utils/             # Helper functions
└── middleware/        # Express middleware

public/
├── index.html
├── css/
└── js/
```

## Common Tasks

### Adding a New Database Table
1. Create migration file: `db/migrations/00X_table_name.sql`
2. Create model file: `server/models/TableName.js`
3. Update ARCHITECTURE.md with schema

### Adding a New API Endpoint
1. Create/update route file in `server/routes/`
2. Add authentication middleware if needed
3. Validate all inputs
4. Use parameterized queries
5. Handle errors properly

### Adding a New Socket.IO Event
1. Add event handler in `server/server.js`
2. Validate input data
3. Update game state if needed
4. Emit response events
5. Handle errors and edge cases

## Security Checklist

Before committing:
- [ ] Input validation on all user data
- [ ] Parameterized database queries
- [ ] Authentication/authorization checks
- [ ] No sensitive data in logs
- [ ] No secrets in code (use .env)
- [ ] Error messages don't leak info

## Testing Checklist

Before marking feature complete:
- [ ] Host flow works
- [ ] Player flow works
- [ ] Invalid inputs handled
- [ ] Disconnections handled
- [ ] Works on mobile
- [ ] No console errors

## Before Ending Session

**CRITICAL STEPS**:

1. Run `git status` - commit all changes
2. Update `AGENT_CONTEXT.md` with:
   - What you completed
   - Current commit hash
   - Next steps
   - Any blockers
3. Update `CHANGELOG.md` under [Unreleased]
4. Update `ROADMAP.md` - check off completed tasks
5. Push to GitHub: `git push -u origin <branch-name>`
6. Tag if completing milestone: `git tag v0.x.0`

## EMS Content Guidelines

### Question Quality
- **Clear**: No ambiguous wording
- **Accurate**: Verify medical facts with protocols
- **Realistic**: Based on real scenarios
- **Educational**: Include learning value

### Medical Accuracy
- Reference NREMT standards
- Cite local/national protocols
- Partner with subject matter experts
- Include disclaimers (training tool, not medical advice)

## Helpful Commands

```bash
# Database
npm run migrate        # Run migrations
npm run seed          # Seed database

# Development
npm run dev           # Start with nodemon
npm start             # Start server

# Git
git status
git add .
git commit -m "feat: description"
git push -u origin branch-name
git tag v0.1.0
git push --tags
```

## Resources

- AGENT_CONTEXT.md - Current state
- ARCHITECTURE.md - System design
- ROADMAP.md - Development phases
- CHANGELOG.md - Version history

## Common Patterns

### Error Handling
```javascript
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  console.error('Operation failed:', error);
  throw new Error('User-friendly error message');
}
```

### Socket.IO Response
```javascript
socket.on('event-name', async (data) => {
  try {
    // Validate
    if (!data.required) {
      return socket.emit('error', { message: 'Missing required field' });
    }

    // Process
    const result = await doSomething(data);

    // Respond
    socket.emit('success', { data: result });
  } catch (error) {
    socket.emit('error', { message: 'Something went wrong' });
  }
});
```

### Database Query
```javascript
const getQuizzesByUser = async (userId) => {
  const query = `
    SELECT q.*, COUNT(s.id) as times_played
    FROM quizzes q
    LEFT JOIN game_sessions s ON q.id = s.quiz_id
    WHERE q.created_by = $1
    GROUP BY q.id
    ORDER BY q.created_at DESC
  `;

  const result = await db.query(query, [userId]);
  return result.rows;
};
```

---

**Remember**: Clean, maintainable code > clever code. The next developer should be able to understand your code easily.
