#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const quizzesPath = path.join(__dirname, '..', 'db', 'seeds', 'quizzes.json');

function fail(message) {
  throw new Error(message);
}

function assertType(value, type, message) {
  if (type === 'array') {
    if (!Array.isArray(value)) {
      fail(message);
    }
    return;
  }

  if (typeof value !== type) {
    fail(message);
  }
}

function assertHas(obj, field, type) {
  if (!(field in obj)) {
    fail(`Missing required field "${field}".`);
  }
  assertType(obj[field], type, `Field "${field}" must be a ${type}.`);
}

function validateAnswerOption(option, pathLabel) {
  assertHas(option, 'option_text', 'string');
  assertHas(option, 'is_correct', 'boolean');
  assertHas(option, 'order_index', 'number');

  if (typeof option.option_text !== 'string' || option.option_text.trim() === '') {
    fail(`${pathLabel}.option_text cannot be empty.`);
  }
}

function validateQuestion(question, index, quizId) {
  const pathLabel = `Quiz ${quizId} question[${index}]`;

  assertHas(question, 'id', 'number');
  assertHas(question, 'question_text', 'string');
  assertHas(question, 'question_type', 'string');
  assertHas(question, 'time_limit', 'number');
  assertHas(question, 'points', 'number');
  assertHas(question, 'order_index', 'number');
  assertHas(question, 'answer_options', 'array');

  if (question.answer_options.length === 0) {
    fail(`${pathLabel} must include at least one answer option.`);
  }

  question.answer_options.forEach((option, optionIndex) =>
    validateAnswerOption(option, `${pathLabel} answer_options[${optionIndex}]`)
  );
}

function validateQuiz(quiz, index) {
  const pathLabel = `Quiz[${index}]`;

  assertHas(quiz, 'id', 'number');
  assertHas(quiz, 'title', 'string');
  assertHas(quiz, 'description', 'string');
  assertHas(quiz, 'category', 'string');
  assertHas(quiz, 'is_public', 'boolean');
  assertHas(quiz, 'questions', 'array');

  if (quiz.questions.length === 0) {
    fail(`${pathLabel} must include at least one question.`);
  }

  quiz.questions.forEach((question, questionIndex) =>
    validateQuestion(question, questionIndex, quiz.id)
  );
}

function main() {
  if (!fs.existsSync(quizzesPath)) {
    fail(`Seed file not found: ${quizzesPath}`);
  }

  const data = JSON.parse(fs.readFileSync(quizzesPath, 'utf8'));
  assertType(data, 'array', 'Root quizzes data must be an array.');

  data.forEach((quiz, index) => validateQuiz(quiz, index));

  console.log(`✓ Validated ${data.length} quiz(zes) in ${quizzesPath}`);
}

try {
  main();
} catch (error) {
  console.error(`Seed validation failed: ${error.message}`);
  process.exit(1);
}
