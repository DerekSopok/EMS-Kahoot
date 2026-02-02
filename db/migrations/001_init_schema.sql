-- EMS Kahoot Database Schema (Legacy/Archived)
-- Migration 001: Initial Schema
-- NOTE: This file is retained for reference only and is not used in production.

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    category VARCHAR(100),
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'multiple_choice',
    image_url TEXT,
    time_limit INTEGER DEFAULT 20,
    points INTEGER DEFAULT 1000,
    order_index INTEGER NOT NULL,
    UNIQUE(quiz_id, order_index)
);

-- Answer options table
CREATE TABLE IF NOT EXISTS answer_options (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT false,
    order_index INTEGER NOT NULL,
    UNIQUE(question_id, order_index)
);

-- Game sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    host_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    room_code VARCHAR(6) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'waiting',
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    socket_id VARCHAR(255),
    total_score INTEGER DEFAULT 0,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player answers table
CREATE TABLE IF NOT EXISTS player_answers (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    selected_option_id INTEGER REFERENCES answer_options(id) ON DELETE SET NULL,
    is_correct BOOLEAN DEFAULT false,
    response_time_ms INTEGER,
    points_earned INTEGER DEFAULT 0,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quizzes_creator ON quizzes(creator_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_category ON quizzes(category);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_answer_options_question ON answer_options(question_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_quiz ON game_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_room_code ON game_sessions(room_code);
CREATE INDEX IF NOT EXISTS idx_players_session ON players(session_id);
CREATE INDEX IF NOT EXISTS idx_player_answers_player ON player_answers(player_id);
CREATE INDEX IF NOT EXISTS idx_player_answers_question ON player_answers(question_id);
