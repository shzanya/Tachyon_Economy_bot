import { balanceQueries } from '@db/queries'; 
import type { UserBalance } from '@types';
import { TransactionManager } from './transaction-manager';

const CACHE_TTL_DEFAULT = 10_000;
const CACHE_TTL_AFTER_UPDATE = 1_000;
const CACHE_CLEAN_INTERVAL = 30_000;

const balanceCache = new Map<string, { data: UserBalance; time: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [id, { time }] of balanceCache) {
    if (now - time > CACHE_TTL_DEFAULT * 2) balanceCache.delete(id);
  }
}, CACHE_CLEAN_INTERVAL).unref();

export class BalanceService {
  static async get(userId: string): Promise<UserBalance> {
    const cached = balanceCache.get(userId);

    if (cached && Date.now() - cached.time < CACHE_TTL_DEFAULT) {
      return cached.data;
    }

    const data = await balanceQueries.get(userId);
    this.#updateCache(userId, data);
    return data;
  }

  static async add(userId: string, coins = 0, diamonds = 0): Promise<UserBalance> {
    if (coins < 0 || diamonds < 0) {
      throw new Error('Нельзя добавлять отрицательные значения');
    }
    const updated = await balanceQueries.add(userId, coins, diamonds);
    this.#updateCache(userId, updated, CACHE_TTL_AFTER_UPDATE);
    return updated;
  }
  
  static async subtract(userId: string, coins = 0, diamonds = 0): Promise<UserBalance> {
    const updated = await balanceQueries.subtract(userId, coins, diamonds);
    this.#updateCache(userId, updated, CACHE_TTL_AFTER_UPDATE);
    return updated;
  }

  static async update(userId: string, coins: number, diamonds: number): Promise<UserBalance> {
    const updated = await balanceQueries.update(userId, coins, diamonds);
    this.#updateCache(userId, updated, CACHE_TTL_AFTER_UPDATE);
    return updated;
  }

  static async getTransactions(userId: string, guildId: string, limit = 50) {
    return TransactionManager.getTransactions(userId, guildId, { limit });
  }

  static async getStats() {
    return balanceQueries.getStats();
  }

  static async batchAdd(updates: Array<{ userId: string; coins?: number; diamonds?: number }>) {
    await balanceQueries.batchAdd(updates);
    
    for (const { userId } of updates) {
      balanceCache.delete(userId);
    }
  }

  static format(amount: number): string {
    return new Intl.NumberFormat('ru-RU').format(amount);
  }

  static clearCache(userId?: string) {
    if (userId) balanceCache.delete(userId);
    else balanceCache.clear();
  }

  static #updateCache(userId: string, data: UserBalance, ttlOffset = 0) {
    balanceCache.set(userId, { data, time: Date.now() });

    setTimeout(() => {
      const cached = balanceCache.get(userId);
      if (cached && cached.data === data) {
        balanceCache.delete(userId);
      }
    }, ttlOffset > 0 ? ttlOffset : CACHE_TTL_DEFAULT).unref();
  }
}
