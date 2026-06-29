/**
 * 数据管理层
 * 全局状态管理、数据获取协调、事件发布订阅
 */

import { fetchAllHot, PLATFORMS, fetchPlatformHot } from '../api/hotboard.js';
import { saveCache, loadCache } from './cache.js';

// 自动刷新间隔（毫秒）
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;

class Store {
  constructor() {
    this.state = {
      // 平台数据: { weibo: { items, updateTime }, ... }
      platformData: {},
      // 错误信息: { weibo: 'error msg', ... }
      errors: {},
      // 全局更新时间
      globalUpdateTime: null,
      // 加载状态
      loading: false,
      // 是否首次加载
      firstLoad: true,
      // 是否离线模式（展示缓存数据）
      offline: false,
      // 上次请求时间
      lastFetchTime: 0,
    };

    this.listeners = new Set();
    this.refreshTimer = null;
  }

  /**
   * 获取当前状态快照
   */
  getState() {
    return { ...this.state, platformData: { ...this.state.platformData }, errors: { ...this.state.errors } };
  }

  /**
   * 订阅状态变更
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 发布状态变更
   */
  notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  /**
   * 更新状态
   */
  setState(partial) {
    Object.assign(this.state, partial);
    this.notify();
  }

  /**
   * 尝试加载缓存
   */
  loadFromCache() {
    const cache = loadCache();
    if (cache) {
      this.setState({
        platformData: cache.platformData,
        globalUpdateTime: cache.globalUpdateTime,
        firstLoad: false,
        offline: false,
      });
      return true;
    }
    return false;
  }

  /**
   * 获取最新数据
   */
  async fetchData(silent = false) {
    if (this.state.loading) return;

    this.setState({ loading: true });

    try {
      const { platformData, errors } = await fetchAllHot();

      // 计算全局更新时间（取最晚的）
      let globalUpdateTime = null;
      Object.values(platformData).forEach(({ updateTime }) => {
        if (updateTime && (!globalUpdateTime || updateTime > globalUpdateTime)) {
          globalUpdateTime = updateTime;
        }
      });

      // 有缓存且全部失败 → 保持缓存数据
      if (Object.keys(platformData).length === 0 && Object.keys(errors).length > 0) {
        const hasCache = Object.keys(this.state.platformData).length > 0;
        if (hasCache) {
          this.setState({
            errors,
            loading: false,
            offline: true,
          });
        } else {
          this.setState({
            errors,
            loading: false,
            firstLoad: false,
          });
        }
        return;
      }

      // 合并数据：新数据覆盖，失败的保留旧数据
      const mergedData = { ...this.state.platformData, ...platformData };

      // 保存缓存
      saveCache(mergedData, globalUpdateTime);

      this.setState({
        platformData: mergedData,
        errors,
        globalUpdateTime,
        loading: false,
        firstLoad: false,
        offline: false,
        lastFetchTime: Date.now(),
      });
    } catch (err) {
      // 完全异常（理论上不会到这里）
      const hasCache = Object.keys(this.state.platformData).length > 0;
      this.setState({
        loading: false,
        firstLoad: hasCache ? false : this.state.firstLoad,
        offline: hasCache,
      });
    }
  }

  /**
   * 重试单个平台
   */
  async retryPlatform(type) {
    try {
      const { items, updateTime } = await fetchPlatformHot(type);
      const newData = { ...this.state.platformData, [type]: { items, updateTime } };
      const newErrors = { ...this.state.errors };
      delete newErrors[type];

      saveCache(newData, this.state.globalUpdateTime);

      this.setState({
        platformData: newData,
        errors: newErrors,
        offline: false,
      });
    } catch (err) {
      // 重试失败，保持现状
    }
  }

  /**
   * 检查是否需要自动刷新
   */
  shouldAutoRefresh() {
    return Date.now() - this.state.lastFetchTime > AUTO_REFRESH_INTERVAL;
  }

  /**
   * 初始化：加载缓存 + 获取最新数据
   */
  async init() {
    const hasCache = this.loadFromCache();
    await this.fetchData(!hasCache);
    this.setupAutoRefresh();
  }

  /**
   * 设置自动刷新（页面可见时检查）
   */
  setupAutoRefresh() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.shouldAutoRefresh()) {
        this.fetchData(true);
      }
    });
  }
}

// 单例
export const store = new Store();
