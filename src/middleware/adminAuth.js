function adminAuth(req, res, next) {
    const adminToken = process.env.ADMIN_TOKEN;
    const token = req.headers['x-admin-token'];

    if (!adminToken || !token || token !== adminToken) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    return next();
}

module.exports = adminAuth;
