// === 配置区 ===
const BACKEND = 'http://localhost:4000';
const PUBLIC_VAPID_KEY = 'BNYjB13pyyjg_IIF-GIBrX0i0mX0OdNJZ9eZX86tMgP10fl5ZFnM19jRHGaGgGDa-cBi_srOptgw-82kpKBZRZg'; // 形如 'BOaN_...'
const TAGS = ['demo']; // 可选：上报给后端用于群发筛选

// === 工具函数 ===
// VAPID 公钥（URL-safe Base64） -> Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function updateStatus(text) {
  const s = document.querySelector('#status');
  if (s) s.textContent = text;
  console.log('[Status]', text);
}

// === Service Worker 注册 ===
async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    await updateStatus('当前浏览器不支持 Service Worker / Push');
    throw new Error('SW unsupported');
  }
  const reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
  await updateStatus('Service Worker 已注册');
  return reg;
}

// === 请求通知权限 ===
async function ensurePermission() {
  const result = await Notification.requestPermission();
  if (result !== 'granted') {
    await updateStatus('用户未授予通知权限');
    throw new Error('Notification permission not granted');
  }
  await updateStatus('通知权限已授予');
}

// === 订阅并上报后端 ===
async function subscribeAndReport() {
  const reg = await ensureServiceWorker();
  await ensurePermission();

  // 已经订阅过则直接返回
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
    });
  }

  // 上报到后端
  const res = await fetch(`${BACKEND}/api/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // 可以附带 tags（可选），后端会保存用于群发过滤
    body: JSON.stringify({ ...sub.toJSON(), tags: TAGS }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`上报订阅失败：${res.status} ${msg}`);
  }

  await updateStatus('订阅成功并已上报后端');
  return sub;
}

// === 退订并通知后端 ===
async function unsubscribeAndReport() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    await updateStatus('尚未注册 Service Worker');
    return;
  }
  const sub = await reg.pushManager.getSubscription();
  if (!sub) {
    await updateStatus('当前无有效订阅');
    return;
  }

  const endpoint = sub.endpoint;
  const ok = await sub.unsubscribe();
  if (ok) {
    await fetch(`${BACKEND}/api/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
    await updateStatus('退订成功并已通知后端');
  } else {
    await updateStatus('退订失败');
  }
}

// === 测试推送（调用后端 /api/send 群发到当前所有活跃订阅） ===
async function testPush() {
  const res = await fetch(`${BACKEND}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: {
        title: '来自后端的测试通知',
        body: '网页关闭也能收到～ 点击可返回站点',
        icon: '/icon.png',   // 可选：放一个 128x128 左右的图标
        badge: '/badge.png', // 可选：monochrome 小图标
        data: { url: location.origin }, // 点击通知要打开/聚焦的地址
      },
      // 可选：只推给带 demo 标签的订阅
      // filter: { tags: ['demo'] },

      // 可选：推送参数
      options: { TTL: 3600, urgency: 'normal' }
    }),
  });
  const json = await res.json();
  console.log('发送结果：', json);
  await updateStatus(`发送完成：成功 ${json.summary?.success || 0} / 失败 ${json.summary?.failed || 0}`);
}

// === UI 绑定（演示页按钮） ===
document.getElementById('btn-subscribe')?.addEventListener('click', () => {
  subscribeAndReport().catch(e => updateStatus(`订阅失败：${e.message}`));
});
document.getElementById('btn-unsubscribe')?.addEventListener('click', () => {
  unsubscribeAndReport().catch(e => updateStatus(`退订失败：${e.message}`));
});
document.getElementById('btn-test')?.addEventListener('click', () => {
  testPush().catch(e => updateStatus(`测试推送失败：${e.message}`));
});

// 页面加载时尝试显示当前状态
(async () => {
  try {
    await ensureServiceWorker();
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    await updateStatus(sub ? '已订阅' : '未订阅');
  } catch (e) {
    await updateStatus(`初始化失败：${e.message}`);
  }
})();