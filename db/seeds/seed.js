/**
 * Legacy Postgres seed runner (archived).
 * This script is intentionally disabled in production.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

if (process.env.NODE_ENV === 'production') {
    console.error('Legacy seeds are disabled in production.');
    process.exit(1);
}

async function seedDatabase() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected successfully!');

        // Read quizzes data
        const quizzesPath = path.join(__dirname, 'quizzes.json');
        const quizzesData = JSON.parse(fs.readFileSync(quizzesPath, 'utf8'));

        console.log(`\nLoaded ${quizzesData.length} quiz(es) from quizzes.json`);

        // Clear existing quiz data (preserves users)
        console.log('\nClearing existing quiz data...');
        await client.query('DELETE FROM player_answers');
        await client.query('DELETE FROM players');
        await client.query('DELETE FROM game_sessions');
        await client.query('DELETE FROM answer_options');
        await client.query('DELETE FROM questions');
        await client.query('DELETE FROM quizzes');
        console.log('✓ Existing quiz data cleared');

        // Reset sequences
        await client.query('ALTER SEQUENCE quizzes_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE questions_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE answer_options_id_seq RESTART WITH 1');

        // Insert quizzes
        console.log('\nInserting quizzes...');
        for (const quizData of quizzesData) {
            console.log(`\n  Inserting quiz: "${quizData.title}"`);

            // Insert quiz
            const quizResult = await client.query(
                `INSERT INTO quizzes (title, description, category, is_public, creator_id)
                 VALUES ($1, $2, $3, $4, NULL)
                 RETURNING id`,
                [quizData.title, quizData.description, quizData.category, quizData.is_public]
            );
            const quizId = quizResult.rows[0].id;
            console.log(`    ✓ Quiz created with ID: ${quizId}`);

            // Insert questions
            console.log(`    Inserting ${quizData.questions.length} question(s)...`);
            for (const questionData of quizData.questions) {
                const questionResult = await client.query(
                    `INSERT INTO questions (quiz_id, question_text, question_type, image_url, time_limit, points, order_index)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     RETURNING id`,
                    [
                        quizId,
                        questionData.question_text,
                        questionData.question_type,
                        questionData.image_url || null,
                        questionData.time_limit,
                        questionData.points,
                        questionData.order_index
                    ]
                );
                const questionId = questionResult.rows[0].id;

                // Insert answer options
                for (const optionData of questionData.answer_options) {
                    await client.query(
                        `INSERT INTO answer_options (question_id, option_text, is_correct, order_index)
                         VALUES ($1, $2, $3, $4)`,
                        [
                            questionId,
                            optionData.option_text,
                            optionData.is_correct,
                            optionData.order_index
                        ]
                    );
                }
            }
            console.log(`    ✓ All questions and answer options inserted`);
        }

        // Display summary
        const quizCount = await client.query('SELECT COUNT(*) FROM quizzes');
        const questionCount = await client.query('SELECT COUNT(*) FROM questions');
        const optionCount = await client.query('SELECT COUNT(*) FROM answer_options');

        console.log('\n' + '='.repeat(50));
        console.log('Seeding Summary:');
        console.log('='.repeat(50));
        console.log(`Quizzes:        ${quizCount.rows[0].count}`);
        console.log(`Questions:      ${questionCount.rows[0].count}`);
        console.log(`Answer Options: ${optionCount.rows[0].count}`);
        console.log('='.repeat(50));
        console.log('\n✓ Database seeding completed successfully!');

    } catch (error) {
        console.error('\n✗ Seeding failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await client.end();
        console.log('Database connection closed.');
    }
}

// Load environment variables from .env file if it exists
if (fs.existsSync(path.join(__dirname, '../../.env'))) {
    require('dotenv').config({ path: path.join(__dirname, '../../.env') });
}

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    console.error('Please set DATABASE_URL in your .env file or environment');
    process.exit(1);
}

seedDatabase();
