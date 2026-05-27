import redisClient from '../redisClient.js';

const CACHE_TTL = 3600; // 1 hour in seconds
const PREFIX = 'url:';

export const getCachedUrl = async (shortCode) => {
    try {
        if (!redisClient.isOpen) return null;
        return await redisClient.get(`${PREFIX}${shortCode}`);
    } catch (err) {
        console.error('Redis cache GET error:', err.message);
        return null;
    }
};

export const setCachedUrl = async (shortCode, originalUrl) => {
    try {
        if (!redisClient.isOpen) return;
        await redisClient.set(`${PREFIX}${shortCode}`, originalUrl, { EX: CACHE_TTL });
    } catch (err) {
        console.error('Redis cache SET error:', err.message);
    }
};

export const invalidateCache = async (shortCode) => {
    try {
        if (!redisClient.isOpen) return;
        await redisClient.del(`${PREFIX}${shortCode}`);
    } catch (err) {
        console.error('Redis cache DEL error:', err.message);
    }
};
