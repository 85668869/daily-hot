/**
 * 热点卡片组件
 * 负责渲染单个平台的热点列表
 */

import { PLATFORMS } from '../api/hotboard.js';

/**
 * 获取排名样式类名
 */
function getRankClass(rank) {
  if (rank === 1) return 'top-1';
  if (rank === 2) return 'top-2';
  if (rank === 3) return 'top-3';
  return '';
}

/**
 * 获取标签样式类名
 */
function getTagClass(tag) {
  const map = {
    '爆': 'boom',
    '沸': 'boil',
    '新': 'new',
    '热': 'hot',
  };
  return map[tag] || 'hot';
}

/**
 * 渲染单条热点
 */
function renderHotItem(item) {
  const rankClass = getRankClass(item.rank);
  const tagClass = item.tag ? getTagClass(item.tag) : '';
  const hasLink = item.url && item.url.startsWith('http');
  const noLinkClass = hasLink ? '' : 'no-link';

  return `
    <li class="hot-item ${noLinkClass}" data-url="${hasLink ? escapeHtml(item.url) : ''}" data-rank="${item.rank}">
      <span class="hot-rank ${rankClass}">${item.rank}</span>
      <div class="hot-content">
        <div class="hot-title-row">
          <span class="hot-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>
          ${item.tag ? `<span class="hot-tag ${tagClass}">${escapeHtml(item.tag)}</span>` : ''}
        </div>
        ${item.hotValue ? `<span class="hot-heat">🔥 ${escapeHtml(item.hotValue)}</span>` : ''}
      </div>
      ${hasLink ? '<svg class="hot-arrow" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M10 6V8H5V19H16V14H18V20C18 20.5523 17.5523 21 17 21H4C3.44772 21 3 20.5523 3 20V7C3 6.44772 3.44772 6 4 6H10ZM21 3V11H19V6.413L11.707 13.707L10.293 12.293L17.585 5H13V3H21Z"/></svg>' : ''}
    </li>
  `;
}

/**
 * 渲染完整平台卡片
 */
export function renderPlatformCard(platformType, data, error) {
  const config = PLATFORMS[platformType];

  if (error) {
    return `
      <section class="platform-card" data-platform="${platformType}">
        <div class="platform-card-header">
          <span class="platform-icon ${config.cssClass}">${config.icon}</span>
          <span class="platform-name">${config.name}</span>
        </div>
        <div class="error-card-inner">
          <div class="error-icon">⚠️</div>
          <p class="error-description">加载失败</p>
          <button class="btn-retry btn-retry-small" data-action="retry-platform" data-platform="${platformType}">重新加载</button>
        </div>
      </section>
    `;
  }

  if (!data || !data.items || data.items.length === 0) {
    return `
      <section class="platform-card" data-platform="${platformType}">
        <div class="platform-card-header">
          <span class="platform-icon ${config.cssClass}">${config.icon}</span>
          <span class="platform-name">${config.name}</span>
        </div>
        <div class="empty-state">暂无数据</div>
      </section>
    `;
  }

  const itemsHtml = data.items.map(renderHotItem).join('');

  return `
    <section class="platform-card" data-platform="${platformType}">
      <div class="platform-card-header">
        <span class="platform-icon ${config.cssClass}">${config.icon}</span>
        <span class="platform-name">${config.name}</span>
        <span class="platform-count">Top ${data.items.length}</span>
      </div>
      <ul class="hot-list">
        ${itemsHtml}
      </ul>
    </section>
  `;
}

/**
 * HTML 转义
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
