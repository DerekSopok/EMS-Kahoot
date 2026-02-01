# Claude Code Instructions

## Before Starting ANY Session

1. **Read AGENT_CONTEXT.md FIRST** - This contains the current state of development
2. Check current branch with `git branch` and verify you're on the correct branch
3. Review recent commits with `git log -5 --oneline`
4. Check active task in ROADMAP.md
5. Review any blockers listed in AGENT_CONTEXT.md

## Project Context

This is **EMS Kahoot**, a multiplayer quiz game for Emergency Medical Services training. It's built on Node.js, Express, Socket.IO, and is migrating from MongoDB to PostgreSQL.

## Coding Standards

### JavaScript Style
- **ES6+ syntax only** - Use modern JavaScript features
- **Async/await** - Never use callbacks, always use async/await
- **Const/let** - Never use `var`
- **Template literals** - Use backticks for string interpolation
- **Arrow functions** - Prefer arrow functions for callbacks
- **Destructuring** - Use object/array destructuring where appropriate

### Code Organization
- **Small functions** - Keep functions under 50 lines
- **Single responsibility** - Each function should do one thing
- **Descriptive names** - Use clear, descriptive variable and function names
- **No magic numbers** - Use named constants

### Comments
- **Comment complex logic** - Explain WHY, not WHAT
- **Document functions** - Use JSDoc for public APIs
- **No redundant comments** - Code should be self-documenting where possible

### Error Handling
- **Always validate inputs** - Check all user inputs and socket events
- **Try/catch blocks** - Wrap async operations in try/catch
- **Meaningful errors** - Provide helpful error messages
- **Log errors** - Use console.error with context

### Example Good Code:
```javascript
// Good: Modern, clean, async/await
async function getQuizById(quizId) {
  try {
    const query = 'SELECT * FROM quizzes WHERE id = $1';
    const result = await db.query(query, [quizId]);

    if (result.rows.length === 0) {
      throw new Error(`Quiz not found: ${quizId}`);
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error fetching quiz:', error);
    throw error;
  }
}
```

### Example Bad Code:
```javascript
// Bad: Callbacks, var, poor naming
var getQuiz = function(id, cb) {
  db.query('SELECT * FROM quizzes WHERE id = $1', [id], function(err, res) {
    if(err) cb(err);
    cb(null, res.rows[0]);
  });
}
```

## Git Commit Standards

Use conventional commit format:

- **feat**: New feature
  - Example: `feat: add PostgreSQL connection module`

- **fix**: Bug fix
  - Example: `fix: resolve player disconnect issue`

- **docs**: Documentation changes
  - Example: `docs: update ARCHITECTURE.md with new schema`

- **refactor**: Code restructure without changing behavior
  - Example: `refactor: convert callbacks to async/await in server.js`

- **test**: Adding or updating tests
  - Example: `test: add unit tests for player scoring`

- **chore**: Maintenance tasks
  - Example: `chore: update dependencies`

- **style**: Code formatting (no logic change)
  - Example: `style: apply ESLint formatting`

### Commit Message Format:
```
<type>: <short description>

<optional detailed description>

<optional footer with issue references>
```

## Database Guidelines

### PostgreSQL Best Practices
- Use parameterized queries ($1, $2, etc.) - **NEVER** string concatenation
- Always use transactions for multi-step operations
- Index foreign keys and frequently queried columns
- Use SERIAL for auto-incrementing IDs

### Example:
```javascript
// Good: Parameterized query
const result = await db.query(
  'SELECT * FROM quizzes WHERE created_by = $1 AND is_public = $2',
  [userId, true]
);

// Bad: String concatenation (SQL injection risk!)
const result = await db.query(
  `SELECT * FROM quizzes WHERE created_by = ${userId}`
);
```

## Socket.IO Guidelines

### Event Naming
- Use kebab-case for event names: `player-join`, `host-disconnect`
- Be descriptive: `question-answered` not `qa`
- Prefix by role if needed: `host-start-game`, `player-submit-answer`

### Event Validation
Always validate socket event data:
```javascript
socket.on('player-join', async (data) => {
  // Validate input
  if (!data.pin || !data.name) {
    return socket.emit('error', { message: 'Invalid join data' });
  }

  if (data.name.length > 50) {
    return socket.emit('error', { message: 'Name too long' });
  }

  // Process event...
});
```

