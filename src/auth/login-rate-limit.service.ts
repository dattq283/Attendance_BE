import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class LoginRateLimiterService {
  private readonly logger = new Logger(LoginRateLimiterService.name);
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
    });
  }

  async checkLoginAttempt(
    email: string,
    ip: string,
    limit = 5,
    windowSeconds = 60,
  ): Promise<boolean> {
    const key = `login_attempts:${email}|${ip}`;
    try {
      const now = Date.now();
      const windowStart = now - windowSeconds * 1000;
      await this.redis.zremrangebyscore(key, 0, windowStart);
      const count = await this.redis.zcard(key);
      return count < limit;
    } catch (e) {
      this.logger.warn('Redis unavailable, allowing login: ' + e);
      return true;
    }
  }

  // Gọi khi thành công → xóa bộ đếm
  async clearLoginAttempts(email: string, ip: string): Promise<void> {
    try {
      await this.redis.del(`login_attempts:${email}|${ip}`);
    } catch (e) {
      this.logger.warn('Failed to clear counter: ' + e);
    }
  }

  // Gọi khi thất bại → ghi 1 lần đếm
  async recordFailedAttempt(
    email: string,
    ip: string,
    windowSeconds = 60,
  ): Promise<void> {
    const key = `login_attempts:${email}|${ip}`;
    try {
      const now = Date.now();
      await this.redis.zadd(key, now, `${now}-${Math.random()}`);
      await this.redis.expire(key, windowSeconds);
    } catch (e) {
      this.logger.log('Failed to record attempt: ' + e);
    }
  }
}
