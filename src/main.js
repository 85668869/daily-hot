/**
 * 每日热点 App — 主入口
 * 串联数据层、UI 组件、交互逻辑
 */

import './styles/main.css';
import { store } from './utils/store.js';
import { PLATFORMS } from './api/hotboard.js';
import { renderPlatformCard } from './components/HotCard.js';
import { renderSkeleton } from './components/Skeleton.js';
import { setupPWA } from './utils/pwa.js';

const PLATFORM_ORDER = ['weibo', 'toutiao', 'douyin'];

// ===== DOM 引用 =====
const appEl = document.getElementById('app');

// ===== 渲染函数 =====

/**
 * 格式化更新时间
 */
function formatUpdateTime(timeStr) {
  if (!timeStr) return '';
  try {
    // 尝试解析各种时间格式
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) {
      // 如果是 "2026-06-29 08:00:00" 格式，直接截取
      const match = timeStr.match(/(\d{2}:\d{2})/);
      return match ? match[1] : timeStr;
    }
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
}

/**
 * 获取更新时间的状态
 */
function getTimeStatus(globalUpdateTime) {
  if (!globalUpdateTime) return 'normal';
  try {
    const updateDate = new Date(globalUpdateTime);
    if (isNaN(updateDate.getTime())) return 'normal';
    const diffMin = (Date.now() - updateDate.getTime()) / 60000;
    if (diffMin > 60) return 'danger';
    if (diffMin > 30) return 'warning';
    return 'normal';
  } catch {
    return 'normal';
  }
}

/**
 * 渲染头部
 */
function renderHeader(state) {
  const timeStr = formatUpdateTime(state.globalUpdateTime);
  const timeStatus = getTimeStatus(state.globalUpdateTime);
  const dotClass = timeStatus === 'danger' ? 'danger' : timeStatus === 'warning' ? 'warning' : '';
  const timeClass = timeStatus === 'danger' ? 'danger' : timeStatus === 'warning' ? 'warning' : '';

  return `
    <header class="app-header">
      <h1 class="app-title">🔥 每日热点</h1>
      <p class="app-subtitle">微博 · 今日头条 · 抖音 Top10</p>
      ${timeStr ? `<p class="update-time ${timeClass}"><span class="update-dot ${dotClass}"></span>更新于 ${timeStr}</p>` : ''}
    </header>
  `;
}

/**
 * 渲染离线横幅
 */
function renderOfflineBanner(globalUpdateTime) {
  const timeStr = formatUpdateTime(globalUpdateTime);
  return `
    <div class="offline-banner">
      📡 当前无网络，显示的是缓存数据${timeStr ? `（更新于 ${timeStr}）` : ''}
    </div>
  `;
}

/**
 * 渲染全局错误页
 */
function renderGlobalError() {
  return `
    <div class="error-global">
      <div class="error-icon">😵</div>
      <h2 class="error-title">数据加载失败</h2>
      <p class="error-description">请检查网络连接后重试</p>
      <button class="btn-retry" data-action="retry-all">重新加载</button>
    </div>
  `;
}

/**
 * 渲染内容区
 */
function renderContent(state) {
  const hasData = Object.keys(state.platformData).length > 0;
  const hasErrors = Object.keys(state.errors).length > 0;
  const allFailed = !hasData && hasErrors;

  // 首次加载中
  if (state.firstLoad && state.loading) {
    return renderSkeleton(PLATFORM_ORDER);
  }

  // 全部失败且无缓存
  if (allFailed) {
    return renderGlobalError();
  }

  // 正常渲染
  const cards = PLATFORM_ORDER.map((type) => {
    const data = state.platformData[type];
    const error = state.errors[type];
    return renderPlatformCard(type, data, error);
  }).join('');

  const offlineBanner = state.offline ? renderOfflineBanner(state.globalUpdateTime) : '';

  return offlineBanner + cards;
}

/**
 * 渲染整个页面
 */
function render(state) {
  appEl.innerHTML = `
    <div class="app-container">
      <div class="progress-bar ${state.loading && !state.firstLoad ? 'active' : ''}">
        <div class="progress-bar-inner"></div>
      </div>
      <div class="refresh-indicator ${state.loading && !state.firstLoad ? 'active' : ''}">
        <div class="refresh-spinner"></div>
      </div>
      ${renderHeader(state)}
      <main>
        ${renderContent(state)}
      </main>
      <footer class="app-footer">
        每日热点 · 聚合微博、今日头条、抖音热榜
      </footer>
    </div>
  `;

  // 绑定事件
  bindEvents();
}

// ===== 事件处理 =====

/**
 * 处理热点条目点击
 */
function handleHotClick(e) {
  const item = e.target.closest('.hot-item');
  if (!item) return;

  const url = item.dataset.url;
  if (url && url.startsWith('http')) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * 处理重试按钮点击
 */
function handleRetryClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;

  if (action === 'retry-all') {
    btn.classList.add('loading');
    btn.textContent = '加载中...';
    store.fetchData(false).finally(() => {
      btn.classList.remove('loading');
      btn.textContent = '重新加载';
    });
  }

  if (action === 'retry-platform') {
    const platform = btn.dataset.platform;
    btn.classList.add('loading');
    btn.textContent = '加载中...';
    store.retryPlatform(platform).finally(() => {
      btn.classList.remove('loading');
      btn.textContent = '重新加载';
    });
  }
}

// ===== 下拉刷新 =====
let touchStartY = 0;
let touchCurrentY = 0;
let isPulling = false;

function handleTouchStart(e) {
  if (window.scrollY > 5) return;
  touchStartY = e.touches[0].clientY;
  isPulling = true;
}

function handleTouchMove(e) {
  if (!isPulling) return;
  touchCurrentY = e.touches[0].clientY;
}

function handleTouchEnd() {
  if (!isPulling) return;
  isPulling = false;

  const distance = touchCurrentY - touchStartY;
  if (distance > 60 && window.scrollY <= 5) {
    store.fetchData(false);
  }

  touchStartY = 0;
  touchCurrentY = 0;
}

/**
 * 绑定事件
 */
function bindEvents() {
  // 热点点击（事件委托）
  const main = document.querySelector('main');
  if (main) {
    main.removeEventListener('click', handleHotClick);
    main.addEventListener('click', handleHotClick);
  }

  // 重试按钮（事件委托）
  appEl.removeEventListener('click', handleRetryClick);
  appEl.addEventListener('click', handleRetryClick);

  // 下拉刷新
  document.removeEventListener('touchstart', handleTouchStart);
  document.removeEventListener('touchmove', handleTouchMove);
  document.removeEventListener('touchend', handleTouchEnd);
  document.addEventListener('touchstart', handleTouchStart, { passive: true });
  document.addEventListener('touchmove', handleTouchMove, { passive: true });
  document.addEventListener('touchend', handleTouchEnd, { passive: true });
}

// ===== 启动应用 =====
store.subscribe(render);
store.init();

// 初始化 PWA（Service Worker + 安装提示）
setupPWA();
