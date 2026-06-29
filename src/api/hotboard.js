/**
 * 热榜 API 模块
 * 封装 UAPI 热榜接口，支持微博/今日头条/抖音
 */

const API_BASE = 'https://uapis.cn/api/v1/misc/hotboard';
const API_KEY = 'free'; // 免费 API Key，按需替换

// 平台配置
export const PLATFORMS = {
  weibo: {
    type: 'weibo',
    name: '微博热搜',
    icon: '🟠',
    color: '#FF8200',
    cssClass: 'weibo',
  },
  toutiao: {
    type: 'toutiao',
    name: '今日头条热榜',
    icon: '🔴',
    color: '#E13D3A',
    cssClass: 'toutiao',
  },
  douyin: {
    type: 'douyin',
    name: '抖音热榜',
    icon: '🎵',
    color: '#111111',
    cssClass: 'douyin',
  },
};

/**
 * 格式化热度值
 */
function formatHeat(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const num = typeof raw === 'string' ? parseInt(raw.replace(/[^\d]/g, ''), 10) : raw;
  if (isNaN(num) || num === 0) return null;
  if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿';
  if (num >= 10000) return (num / 10000).toFixed(1) + '万';
  return num.toLocaleString();
}

/**
 * 格式化单条热点
 */
function formatHotItem(item, index) {
  return {
    rank: item.index || (index + 1),
    title: item.title || '（无标题）',
    hotValue: formatHeat(item.hot_value),
    rawHotValue: item.hot_value,
    tag: item.extra?.tag || item.extra?.label || null,
    url: item.url || '',
  };
}

/**
 * 带超时的 fetch
 */
function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
}

/**
 * 带重试的请求
 */
async function requestWithRetry(url, options = {}, retries = 2) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetchWithTimeout(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') {
        lastError = new Error('请求超时');
      }
      if (i < retries) {
        // 递增间隔：1s, 2s
        await new Promise((r) => setTimeout(r, (i + 1) * 1000));
      }
    }
  }
  throw lastError;
}

/**
 * 获取单个平台的热榜数据
 */
export async function fetchPlatformHot(platformType) {
  const url = `${API_BASE}?type=${platformType}`;
  const data = await requestWithRetry(url);

  // 兼容不同的返回格式
  const list = data?.list || data?.data?.list || [];
  const updateTime = data?.update_time || data?.data?.date_time || null;

  const items = list
    .slice(0, 10)
    .map((item, i) => formatHotItem(item, i));

  return {
    items,
    updateTime,
  };
}

/**
 * 并行获取所有平台热榜
 */
export async function fetchAllHot(platforms = ['weibo', 'toutiao', 'douyin']) {
  const results = await Promise.allSettled(
    platforms.map((type) =>
      fetchPlatformHot(type).then((data) => ({ type, ...data }))
    )
  );

  const platformData = {};
  const errors = {};

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      const { type, items, updateTime } = result.value;
      platformData[type] = { items, updateTime };
    } else {
      const type = platforms[results.indexOf(result)];
      errors[type] = result.reason?.message || '未知错误';
    }
  });

  return { platformData, errors };
}
