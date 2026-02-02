const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

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

    async commitQuizzes(quizzesData, commitMessage) {
        return this.commitQuizzesFile(quizzesData, commitMessage);
    }

    async commitImage(localPath, repoPath) {
        if (!this.token) {
            console.warn('GITHUB_TOKEN not set - skipping image commit');
            return { skipped: true };
        }

        try {
            const content = await fs.readFile(localPath);
            const contentBase64 = Buffer.from(content).toString('base64');
            const sanitizedRepoPath = repoPath.replace(/^\//, '');
            const fileUrl = this.apiBase + '/repos/' + this.owner + '/' + this.repo + '/contents/' + sanitizedRepoPath;

            const commitData = {
                message: 'image: add ' + path.basename(repoPath),
                content: contentBase64,
                branch: this.branch
            };

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
            console.log('✓ Committed image to GitHub: ' + repoPath);
            return result;
        } catch (error) {
            console.error('✗ GitHub image commit failed:', error.message);
            return { error: true, message: error.message };
        }
    }

    async deleteImage(repoPath) {
        if (!this.token) {
            console.warn('GITHUB_TOKEN not set - skipping image delete');
            return { skipped: true };
        }

        try {
            const sanitizedRepoPath = repoPath.replace(/^\//, '');
            const fileUrl = this.apiBase + '/repos/' + this.owner + '/' + this.repo + '/contents/' + sanitizedRepoPath;
            const getResponse = await fetch(fileUrl + '?ref=' + this.branch, {
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!getResponse.ok) {
                const errorText = await getResponse.text();
                throw new Error('GitHub API error: ' + getResponse.statusText + ' - ' + errorText);
            }

            const fileData = await getResponse.json();

            const deleteResponse = await fetch(fileUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'image: delete ' + path.basename(repoPath),
                    sha: fileData.sha,
                    branch: this.branch
                })
            });

            if (!deleteResponse.ok) {
                const errorText = await deleteResponse.text();
                throw new Error('GitHub API error: ' + deleteResponse.statusText + ' - ' + errorText);
            }

            const result = await deleteResponse.json();
            console.log('✓ Deleted image from GitHub: ' + repoPath);
            return result;
        } catch (error) {
            console.error('✗ GitHub image delete failed:', error.message);
            return { error: true, message: error.message };
        }
    }

    generateCommitMessage(action, quizTitle = '') {
        switch (action) {
            case 'create':
                return 'quiz: create "' + quizTitle + '"';
            case 'update':
                return 'quiz: update "' + quizTitle + '"';
            case 'delete':
                return 'quiz: delete "' + quizTitle + '"';
            case 'add-question':
                return 'quiz: add question to "' + quizTitle + '"';
            case 'update-question':
                return 'quiz: update question in "' + quizTitle + '"';
            case 'delete-question':
                return 'quiz: delete question from "' + quizTitle + '"';
            case 'reorder-questions':
                return 'quiz: reorder questions in "' + quizTitle + '"';
            default:
                return 'quiz: update "' + quizTitle + '"';
        }
    }
}

module.exports = new GitHubService();
