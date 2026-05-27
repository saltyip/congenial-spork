import express from 'express';
import pool from '../db.js';
import { getCachedUrl, setCachedUrl } from '../services/urlCache.js';

const router = express.Router();

// @desc    Redirect short code to original URL
// @route   GET /:code
// @access  Public
router.get('/:code', async (req, res, next) => {
    try {
        const code = req.params.code;

        // Try cache first
        const cached = await getCachedUrl(code);
        if (cached) {
            // Increment clicks in background (fire-and-forget)
            pool.query('UPDATE urls SET clicks = clicks + 1 WHERE short_code = $1', [code]);
            return res.redirect(301, cached);
        }

        // Cache miss — hit the database
        const result = await pool.query(
            'SELECT original_url, expires_at FROM urls WHERE short_code = $1',
            [code]
        );

        if (result.rows.length === 0) {
            const err = new Error('Short code not found');
            err.status = 404;
            return next(err);
        }

        const { original_url, expires_at } = result.rows[0];

        // Check expiration
        if (expires_at && new Date(expires_at) < new Date()) {
            const err = new Error('This link has expired');
            err.status = 410; // 410 Gone
            return next(err);
        }

        // Cache for next time
        await setCachedUrl(code, original_url);

        // Increment clicks
        await pool.query('UPDATE urls SET clicks = clicks + 1 WHERE short_code = $1', [code]);

        res.redirect(301, original_url);
    } catch (err) {
        next(err);
    }
});

export default router;
