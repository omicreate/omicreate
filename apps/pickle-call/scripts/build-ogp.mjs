// リンクを貼ったときの画像（OGP、1200×630）を作る（npm run ogp）。
// scripts/ogp.html を Playwright の Chromium で開いて撮り、public/ogp.png に保存する。
// 文言やアイコンを直したときだけ実行し、できた PNG をコミットする（ビルドのたびには撮らない）。
// 日本語の書体が無い端末で撮ると文字が四角（豆腐）になるので、できた画像を必ず目で確かめる。
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const html = pathToFileURL(fileURLToPath(new URL("./ogp.html", import.meta.url))).href;
const out = fileURLToPath(new URL("../public/ogp.png", import.meta.url));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(html);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  });
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log("ogp: public/ogp.png（1200×630）");
} finally {
  await browser.close();
}
