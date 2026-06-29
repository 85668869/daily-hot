/**
 * PWA 模块
 * Service Worker 注册 + 添加到桌面提示
 */

let deferredPrompt = null;
let promptDismissedAt = 0;
const DISMISS_COOLDOWN = 7 * 24 * 60 * 60 * 1000; // 7 天不再提示
const MIN_VISITS = 2; // 最少访问次数

/**
 * 注册 Service Worker
 */
function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // 静默失败，不影响主功能
      });
    });
  }
}

/**
 * 记录访问次数
 */
function trackVisit() {
  try {
    const count = parseInt(localStorage.getItem('pwa_visit_count') || '0', 10);
    localStorage.setItem('pwa_visit_count', String(count + 1));
    return count + 1;
  } catch {
    return 1;
  }
}

/**
 * 检查是否应该展示 PWA 安装提示
 */
function shouldShowPrompt() {
  // 已安装
  if (window.matchMedia('(display-mode: standalone)').matches) return false;

  // 之前关闭过，且在冷却期内
  const dismissedAt = parseInt(localStorage.getItem('pwa_dismissed_at') || '0', 10);
  if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN) return false;

  // 访问次数不够
  const visits = parseInt(localStorage.getItem('pwa_visit_count') || '0', 10);
  if (visits < MIN_VISITS) return false;

  return true;
}

/**
 * 展示安装横幅
 */
function showInstallBanner() {
  if (!shouldShowPrompt()) return;

  const banner = document.createElement('div');
  banner.className = 'pwa-banner';
  banner.id = 'pwa-banner';
  banner.innerHTML = `
    <div class="pwa-banner-text">
      <div class="pwa-banner-title">💡 添加到桌面</div>
      <div class="pwa-banner-desc">随时查看热点，无需打开浏览器</div>
    </div>
    <button class="pwa-banner-btn" id="pwa-install-btn">立即添加</button>
    <button class="pwa-banner-close" id="pwa-close-btn">✕</button>
  `;

  document.body.appendChild(banner);

  // 安装按钮
  document.getElementById('pwa-install-btn').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (result.outcome === 'accepted') {
        banner.remove();
      }
    }
    // 如果浏览器不支持 beforeinstallprompt，给出引导
    else {
      banner.innerHTML = `
        <div class="pwa-banner-text">
          <div class="pwa-banner-title">📱 如何添加到桌面</div>
          <div class="pwa-banner-desc">点击浏览器菜单 → "添加到主屏幕"</div>
        </div>
        <button class="pwa-banner-close" id="pwa-close-btn">✕</button>
      `;
    }
  });

  // 关闭按钮
  document.getElementById('pwa-close-btn').addEventListener('click', () => {
    banner.remove();
    try {
      localStorage.setItem('pwa_dismissed_at', String(Date.now()));
    } catch {}
  });
}

/**
 * 初始化 PWA
 */
export function setupPWA() {
  registerSW();
  trackVisit();

  // 监听 install 事件
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // 满足条件时展示横幅
    setTimeout(showInstallBanner, 3000);
  });

  // 已安装后隐藏横幅
  window.addEventListener('appinstalled', () => {
    const banner = document.getElementById('pwa-banner');
    if (banner) banner.remove();
    deferredPrompt = null;
  });
}
