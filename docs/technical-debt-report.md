# Technical Debt Report — Pre-Phase 2 Review

Date: 2026-02-03

## Scope Reviewed

- `src/socket/gameManager.js` — in-memory session management
- `src/socket/events.js` — Socket.IO event handlers
- `src/services/quizService.js` — quiz CRUD operations
- `server/` — legacy code still in use?
- `public/` — frontend code organization

## Findings (Prioritized)

### Critical (Fix Before Phase 2)

1. **Admin APIs are unauthenticated**
   - **Files**: `server/server.js`, `public/admin/admin.js`, `public/admin/questions.js`
   - **Risk**: Any user can create/update/delete quizzes (data loss + defacement risk).
   - **Effort**: Medium
   - **Suggested fix**: Add authentication middleware for `/api/admin/*` routes (token, basic auth, or session). Tie admin UI to authenticated session or signed token.

2. **XSS risk in legacy UIs**
   - **Files**: `public/js/hostGame.js`, `public/js/create.js`
   - **Risk**: Quiz content is rendered with `innerHTML`, allowing stored XSS from quiz data.
   - **Effort**: Medium
   - **Status**: Resolved by removing legacy host UI and consolidating to the modern socket flow.

3. **Legacy socket flow likely broken**
   - **Files**: `server/server.js`, `public/js/host.js`, `public/js/hostGame.js`
   - **Risk**: Host game view still depends on legacy events that are attached to a non-standard `connection-legacy` handler, likely never triggered. This leaves old host flow nonfunctional or inconsistent.
   - **Effort**: Medium
   - **Status**: Resolved by removing legacy socket handlers and host UI files.

### High Priority (Fix During Phase 2)

1. **In-memory sessions without TTL or persistence**
   - **Files**: `src/socket/gameManager.js`
   - **Risk**: Sessions are lost on restart; memory can grow indefinitely; no multi-instance scaling.
   - **Effort**: Medium
   - **Suggested fix**: Add room TTL cleanup and/or persist sessions in Redis (even a simple TTL cleanup helps on Render free tier).

2. **Race condition in answer tracking**
   - **Files**: `src/socket/gameManager.js`
   - **Risk**: Removing a player doesn’t clear `playersAnswered`, causing premature or stalled `allPlayersAnswered` triggers.
   - **Effort**: Small
   - **Suggested fix**: Remove player from `playersAnswered` when they disconnect; guard `allPlayersAnswered` logic to exclude disconnected players.

3. **Socket input validation gaps**
   - **Files**: `src/socket/events.js`, `src/socket/gameManager.js`
   - **Risk**: Malformed `answerId`, `responseTime`, or name inputs can crash flows or allow score manipulation.
   - **Effort**: Medium
   - **Suggested fix**: Validate types and bounds (`answerId` exists on current question, `responseTime` <= time limit, `displayName` length constraints, room code format).

4. **Quiz storage concurrency risks**
   - **Files**: `src/services/quizService.js`
   - **Risk**: JSON file read/write on every request without locking can drop updates under concurrency.
   - **Effort**: Medium
   - **Suggested fix**: Add a write queue/lock or cache with write-through; eventually migrate to a DB or durable store.

5. **Dual source of truth for quizzes**
   - **Files**: `server/server.js`, `src/services/quizService.js`
   - **Risk**: Legacy MongoDB code previously existed while new JSON service was active; unclear data authority.
   - **Effort**: Medium
   - **Status**: Resolved by removing MongoDB references and keeping JSON storage as the source of truth.

### Medium Priority (After Phase 2)

1. **Magic numbers scattered across code**
   - **Files**: `src/socket/gameManager.js`, `src/services/quizService.js`, `server/server.js`
   - **Risk**: Hard to tune gameplay; inconsistent defaults.
   - **Effort**: Small
   - **Suggested fix**: Centralize game configuration constants (max players, time limit defaults, scoring).

2. **Mixed legacy vs. new socket event naming**
   - **Files**: `src/socket/events.js`
   - **Risk**: Harder to maintain and evolve; deprecations unclear.
   - **Effort**: Medium
   - **Suggested fix**: Define a socket event contract and deprecate old names with timeline.

3. **Front-end organization is legacy-heavy**
   - **Files**: `public/js/*.js`
   - **Risk**: Globals + direct DOM manipulation make change risky.
   - **Effort**: Medium
   - **Suggested fix**: Modularize front-end by feature or migrate to a modern framework.

### Low Priority (Backlog)

1. **README is outdated (MongoDB-centric)**
   - **Files**: `README.md`
   - **Risk**: Developer onboarding issues.
   - **Effort**: Small
   - **Status**: Resolved with JSON-only setup instructions.

## Architecture Notes

- The legacy socket flow has been removed; Socket.IO handlers live in `src/socket/events.js`.
- Quiz data is served from `db/seeds/quizzes.json` via `quizService`.

## Testing Gaps

- Only Playwright smoke tests exist (`tests/smoke.spec.ts`).
- No unit tests for `GameManager` or `quizService` and no socket integration tests.
- Recommended test additions:
  - Unit tests for `GameManager` (room lifecycle, scoring, answer tracking).
  - Unit tests for `quizService` CRUD and question reorder (including concurrency simulation).
  - Socket integration tests with `socket.io-client` to validate flows and input validation.

## Security Review Summary

- Admin endpoints are unauthenticated.
- Legacy UIs render untrusted data via `innerHTML`.
- Socket events lack robust validation.
- GitHub commit service uses env token; ensure scope is minimal and logs do not expose secrets.

## Performance Review Summary

- JSON quizzes are read/written on each request with no caching or locking.
- Game sessions are in-memory only; no TTL cleanup; no horizontal scaling.
