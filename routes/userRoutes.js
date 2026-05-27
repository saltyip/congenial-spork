import express from 'express';
import pool from '../db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import hashing_logic from '../servicehandler/bcrypthandler.js';
import loginlimiter from '../middleware/rateLimiter.js';

const router = express.Router();

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
router.post('/register', async (req, res, next) => {
    try {
        if (!req.body || !req.body.username || !req.body.password) {
            const err = new Error('Username and password are required');
            err.status = 400;
            return next(err);
        }

        if (req.body.password.length < 8) {
            const err = new Error('Password must be at least 8 characters');
            err.status = 400;
            return next(err);
        }

        const hashedpass = await hashing_logic(req.body.password);
        await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at;',
            [req.body.username, hashedpass]
        );
        res.status(201).json({ msg: `User "${req.body.username}" created` });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ msg: 'Username already exists' });
        }
        next(err);
    }
});

// @desc    Login a user
// @route   POST /api/users/login
// @access  Public
router.post('/login', loginlimiter, async (req, res, next) => {
    try {
        if (!req.body || !req.body.username || !req.body.password) {
            const err = new Error('Username and password are required');
            err.status = 400;
            return next(err);
        }

        const check_result = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [req.body.username]
        );

        if (!check_result.rows.length) {
            // Use generic message to avoid user enumeration
            return res.status(401).json({ msg: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(req.body.password, check_result.rows[0].password_hash);
        if (!valid) {
            return res.status(401).json({ msg: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { user_id: check_result.rows[0].id },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.status(200).json({ msg: 'Login successful', token });
    } catch (err) {
        next(err);
    }
});

export default router;
