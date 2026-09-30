/* LifeFlow service worker —— 离线可用（定稿 §7：Local-first 不变）
   策略：网络优先、失败回落缓存。
   为什么不用"缓存优先"：开发期会看到旧版本；离线时仍然可用。

   ⚠ iPad 注意：未"加到主屏"的网页，Safari 会在 7 天不活跃后清掉
   localStorage / IndexedDB / SW 注册。加到主屏后域名豁免 ITP。
   所以「加到主屏」不是可选优化，是防丢必需（见 PwaRegister.tsx 的提示）。 */

const CACHE = "lifeflow-v7-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icon.svg"])).catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
  );
});
