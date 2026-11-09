# omicreate

ソフトテニスとピックルボールの無料Webアプリを、AIエージェントと一緒に個人で作っています。インストールも登録も不要で、オフラインでも動きます。
*Free web apps for racket sports — no install, no sign-up, works offline. Made by a solo developer in Japan, together with AI agents.*

[Website](https://omicreate.github.io/) ・ [Instagram: Soft Tennis IQ](https://www.instagram.com/softtennis_iq/) ・ [Instagram: Pickleball IQ](https://www.instagram.com/pickleballiq_jp/)

## アプリ / Apps

### [ピクルくんとあそぼ](https://omicreate.github.io/pickle-asobi/?lang=en) ・ Play with Pikuru

<a href="https://omicreate.github.io/pickle-asobi/?lang=en"><img src="https://omicreate.github.io/pickle-asobi/ogp.png" alt="Play with Pikuru" width="480"></a>

1台を囲んで遊ぶピックルボールのミニゲーム集。レベルは1人ずつ選べるので、親子でも勝負になります。
*Pickleball party games for one phone or tablet. Two players face each other across the screen, and each picks their own level — so kids and adults can play together.* **English / 日本語**

### [ソフトテニスIQ](https://omicreate.github.io/softtennis-iq/) ・ Soft Tennis IQ

<a href="https://omicreate.github.io/softtennis-iq/"><img src="https://omicreate.github.io/softtennis-iq/ogp.png" alt="Soft Tennis IQ" width="480"></a>

局面クイズ・ルールドリル・陣形ラボ・試合ノートを1つにまとめた、選手向けのアプリ。
*A daily tactics quiz, rule drills, a formation board and a match notebook for soft tennis players.* **日本語**

### [ピックルボールIQ](https://omicreate.github.io/pickleball-iq/) ・ Pickleball IQ

<a href="https://omicreate.github.io/pickleball-iq/"><img src="https://omicreate.github.io/pickleball-iq/og.png" alt="Pickleball IQ" width="480"></a>

ピックルボールのタイプ診断（6パラメータ・全30タイプ）。
*A pickleball type diagnosis — 6 parameters, 30 types.* **日本語**

### [ホークアイ先生とあそぼ](https://omicreate.github.io/softtennis-asobi/) ・ Hawkeye-sensei to Asobo

<a href="https://omicreate.github.io/softtennis-asobi/"><img src="https://omicreate.github.io/softtennis-asobi/ogp.png" alt="Hawkeye-sensei to Asobo" width="480"></a>

ミニゲーム集のソフトテニス版。
*The soft tennis version of the party games.* **日本語**

> ソフトテニスは、柔らかいゴムボールを使う日本生まれのラケット競技です。
> *What is soft tennis?* A racket sport played with a soft rubber ball, born in Japan and popular across East Asia.

## ショート動画 / Short videos

試合の判断力を鍛える3択クイズ動画を投稿しています。
*Three-choice quiz videos that train game sense — rules, positioning and doubles tactics. (Japanese)*

- **Soft Tennis IQ** — [Instagram](https://www.instagram.com/softtennis_iq/) ・ [Threads](https://www.threads.com/@softtennis_iq) ・ [YouTube](https://www.youtube.com/@softtennis_iq) ・ [TikTok](https://www.tiktok.com/@softtennis_iq)
- **Pickleball IQ** — [Instagram](https://www.instagram.com/pickleballiq_jp/) ・ [Threads](https://www.threads.com/@pickleballiq_jp)

## 作り方 / How I build

- **Stack:** TypeScript ・ React ・ Vite ・ PWA (offline via service worker) ・ Vitest ・ Playwright ・ GitHub Actions → GitHub Pages
- **ルールは公式と照合。** ルールの内容は最新の公式ルールと照らし合わせ、ソフトテニスの問題には根拠の条番号をつけています。
  <br><sub>*Grounded in the official rules.* Rule content is checked against the current official rulebooks; soft tennis questions cite the article they are based on.</sub>
- **公開前にテスト。** push するたびにテストを回し、通ったときだけ公開します。
  <br><sub>*Tested before every release.* Each push runs the tests, and the app is published only if they pass.</sub>
- **プライバシー優先。** ログイン・広告・Cookie なし。記録は端末の中だけに保存し、送るのは、だれのものか分からない利用の記録（どのリンクから来たか、どのゲームを遊んだか など）だけです。ブラウザの「追跡しない」（DNT・GPC）がオンなら何も送りません。
  <br><sub>*Privacy first.* No login, no ads, no cookies. Your records stay in your browser; the apps only send anonymous usage data (which link you came from, which game was played — never names, device IDs or cookies), and respect Do Not Track / Global Privacy Control.</sub>
- **オープンソース。** アプリのコードは MIT ライセンスで公開しています（キャラクター・絵・問題は対象外）。
  <br><sub>*Open source.* App code is MIT-licensed; characters, art and questions stay mine.</sub>
- **人は舵取り、AIが実装。** コードは AI エージェントが書きます。企画・ルールとの照合・テストの確認・最終判断は自分で行います。
  <br><sub>*Human-led, AI-built.* I don't write the code myself — AI agents do. I plan, check against the rules, review the tests and make the final calls.</sub>
