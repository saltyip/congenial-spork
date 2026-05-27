import express from 'express';
import pool from '../db.js';
import authHandler from '../middleware/authHandler.js';
import toBase62 from '../services/shortener.js';
import { getCachedUrl, setCachedUrl, invalidateCache } from '../services/urlCache.js';
import validateUrl from '../validators/urlValidator.js';

const router = express.Router();

// @desc    Create a shortened URL
// @route   POST /api/urls
// @access  Private
router.post('/', authHandler, async (req, res, next) => {
    const client = await pool.connect();
    try {
        const userId = req.user.user_id;

        if (!req.body || !req.body.org) {
            const err = new Error('Request body must include "org" (original URL)');
            err.status = 400;
            return next(err);
        }

        if (!validateUrl(req.body.org)) {
            const err = new Error('Invalid URL. Must be a valid http or https URL.');
            err.status = 400;
            return next(err);
        }

        // Optional custom short code
        if (req.body.custom) {
            if (!/^[a-zA-Z0-9_-]{3,20}$/.test(req.body.custom)) {
                const err = new Error('Custom code must be 3-20 alphanumeric characters, hyphens, or underscores');
                err.status = 400;
                return next(err);
            }
            const taken = await pool.query('SELECT id FROM urls WHERE short_code = $1', [req.body.custom]);
            if (taken.rows.length > 0) {
                const err = new Error('Custom short code already taken');
                err.status = 409;
                return next(err);
            }
        }

        // Optional expiration (ttl in hours)
        let expiresAt = null;
        if (req.body.ttl) {
            const ttlHours = parseInt(req.body.ttl);
            if (isNaN(ttlHours) || ttlHours < 1) {
                const err = new Error('TTL must be a positive number of hours');
                err.status = 400;
                return next(err);
            }
            expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
        }

        await client.query('BEGIN');

        const insertQuery = 'INSERT INTO urls (user_id, original_url, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id, original_url) DO NOTHING RETURNING id;';
        const insertResult = await client.query(insertQuery, [userId, req.body.org, expiresAt]);

        // URL already exists for this user
        if (insertResult.rows.length === 0) {
            const existing = await client.query(
                'SELECT * FROM urls WHERE original_url = $1 AND user_id = $2',
                [req.body.org, userId]
            );
            await client.query('COMMIT');
            return res.status(200).json({ msg: existing.rows[0] });
        }

        const id = insertResult.rows[0].id;
        const shortCode = req.body.custom || toBase62(id);
        const result = await client.query(
            'UPDATE urls SET short_code = $1 WHERE id = $2 RETURNING *;',
            [shortCode, id]
        );
        await client.query('COMMIT');
        res.status(201).json({ msg: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
            return res.status(409).json({ msg: 'URL or short code already exists' });
        }
        next(err);
    } finally {
        client.release();
    }
});

// @desc    Get all URLs for the authenticated user (paginated)
// @route   GET /api/urls
// @access  Private
router.get('/', authHandler, async (req, res, next) => {
    try {
        const userId = req.user.user_id;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;

        const countResult = await pool.query('SELECT COUNT(*) FROM urls WHERE user_id = $1', [userId]);
        const total = parseInt(countResult.rows[0].count);

        const result = await pool.query(
            'SELECT * FROM urls WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
            [userId, limit, offset]
        );

        res.status(200).json({
            data: result.rows,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (err) {
        next(err);
    }
});

// @desc    Get click stats for a short code
// @route   GET /api/urls/stats/:code
// @access  Public
router.get('/stats/:code', async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT short_code, clicks, created_at FROM urls WHERE short_code = $1',
            [req.params.code]
        );
        if (result.rows.length === 0) {
            const err = new Error('Short code not found');
            err.status = 404;
            return next(err);
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// @desc    Delete a shortened URL (owner only)
// @route   DELETE /api/urls/:code
// @access  Private
router.delete('/:code', authHandler, async (req, res, next) => {
    try {
        const userId = req.user.user_id;
        const result = await pool.query(
            'DELETE FROM urls WHERE short_code = $1 AND user_id = $2 RETURNING *;',
            [req.params.code, userId]
        );

        if (result.rows.length === 0) {
            const err = new Error('Short code not found or you do not own it');
            err.status = 404;
            return next(err);
        }

        await invalidateCache(req.params.code);
        res.status(200).json({ msg: 'Deleted', data: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

export default router;
