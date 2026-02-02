# Quiz seed data format

This document describes the JSON structure expected by the seed data in `db/seeds/quizzes.json`.
The goal is to keep compatibility with the existing quiz format while making field intent explicit.

## Top-level structure

`quizzes.json` is an array of quiz objects.

```json
[
  { "id": 1, "title": "...", "questions": ["..."] }
]
```

## Quiz object

Required fields:

| Field | Type | Description |
| --- | --- | --- |
| `id` | number | Unique quiz identifier in the seed file. |
| `title` | string | Quiz title shown to hosts/players. |
| `description` | string | Short summary of the quiz. |
| `category` | string | Category or tag (e.g., "Trauma", "Cardiology"). |
| `is_public` | boolean | Whether the quiz should be visible to all users. |
| `questions` | array | List of question objects (see below). |

Optional fields (preserved for compatibility):

| Field | Type | Description |
| --- | --- | --- |
| `created_at` | string (ISO-8601) | Optional creation timestamp. |

## Question object

Required fields:

| Field | Type | Description |
| --- | --- | --- |
| `id` | number | Unique question identifier within the quiz. |
| `question_text` | string | Text shown to players. |
| `question_type` | string | Question type (e.g., `multiple_choice`). |
| `time_limit` | number | Time limit in seconds. |
| `points` | number | Points awarded for a correct answer. |
| `order_index` | number | Display order within the quiz. |
| `answer_options` | array | List of answer option objects. |

Optional fields:

| Field | Type | Description |
| --- | --- | --- |
| `image_url` | string | Optional image associated with the question. |

## Answer option object

Required fields:

| Field | Type | Description |
| --- | --- | --- |
| `option_text` | string | Answer option text. |
| `is_correct` | boolean | Whether the option is correct. |
| `order_index` | number | Display order within the option list. |

## Optional companion files

The seed directory supports optional files for future expansion (not currently consumed):

- `metadata.json`: place to store seed provenance, version, or notes.
- `users.json`: potential fixture data for demo users or creators.

## Optional validation tooling

If you want a lightweight schema check without extra dependencies, run:

```bash
node scripts/validate-seeds.js
```

This script validates the required fields in `db/seeds/quizzes.json` and exits non-zero if the
JSON shape is invalid. It is optional and not wired into the runtime.
