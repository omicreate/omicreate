// claude.ai でアプリを試せるように、1つの HTML ファイルだけで動く版を作る（npm run build:artifact）。
// 出力: dist-artifact/index.html（JS と CSS とアイコンを中に埋め込む。ほかのファイルは要らない）
//
// 手順:
//   1. VITE_NO_SW=1 をつけて、別の出力先（dist-artifact/.build）に vite build する
//      → Service Worker を登録しない版になる（本番の dist/ には触れない）
//   2. index.html に JS（<script type="module">）と CSS（<style>）を埋め込み、
//      ファビコンは icon.svg を data URI にする
//   3. 埋め込んだ JS とぶつかる CSP の meta、manifest と apple-touch-icon のリンクを外す
//   4. 一時フォルダを消す
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = join(root, "dist-artifact");
const tmpDir = join(outDir, ".build");
const viteBin = join(root, "node_modules", "vite", "bin", "vite.js");

function fail(message) {
  console.error(`build-artifact: ${message}`);
  process.exit(1);
}

// 1. Service Worker なしの版をビルドする
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const result = spawnSync(process.execPath, [viteBin, "build", "--outDir", tmpDir, "--emptyOutDir", "--logLevel", "warn"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, VITE_NO_SW: "1" },
});
if (result.status !== 0) fail("vite build に失敗しました。");

const assetsDir = join(tmpDir, "assets");
const assetFiles = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
const jsFiles = assetFiles.filter((f) => f.endsWith(".js"));
const cssFiles = assetFiles.filter((f) => f.endsWith(".css"));
const otherFiles = assetFiles.filter((f) => !f.endsWith(".js") && !f.endsWith(".css") && !f.endsWith(".map"));

let html = readFileSync(join(tmpDir, "index.html"), "utf8");

const mime = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp3": "audio/mpeg",
};
const dataUri = (file) => {
  const type = mime[extname(file).toLowerCase()];
  if (!type) fail(`埋め込めない種類のファイルです: ${file}`);
  return `data:${type};base64,${readFileSync(file).toString("base64")}`;
};

/** CSS や JS の中の assets/ への参照（画像など）を data URI に置きかえる */
function inlineAssetRefs(text) {
  let out = text;
  for (const f of otherFiles) {
    const uri = dataUri(join(assetsDir, f));
    out = out.split(`./assets/${f}`).join(uri).split(`/assets/${f}`).join(uri).split(`./${f}`).join(uri);
  }
  return out;
}

// HTML の中に入れても、途中で </script> や </style> として読まれないようにする
const escapeScript = (js) => js.replace(/<\/(script)/gi, "\\x3C/$1").replace(/<!--/g, "\\x3C!--");
const escapeStyle = (css) => css.replace(/<\/(style)/gi, "\\3C /$1");

// 2. JS を埋め込む（入口のスクリプトだけ。ほかのチャンクがあれば止める）
const scriptTags = [...html.matchAll(/<script\b[^>]*\bsrc="\.\/assets\/([^"]+\.js)"[^>]*><\/script>\s*/g)];
if (scriptTags.length !== 1) fail(`入口のスクリプトが ${scriptTags.length} 個見つかりました（1個のはず）。`);
const entry = scriptTags[0][1];
if (jsFiles.length !== 1) fail(`JS のファイルが ${jsFiles.length} 個あります（${jsFiles.join(", ")}）。分割されたチャンクは埋め込めません。`);
const js = escapeScript(inlineAssetRefs(readFileSync(join(assetsDir, entry), "utf8")));
html = html.replace(scriptTags[0][0], "");
html = html.replace(/<link\b[^>]*\brel="modulepreload"[^>]*>\s*/g, "");

// CSS を埋め込む
html = html.replace(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="\.\/assets\/([^"]+\.css)"[^>]*>/g, (_, file) => {
  if (!cssFiles.includes(file)) fail(`CSS が見つかりません: ${file}`);
  const css = escapeStyle(inlineAssetRefs(readFileSync(join(assetsDir, file), "utf8")));
  return `<style>\n${css}\n</style>`;
});

// ファビコンを data URI にする
const iconPath = join(tmpDir, "icon.svg");
if (!existsSync(iconPath)) fail("icon.svg がありません（public/icon.svg）。");
const iconUri = `data:image/svg+xml;base64,${readFileSync(iconPath).toString("base64")}`;
html = html.replace(/(<link\b[^>]*\brel="icon"[^>]*\bhref=")[^"]*(")/, `$1${iconUri}$2`);

// 3. 埋め込みとぶつかるもの・1ファイルでは使えないものを外す
html = html.replace(/\s*<!--[^>]*Google Apps Script[^>]*-->/g, "");
html = html.replace(/\s*<meta\b[^>]*http-equiv="Content-Security-Policy"[^>]*>/gi, "");
html = html.replace(/\s*<link\b[^>]*\brel="manifest"[^>]*>/g, "");
html = html.replace(/\s*<link\b[^>]*\brel="apple-touch-icon"[^>]*>/g, "");

// 確かめる（JS を入れる前の HTML で）: 外のファイルを読みに行く script / link が残っていないこと
const leftovers = [
  [/<script\b/i, "script タグ"],
  [/<link\b[^>]*\brel="stylesheet"/i, "stylesheet のリンク"],
  [/<link\b[^>]*\brel="(manifest|apple-touch-icon|modulepreload)"/i, "manifest などのリンク"],
  [/http-equiv="Content-Security-Policy"/i, "CSP の meta"],
];
for (const [re, label] of leftovers) if (re.test(html)) fail(`${label} が残っています。`);
// Service Worker を登録する処理が、VITE_NO_SW=1 で消えていること
if (/serviceWorker\.register\(/.test(js)) fail("Service Worker を登録する処理が残っています（VITE_NO_SW が効いていません）。");

// JS は body の最後に置く（#root ができてから動く）
html = html.replace("</body>", () => `  <script type="module">\n${js}\n</script>\n  </body>`);
const closers = html.match(/<\/script/gi) ?? [];
if (closers.length !== 1) fail(`</script が ${closers.length} 個あります（1個のはず）。`);

writeFileSync(join(outDir, "index.html"), html);

// 4. 一時フォルダを消す
rmSync(tmpDir, { recursive: true, force: true });

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`build-artifact: dist-artifact/index.html（1ファイル、${kb}KB。JS ${entry}・CSS ${cssFiles.length} 個・画像 ${otherFiles.length} 個を埋め込み）`);
