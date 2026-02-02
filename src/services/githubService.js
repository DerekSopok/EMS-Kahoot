const fetch = require('node-fetch');

class GitHubService {
    constructor() {
        this.token = process.env.GITHUB_TOKEN;
        this.owner = process.env.GITHUB_OWNER || 'DerekSopok';
        this.repo = process.env.GITHUB_REPO || 'EMS-Kahoot';
        this.branch = process.env.GITHUB_BRANCH || 'Production';
        this.apiBase = 'https://api.github.com';
    }

    async commitQuizzesFile(quizzesData, commitMessage) {
        if (!this.token) {
            console.warn('GITHUB_TOKEN not set - skipping commit');
            return { skipped: true };
        }

        try {
            const filePath = 'db/seeds/quizzes.json';
            const content = JSON.stringify(quizzesData, null, 2);
            const contentBase64 = Buffer.from(content).toString('base64');
            const fileUrl = this.apiBase + '/repos/' + this.owner + '/' + this.repo + '/contents/' + filePath;

            // Get current file SHA if it exists
            const getResponse = await fetch(fileUrl + '?ref=' + this.branch, {
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            let sha = null;
            if (getResponse.ok) {
                const fileData = await getResponse.json();
                sha = fileData.sha;
            }

            // Create or update the file
            const commitData = {
                message: commitMessage,
                content: contentBase64,
                branch: this.branch
            };
            if (sha) commitData.sha = sha;

            const putResponse = await fetch(fileUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(commitData)
            });

            if (!putResponse.ok) {
                const errorText = await putResponse.text();
                throw new Error('GitHub API error: ' + putResponse.statusText + ' - ' + errorText);
            }

            const result = await putResponse.json();
            console.log('✓ Committed to GitHub: ' + commitMessage);
            return result;
        } catch (error) {
            console.error('✗ GitHub commit failed:', error.message);
            return { error: true, message: error.message };
        }
    }

    generateCommitMessage(action, quizTitle = '') {
        const timestamp = new Date().toISOString();
        switch (action) {
            case 'create':
                return 'feat: add quiz "' + quizTitle + '" [' + timestamp + ']';
            case 'update':
                return 'chore: update quiz "' + quizTitle + '" [' + timestamp + ']';
            case 'delete':
                return 'chore: delete quiz "' + quizTitle + '" [' + timestamp + ']';
            default:
                return 'chore: update quizzes.json [' + timestamp + ']';
        }
    }
}

module.exports = new GitHubService();
