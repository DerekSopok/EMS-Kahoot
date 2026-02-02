# Admin API Documentation

## Authentication
All `/api/admin/*` endpoints require the `X-Admin-Token` header.

## Endpoints

### Quizzes
- `GET /api/admin/quizzes` - List all quizzes
- `GET /api/admin/quizzes/:id` - Get quiz details
- `POST /api/admin/quizzes` - Create quiz
- `PUT /api/admin/quizzes/:id` - Update quiz
- `DELETE /api/admin/quizzes/:id` - Delete quiz

### Questions
- `POST /api/admin/quizzes/:id/questions` - Add question
- `PUT /api/admin/quizzes/:quizId/questions/:questionId` - Update question
- `DELETE /api/admin/quizzes/:quizId/questions/:questionId` - Delete question
- `PUT /api/admin/quizzes/:id/questions/reorder` - Reorder questions

### Categories
- `GET /api/admin/categories` - List categories

## Request/Response Examples

### List quizzes (summary)
```bash
curl -X GET http://localhost:3000/api/admin/quizzes \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```
Response:
```json
[
  {
    "id": 1,
    "title": "Cardiac Emergencies Q1",
    "description": "Rapid rhythm recognition.",
    "category": "Cardiac Emergencies",
    "questionCount": 12,
    "createdAt": "2026-02-04T19:48:00.000Z"
  }
]
```

### Get quiz detail
```bash
curl -X GET http://localhost:3000/api/admin/quizzes/1 \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```
Response:
```json
{
  "id": 1,
  "title": "Cardiac Emergencies Q1",
  "description": "Rapid rhythm recognition.",
  "category": "Cardiac Emergencies",
  "questions": [
    {
      "id": 1,
      "question_text": "What rhythm is this?",
      "time_limit": 30,
      "points": 1000,
      "order_index": 1,
      "answer_options": [
        { "id": 1, "option_text": "Sinus Rhythm", "is_correct": false, "order_index": 1 },
        { "id": 2, "option_text": "Atrial Fibrillation", "is_correct": true, "order_index": 2 }
      ]
    }
  ]
}
```

### Create quiz
```bash
curl -X POST http://localhost:3000/api/admin/quizzes \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d '{"title":"Test Quiz","category":"Cardiac Emergencies","description":"QA draft"}'
```
Response:
```json
{
  "id": 5,
  "title": "Test Quiz",
  "description": "QA draft",
  "category": "Cardiac Emergencies",
  "questions": []
}
```

### Update quiz
```bash
curl -X PUT http://localhost:3000/api/admin/quizzes/5 \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d '{"title":"Test Quiz v2","description":"Updated description"}'
```

### Delete quiz
```bash
curl -X DELETE http://localhost:3000/api/admin/quizzes/5 \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```
Response:
```json
{ "success": true }
```

### Add question
```bash
curl -X POST http://localhost:3000/api/admin/quizzes/1/questions \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d '{
    "question_text": "What rhythm is this?",
    "time_limit": 30,
    "points": 1000,
    "answer_options": [
      { "option_text": "Sinus Rhythm", "is_correct": false },
      { "option_text": "Atrial Fibrillation", "is_correct": true },
      { "option_text": "Ventricular Tachycardia", "is_correct": false },
      { "option_text": "Asystole", "is_correct": false }
    ]
  }'
```

### Update question
```bash
curl -X PUT http://localhost:3000/api/admin/quizzes/1/questions/2 \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d '{
    "question_text": "Updated question text",
    "answer_options": [
      { "option_text": "Option A", "is_correct": false },
      { "option_text": "Option B", "is_correct": true }
    ]
  }'
```

### Delete question
```bash
curl -X DELETE http://localhost:3000/api/admin/quizzes/1/questions/2 \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```
Response:
```json
{ "success": true }
```

### Reorder questions
```bash
curl -X PUT http://localhost:3000/api/admin/quizzes/1/questions/reorder \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d '{ "questionIds": [3, 1, 2] }'
```

### List categories
```bash
curl -X GET http://localhost:3000/api/admin/categories \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```
