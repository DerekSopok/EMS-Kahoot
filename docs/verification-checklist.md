# Verification Checklist

## Runtime Smoke Test

1. Run the server (`npm start`).
2. Load `http://localhost:3000/api/quizzes` and confirm quiz data returns.
3. Create a room from the host screen.
4. Join with at least two players.
5. Start the quiz and answer at least one question.
6. Confirm scoring and leaderboard updates after each question.

## Manual Admin API Checks (JSON Persistence)

1. `GET /api/admin/quizzes` and confirm the list loads.
2. `POST /api/admin/quizzes` to create a quiz; verify the response JSON includes the new quiz ID.
3. `PUT /api/admin/quizzes/:id` to update metadata; verify the response reflects the change.
4. `DELETE /api/admin/quizzes/:id` to remove the quiz; confirm it is removed from subsequent `GET` calls.
5. Confirm `db/seeds/quizzes.json` persisted the create/update/delete changes.

## Rollback Plan

- Create and keep a rollback tag before altering JSON storage behavior (e.g., `git tag -a pre-json-storage <commit>`).
- If needed, reset to the tag and restore the prior build scripts (migrate/seed) referenced in archived notes.
