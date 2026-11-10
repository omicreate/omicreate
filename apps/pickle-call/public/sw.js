// Service Worker（オフライン対応）
// これはひな形です。キャッシュ名のバージョンと事前キャッシュの一覧は、ビルドのあとに
// scripts/build-sw.mjs が埋め込み、dist/sw.js に書き出します（このファイル自体は書き換えません）。
// 置き場所は相対（./）なので、GitHub Pages の /pickle-call/ でも、ほかの置き場所でも同じように動きます。
const CACHE_PREFIX = "pickle-call-";
const CACHE_NAME = `${CACHE_PREFIX}__VERSION__`;
const APP_SHELL = __PRECACHE__;

// このアプリの入口（sw.js と同じ階層）。ここと index.html を開いたときだけ、ページ本体をキャッシュし直す
const SCOPE_PATH = new URL("./", self.location.href).pathname;

// ページ本体をネットから待つ上限（ミリ秒）。電波が弱くて返事が来ないときは、キャッシュ済みのものを先に出す
const NAV_TIMEOUT_MS = 3000;

self.addEventListener("install", (event) => {
  // ファイル名にハッシュのない入口（./・index.html・manifest・アイコン）は、ブラウザの HTTP キャッシュを通さず取り直す。
  // 古い index.html（前の版の JS を指す）を新しいキャッシュに入れてしまい、オフラインで白い画面になるのを防ぐ
  const requests = APP_SHELL.map((u) => (u.startsWith("./assets/") ? u : new Request(u, { cache: "reload" })));
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(requests)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // 同じドメイン（omicreate.github.io）には姉妹アプリのキャッシュもあるため、自分の古い版だけを消す
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // 別のサイトへの通信（匿名の回数の送信など）には関わらない
  if (url.origin !== self.location.origin) return;

  // ページ本体: ネット優先。つながらないとき、または NAV_TIMEOUT_MS 待っても返事がないときは、キャッシュ済みの index.html
  if (request.mode === "navigate") {
    const isShell = url.pathname === SCOPE_PATH || url.pathname === `${SCOPE_PATH}index.html`;
    const fromCache = () =>
      caches
        .match("./index.html", { cacheName: CACHE_NAME, ignoreVary: true })
        .then((cached) => cached || caches.match("./index.html", { ignoreVary: true }))
        .then((cached) => cached || caches.match("./", { ignoreVary: true }));
    let saved;
    const net = fetch(request).then((res) => {
      if (res.ok && isShell) {
        const copy = res.clone();
        saved = caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
      }
      return res;
    });
    // 先にキャッシュで返しても、ネットの返事が来たら入口をキャッシュし直す（waitUntil は同期的に呼ぶ）
    event.waitUntil(net.then(() => saved, () => {}));
    const slow = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS)).then(fromCache);
    event.respondWith(
      Promise.race([net, slow])
        // 時間切れでもキャッシュが無ければ、ネットを待ち続ける
        .then((res) => res || net)
        .catch(fromCache)
        .then((res) => res || Response.error())
    );
    return;
  }

  // それ以外（JS・CSS・アイコン）: キャッシュ優先。無ければ取りに行き、うまく取れたらキャッシュする
  // ファイル名にハッシュが入っていて中身は変わらないので、Vary（Origin など）の違いは見ない
  // （crossorigin つきの script と、事前キャッシュのときの要求とで、ヘッダーが違っても当たるように）
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
          }
          return res;
        })
    )
  );
});
