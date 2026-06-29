/**
 * 缓存模块
 * localStorage 封装，含有效期校验和静默降级
 */

const CACHE_KEY = 'dailyhot_cache';
const CACHE_VERSION = 1;
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 天

/**
 * 检查 localStorage 是否可用
 */
function isStorageAvailable() {
  try {
    const key = '__storage_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * 保存数据到缓存
 */
export function saveCache(platformData, globalUpdateTime) {
  if (!isStorageAvailable()) return false;
  try {
    const cache = {
      version: CACHE_VERSION,
      cachedAt: Date.now(),
      globalUpdateTime,
      platformData,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    return true;
  } catch {
    // 配额满或隐私模式，静默失败
    return false;
  }
}

/**
 * 读取缓存数据
 * 返回 null 表示无有效缓存
 */
export function loadCache() {
  if (!isStorageAvailable()) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const cache = JSON.parse(raw);

    // 版本校验
    if (cache.version !== CACHE_VERSION) return null;

    // 有效期校验
    const age = Date.now() - cache.cachedAt;
    if (age > CACHE_TTL) {
      // 过期缓存，清理
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return {
      platformData: cache.platformData,
      globalUpdateTime: cache.globalUpdateTime,
      cachedAt: cache.cachedAt,
    };
  } catch {
    return null;
  }
}

/**
 * 获取缓存年龄（分钟）
 */
export function getCacheAge() {
  const cache = loadCache();
  if (!cache) return null;
  return Math.floor((Date.now() - cache.cachedAt) / 60000);
}
