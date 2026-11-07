// ビルドのあとに、事前キャッシュの一覧とバージョンを埋め込んだ dist/sw.js を作る。
// ひな形は public/sw.js（__VERSION__ と __PRECACHE__ を置きかえる）。毎回ひな形から作るので、何度実行しても同じ結果になる。
// Vite の base は './'（相対）なので、一覧も './' から始まる相対パスで書く。
// 電波のない場所でも使えるよう、アプリの入口・manifest・アイコンと、dist/assets/ の全ファイルを最初に入れておく。
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);

if (!existsSync(new URL("index.html", dist))) {
  console.error("build-sw: dist/index.html がありません。先に vite build を実行してください。");
  process.exit(1);
}

/** dist/<dir> の下のファイルを、たどって './<dir>...' の形で返す（HTML を正規表現で読まずに、フォルダを読む） */
function listDir(dir) {
  const base = new URL(dir, dist);
  if (!existsSync(base)) return [];
  const out = [];
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) out.push(...listDir(`${dir}${entry.name}/`));
    else if (entry.isFile()) out.push(`./${dir}${entry.name}`);
  }
  return out.sort();
}

const fixed = [
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
];
const missing = fixed.filter((f) => !existsSync(new URL(f.slice(2), dist)));
if (missing.length > 0) {
  console.warn(`build-sw: dist に無いので一覧から外します: ${missing.join(", ")}`);
}

const assets = listDir("assets/");
if (assets.length === 0) {
  console.error("build-sw: dist/assets/ が空です。");
  process.exit(1);
}

const files = [...fixed.filter((f) => !missing.includes(f)), ...assets];
const precache = ["./", ...files];

// バージョンは中身から作る（どれか1つでも変われば新しいキャッシュになる）
const hash = createHash("sha256");
for (const f of files) {
  hash.update(f);
  hash.update("\0");
  hash.update(readFileSync(new URL(f.slice(2), dist)));
}
const template = readFileSync(new URL("public/sw.js", root), "utf8");
hash.update(template);
const version = hash.digest("hex").slice(0, 12);

if (!template.includes("__VERSION__") || !template.includes("__PRECACHE__")) {
  console.error("build-sw: public/sw.js に __VERSION__ か __PRECACHE__ がありません。");
  process.exit(1);
}

const sw = template.replaceAll("__VERSION__", version).replaceAll("__PRECACHE__", JSON.stringify(precache, null, 2));
writeFileSync(new URL("sw.js", dist), sw);

const bytes = files.reduce((n, f) => n + statSync(new URL(f.slice(2), dist)).size, 0);
console.log(`sw.js: version=${version}, precache=${precache.length} files（assets ${assets.length} 個、合計 ${(bytes / 1024).toFixed(0)}KB）`);
