/**
 * 骨架屏组件
 */

import { PLATFORMS } from '../api/hotboard.js';

/**
 * 渲染单个骨架屏卡片
 */
function renderSkeletonCard(config) {
  const items = Array.from({ length: 10 }, () => `
    <div class="skeleton-item">
      <div class="skeleton-rank"></div>
      <div class="skeleton-title"></div>
    </div>
  `).join('');

  return `
    <div class="skeleton-card">
      <div class="skeleton-header">
        <div class="skeleton-icon"></div>
        <div class="skeleton-name"></div>
      </div>
      ${items}
    </div>
  `;
}

/**
 * 渲染完整骨架屏
 */
export function renderSkeleton(platforms = ['weibo', 'toutiao', 'douyin']) {
  return platforms
    .map((type) => renderSkeletonCard(PLATFORMS[type]))
    .join('');
}