## Testing Approach

### Manual Testing Checklist
Before marking a feature complete, test:
- [ ] Host can create a game
- [ ] Players can join with correct pin
- [ ] Players cannot join with invalid pin
- [ ] Game starts when host clicks start
- [ ] Questions display correctly
- [ ] Answers are recorded correctly
- [ ] Scoring works accurately
- [ ] Disconnections are handled gracefully
- [ ] Mobile devices work properly

### Future: Automated Tests
When writing tests:
- Use Jest for unit tests
- Use Socket.IO client for integration tests
- Mock database calls in unit tests
- Test edge cases and error conditions

## File Organization

### When to Create New Files
- **Models**: Create one file per database table
- **Routes**: Group related endpoints (auth.js, quizzes.js)
- **Utils**: Create files for specific utilities (validation.js, auth.js)
- **Avoid**: Giant files over 500 lines - split them up

### Naming Conventions
- **Files**: camelCase.js or kebab-case.js (be consistent)
- **Classes**: PascalCase
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Database tables**: snake_case (e.g., game_sessions)

## Security Checklist

Before deploying ANY code:
- [ ] All inputs validated
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (sanitize HTML)
- [ ] Authentication implemented
- [ ] Authorization checked
- [ ] Rate limiting on sensitive endpoints
- [ ] Error messages don't leak sensitive info
- [ ] Dependencies updated (no known vulnerabilities)

## Before Ending Your Session

This is **CRITICAL** - always do these steps:

1. **Commit all changes** with clear commit messages
2. **Update AGENT_CONTEXT.md** with:
   - What you accomplished
   - Current commit hash
   - Next steps
   - Any blockers encountered
3. **Update CHANGELOG.md** under [Unreleased] section
4. **Update ROADMAP.md** - Check off completed tasks
5. **Push to GitHub** on the correct branch
6. **Create git tag** if completing a major feature (v0.x.0)

### Session Handoff Template:
Update AGENT_CONTEXT.md with:
```markdown
## Last Session Summary

**Date**: YYYY-MM-DD
**Agent**: Claude Code
**Branch**: your-branch-name
**Commit**: abc1234

**Completed**:
- Task 1
- Task 2

**In Progress**:
- Task 3 (50% complete)

**Blockers**:
- None / Or describe blocker

**Next Agent Should**:
1. Complete task 3
2. Start task 4
```

## Common Pitfalls to Avoid

1. **Don't refactor and add features in same commit** - Separate concerns
2. **Don't skip error handling** - Every async operation needs try/catch
3. **Don't hardcode values** - Use environment variables
4. **Don't trust client data** - Always validate
5. **Don't ignore TypeScript/JSDoc** - Document complex functions
6. **Don't leave console.logs** - Use proper logging
7. **Don't commit secrets** - Use .env files (and .gitignore them)
8. **Don't break existing functionality** - Test before committing

## EMS-Specific Guidelines

### Medical Content Accuracy
- **Partner with SMEs** - Don't guess on medical facts
- **Cite protocols** - Reference NREMT or local protocols
- **Update regularly** - Medical guidelines change
- **Disclaimer** - This is for training, not medical advice

### Question Quality
- **Clear and unambiguous** - No trick questions
- **Age-appropriate images** - Nothing too graphic
- **One correct answer** - No ambiguity
- **Realistic scenarios** - Based on real calls
- **Educational value** - Include learning points

## Resources

- [Node.js Docs](https://nodejs.org/docs/latest/api/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Socket.IO Docs](https://socket.io/docs/v4/)
- [PostgreSQL Manual](https://www.postgresql.org/docs/current/)
- [NREMT Exam Content](https://www.nremt.org/rwd/public)

## Questions?

If you're unsure:
1. Check ARCHITECTURE.md for design decisions
2. Check existing code patterns
3. Ask in AGENT_CONTEXT.md "Blockers" section
4. Default to simpler, more maintainable solution

---

**Remember**: This project helps train EMTs and Paramedics. Code quality matters because it impacts real medical education. Write code that the next developer (human or AI) will thank you for.
