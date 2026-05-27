import { createClient } from 'redis';

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

redisClient.on('error', (err) => {
    console.error('Redis error:', err.message);
});

try {
    await redisClient.connect();
    console.log('Redis connected');
} catch (err) {
    console.error('Redis connection failed (app will continue without cache):', err.message);
}

export default redisClient;
