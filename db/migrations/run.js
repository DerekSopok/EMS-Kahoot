const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected successfully!');

        // Get all SQL files in the migrations directory
        const migrationsDir = __dirname;
        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        console.log(`Found ${files.length} migration file(s)`);

        for (const file of files) {
            console.log(`\nRunning migration: ${file}`);
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            try {
                await client.query(sql);
                console.log(`✓ ${file} executed successfully`);
            } catch (error) {
                // If error is "already exists", it's okay
                if (error.message.includes('already exists')) {
                    console.log(`⊙ ${file} - tables already exist (skipped)`);
                } else {
                    throw error;
                }
            }
        }

        console.log('\n✓ All migrations completed successfully!');
    } catch (error) {
        console.error('\n✗ Migration failed:', error.message);
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

runMigrations();
