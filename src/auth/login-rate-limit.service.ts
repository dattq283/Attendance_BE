import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class LoginRateLimiterService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({ host: 'localhost', port: 6379 });
  }
  async checkLoginAttemps(
    identifier: string,
    limit = 5,
    windowSeconds = 60,
  ): Promise<boolean> {
    const key = `login_attemps:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    await this.redis.zremrangebyscore(key, 0, windowStart);
    const count = await this.redis.zcard(key);

    if (count >= limit) return false;

    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.expire(key, windowSeconds);

    return true;
  }
}
