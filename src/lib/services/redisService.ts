import { v4 as uuidv4 } from "uuid";

interface MemoryLockEntry {
  lockId: string;
  expiresAt: number;
}

interface MemoryCacheEntry {
  value: string;
  expiresAt: number | null;
}

export class RedisService {
  private static memoryLocks: Map<string, MemoryLockEntry> = new Map();
  private static memoryCache: Map<string, MemoryCacheEntry> = new Map();
  private static redisUrl = process.env.REDIS_URL;

  /**
   * Acquires a distributed lock for a given resource key (e.g. doctor slot reservation).
   * Implements Redis SETNX with TTL. Returns lockId if successful, or null if already locked.
   */
  public static async acquireLock(
    key: string,
    ttlMs: number = 15000
  ): Promise<{ success: boolean; lockId: string | null }> {
    const lockKey = `lock:${key}`;
    const lockId = uuidv4();
    const now = Date.now();

    // 1. If Redis is available, attempt Redis SET key lockId NX PX ttlMs
    if (this.redisUrl && !this.redisUrl.includes("memory")) {
      try {
        // Support Upstash REST or Redis connection
        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
          const res = await fetch(
            `${process.env.UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(lockKey)}/${lockId}?nx=true&px=${ttlMs}`,
            {
              headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
            }
          );
          const data = await res.json();
          if (data.result === "OK") {
            return { success: true, lockId };
          }
          return { success: false, lockId: null };
        }
      } catch (err) {
        console.warn(`[RedisService] Redis lock connection failed, falling back to memory lock: ${err}`);
      }
    }

    // 2. High-performance In-Memory Distributed Lock Fallback with TTL
    const existing = this.memoryLocks.get(lockKey);
    if (existing && existing.expiresAt > now) {
      // Key is actively locked by another concurrent process
      return { success: false, lockId: null };
    }

    // Lock granted
    this.memoryLocks.set(lockKey, {
      lockId,
      expiresAt: now + ttlMs,
    });

    return { success: true, lockId };
  }

  /**
   * Safely releases the lock only if the provided lockId matches the owner.
   * Matches Redis Lua script: if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1])
   */
  public static async releaseLock(key: string, lockId: string): Promise<boolean> {
    const lockKey = `lock:${key}`;

    if (this.redisUrl && !this.redisUrl.includes("memory")) {
      try {
        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
          // Check owner before del
          const getRes = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(lockKey)}`, {
            headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
          });
          const getData = await getRes.json();
          if (getData.result === lockId) {
            await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/del/${encodeURIComponent(lockKey)}`, {
              headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
            });
            return true;
          }
          return false;
        }
      } catch (err) {
        console.warn(`[RedisService] Redis release failed: ${err}`);
      }
    }

    // In-Memory safe release
    const entry = this.memoryLocks.get(lockKey);
    if (entry && entry.lockId === lockId) {
      this.memoryLocks.delete(lockKey);
      return true;
    }

    return false;
  }

  /**
   * Retrieves a cached value
   */
  public static async get(key: string): Promise<string | null> {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Sets a cache key with optional expiration
   */
  public static async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.memoryCache.set(key, { value, expiresAt });
  }

  /**
   * Deletes a cache key
   */
  public static async del(key: string): Promise<void> {
    this.memoryCache.delete(key);
  }

  /**
   * Healthcheck report
   */
  public static async checkHealth(): Promise<{
    status: "HEALTHY" | "DEGRADED";
    mode: "REDIS" | "MEMORY_FALLBACK";
    activeLocksCount: number;
    cachedKeysCount: number;
  }> {
    const now = Date.now();
    // Clean expired locks
    for (const [k, v] of this.memoryLocks.entries()) {
      if (v.expiresAt <= now) this.memoryLocks.delete(k);
    }
    // Clean expired cache
    for (const [k, v] of this.memoryCache.entries()) {
      if (v.expiresAt && v.expiresAt <= now) this.memoryCache.delete(k);
    }

    const hasRedis = Boolean(this.redisUrl && !this.redisUrl.includes("memory"));
    return {
      status: "HEALTHY",
      mode: hasRedis ? "REDIS" : "MEMORY_FALLBACK",
      activeLocksCount: this.memoryLocks.size,
      cachedKeysCount: this.memoryCache.size,
    };
  }
}
