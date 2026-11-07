// public/icon.svg と public/icon-maskable.svg から、manifest と iOS 用の PNG を作る（npm run icons）。
// Playwright の Chromium で SVG を描いて撮る。アイコンを直したときだけ実行し、できた PNG をコミットする。
// 撮ったままの PNG は圧縮が弱い（事前キャッシュで最初に全部落とすので重い）。コミットの前に、見た目の変わらない
// 可逆の再圧縮（例: oxipng -o4、または画素を変えずに zlib を最大にして保存し直す）をかけておく。
//   icon-192.png / icon-512.png            … 角の丸い通常のアイコン（角は透明）
//   icon-maskable-192.png / -512.png       … 端まで塗った maskable（図柄は中央 80% の安全域に収める）
//   apple-touch-icon.png（180）            … iOS 用。角は iOS が丸めるので、角を丸めず端まで塗る（透明を残さない）
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const pub = new URL("../public/", import.meta.url);
const read = (name) => readFileSync(new URL(name, pub), "utf8");

const any = read("icon.svg");
const maskable = read("icon-maskable.svg");
// 角の丸みだけを外す（図柄の大きさは通常のアイコンと同じ）
const square = any.replace(/(<rect id="field-rect"[^>]*?)\srx="[^"]*"/, '$1 rx="0"');
if (square === any) {
  console.error('build-icons: icon.svg に <rect id="field-rect" ... rx="..."> が見つかりません。');
  process.exit(1);
}

const jobs = [
  { svg: any, size: 192, out: "icon-192.png" },
  { svg: any, size: 512, out: "icon-512.png" },
  { svg: maskable, size: 192, out: "icon-maskable-192.png" },
  { svg: maskable, size: 512, out: "icon-maskable-512.png" },
  { svg: square, size: 180, out: "apple-touch-icon.png", opaque: true },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const job of jobs) {
    await page.setViewportSize({ width: job.size, height: job.size });
    const src = `data:image/svg+xml;base64,${Buffer.from(job.svg).toString("base64")}`;
    const bg = job.opaque ? "#1b4488" : "transparent";
    await page.setContent(
      `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:${bg}}img{display:block}</style></head>` +
        `<body><img id="i" alt="" width="${job.size}" height="${job.size}" src="${src}"></body></html>`,
    );
    await page.locator("#i").evaluate((img) => img.decode());
    await page.screenshot({
      path: new URL(job.out, pub).pathname,
      clip: { x: 0, y: 0, width: job.size, height: job.size },
      omitBackground: !job.opaque,
    });
    console.log(`icons: public/${job.out}（${job.size}×${job.size}）`);
  }
} finally {
  await browser.close();
}
