# Seed data layout

This directory contains JSON seed files used by the legacy seed runner (`seed.js`).

## Files

- `quizzes.json`: Required. Array of quiz objects matching the quiz/question/answer option format used by the app.
- `metadata.json` (optional): Reserved for future metadata (e.g., source attribution, versioning, or import notes).
- `users.json` (optional): Reserved for future user fixtures (e.g., default creators or demo accounts).

`seed.js` currently consumes **only** `quizzes.json`.

## Quick structure overview

```json
[
  {
    "id": 1,
    "title": "Quiz title",
    "description": "Short summary",
    "category": "Category name",
    "is_public": true,
    "questions": [
      {
        "id": 1,
        "question_text": "Question text",
        "question_type": "multiple_choice",
        "time_limit": 20,
        "points": 1000,
        "order_index": 1,
        "answer_options": [
          {
            "option_text": "Option A",
            "is_correct": false,
            "order_index": 1
          }
        ]
      }
    ]
  }
]
```

For full field documentation, see `docs/seed-data-format.md`.
