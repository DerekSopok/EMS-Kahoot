const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const githubService = require('../services/githubService');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../public/images/questions');
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `question-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.has(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: jpg, jpeg, png, gif, webp'));
        }
    }
});

router.post('/images', upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Image file is required' });
        }

        const imagePath = `/images/questions/${req.file.filename}`;
        const commitResult = await githubService.commitImage(req.file.path, imagePath);
        if (commitResult?.error) {
            console.warn('Image committed locally but failed to sync to GitHub.');
        }

        res.json({
            success: true,
            url: imagePath,
            filename: req.file.filename
        });
    } catch (error) {
        next(error);
    }
});

router.delete('/images/:filename', async (req, res, next) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(uploadDir, filename);

    try {
        await fs.unlink(filePath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ error: 'Image not found' });
        }
        return next(error);
    }

    try {
        const imagePath = `/images/questions/${filename}`;
        const deleteResult = await githubService.deleteImage(imagePath);
        if (deleteResult?.error) {
            console.warn('Image deleted locally but failed to delete in GitHub.');
        }
    } catch (error) {
        console.warn('GitHub delete failed:', error.message);
    }

    res.json({ success: true });
});

router.use((error, req, res, next) => {
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    return next();
});

module.exports = router;
