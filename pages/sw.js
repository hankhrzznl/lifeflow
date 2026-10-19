/* 执灯人 · Service Worker —— 网络优先：在线拿最新版并回写缓存，离线回退缓存
   历史坑：原先用 cache.addAll() 预缓存，其中 ./assets/tab-avatar.png 已删除（第七轮改为内联 SVG 头像）、
   ./styles/main.css 没有任何页面加载；addAll 是全成全败语义，一个 404 就让 install 整体 reject，
   SW 从此永远不激活且控制台不报错。现改为逐条 add + 单条容错。 */
const CACHE = 'lifeflow-hub-v5';
const ASSETS = [
  './',
  './index.html',
  './desktop.html',
  './manifest.json',
  './assets/icon.svg',
  './assets/apple-touch-icon.png',
  './assets/ai-mascot-dark.png',
  './core/light.js',
  './core/accounts.js',
  './core/store.js'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (u) {
        // 单条失败不影响整体安装
        return c.add(u).catch(function () {});
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url;
  try { url = new URL(e.request.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request).then(function (res) {
      // 只回写成功的同源响应，避免把 opaque / 4xx 塞满缓存
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { return c.put(e.request, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (hit) {
        if (hit) return hit;
        // 离线且是页面导航时回退到手机端首页
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
