import getRedis from "../config/redis";
import getEnv from "../config/env";

export const REDIS_KEYS = {
  slotLock: (doctorId: string, date: string, startTime: string) =>
    `lock:slot:${doctorId}:${date}:${startTime}`,

  doctorSlots: (doctorId: string, date: string) =>
    `doctor:slots:${doctorId}:${date}`,

  doctorProfile: (doctorId: string) => `doctor:profile:${doctorId}`,

  refreshToken: (userId: string, jti: string) => `rt:${userId}:${jti}`,

  allRefreshTokens: (userId: string) => `rt:${userId}:*`,

  otpEmailVerify: (email: string) => `otp:email-verify:${email}`,

  otpPasswordReset: (email: string) => `otp:password-reset:${email}`,

  rateLimit: (identifier: string, path: string) => `rl:${identifier}:${path}`,

  idempotency: (userId: string, key: string) => `idem:${userId}:${key}`,
};

export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const redis = getRedis();
    const env = getEnv();
    const ttl = ttlSeconds ?? env.CACHE_TTL_SECONDS;
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  }

  async del(...keys: string[]): Promise<void> {
    const redis = getRedis();
    if (keys.length > 0) await redis.del(...keys);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const redis = getRedis();
    let cursor = "0";
    const keysToDelete: string[] = [];

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (cursor !== "0");

    if (keysToDelete.length > 0) await redis.del(...keysToDelete);
  }
}

export const cacheService = new CacheService();
