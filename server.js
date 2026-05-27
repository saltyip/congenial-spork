import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import logger from './middleware/logger.js';
import errorhandler from './middleware/errorhandler.js';
import urlRoutes from './routes/urlRoutes.js';
import userRoutes from './routes/userRoutes.js';
import redirectRoute from './routes/redirectRoute.js';
import pool from './db.js';
import redisClient from './redisClient.js';

// Validate required env vars on startup
const REQUIRED_ENV = ['JWT_SECRET'];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`FATAL: Missing required environment variable: ${key}`);
        process.exit(1);
    }
}

const app = express();
const PORT = process.env.PORT || 8000;

// Security & parsing
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(logger);

// Health check
app.get('/health', async (req, res) => {
    const health = { status: 'ok', uptime: process.uptime() };

    try {
        await pool.query('SELECT 1');
        health.db = 'connected';
    } catch {
        health.db = 'disconnected';
        health.status = 'degraded';
    }

    try {
        if (redisClient.isOpen) {
            await redisClient.ping();
            health.redis = 'connected';
        } else {
            health.redis = 'disconnected';
            health.status = 'degraded';
        }
    } catch {
        health.redis = 'disconnected';
        health.status = 'degraded';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
});

// API routes
app.use('/api/urls', urlRoutes);
app.use('/api/users', userRoutes);

// Root-level redirect (must be after API routes)
app.use('/', redirectRoute);

// 404 handler
app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// Error handler
app.use(errorhandler);

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

// Graceful shutdown
const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
        try { await pool.end(); } catch { /* ignore */ }
        try { await redisClient.quit(); } catch { /* ignore */ }
        console.log('Cleanup complete. Exiting.');
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));