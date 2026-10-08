# omicreate

**Free web apps for racket sports — no install, no sign-up, works offline.**
Made by a solo developer in Japan, together with AI agents.

ソフトテニスとピックルボールの無料Webアプリを、AIエージェントと一緒に個人で作っています。インストールも登録も不要で、オフラインでも動きます。

[Website](https://omicreate.github.io/) ・ [Instagram: Soft Tennis IQ](https://www.instagram.com/softtennis_iq/) ・ [Instagram: Pickleball IQ](https://www.instagram.com/pickleballiq_jp/)

## Apps / アプリ

### [Play with Pikuru](https://omicreate.github.io/pickle-asobi/?lang=en) ・ ピクルくんとあそぼ

<a href="https://omicreate.github.io/pickle-asobi/?lang=en"><img src="https://omicreate.github.io/pickle-asobi/ogp.png" alt="Play with Pikuru" width="480"></a>

Pickleball party games for one phone or tablet. Two players face each other across the screen, and each picks their own level — so kids and adults can play together. **English / 日本語**

1台を囲んで遊ぶピックルボールのミニゲーム集。レベルは1人ずつ選べるので、親子でも勝負になります。

### [Soft Tennis IQ](https://omicreate.github.io/softtennis-iq/) ・ ソフトテニスIQ

<a href="https://omicreate.github.io/softtennis-iq/"><img src="https://omicreate.github.io/softtennis-iq/ogp.png" alt="Soft Tennis IQ" width="480"></a>

Rule drills, a formation board and a match notebook for soft tennis players. **日本語**

ルールドリル・陣形ラボ・試合ノートを1つにまとめた、選手向けのアプリ。

### [Hawkeye-sensei to Asobo](https://omicreate.github.io/softtennis-asobi/) ・ ホークアイ先生とあそぼ

<a href="https://omicreate.github.io/softtennis-asobi/"><img src="https://omicreate.github.io/softtennis-asobi/ogp.png" alt="Hawkeye-sensei to Asobo" width="480"></a>

The soft tennis version of the party games. **日本語**

ミニゲーム集のソフトテニス版。

> **What is soft tennis?** A racket sport played with a soft rubber ball, born in Japan and popular across East Asia.
> ソフトテニスは、柔らかいゴムボールを使う日本生まれのラケット競技です。

## Short videos / ショート動画

Three-choice quiz videos that train game sense — rules, positioning and doubles tactics. (Japanese)
試合の判断力を鍛える3択クイズ動画を投稿しています。

- **Soft Tennis IQ** — [Instagram](https://www.instagram.com/softtennis_iq/) ・ [Threads](https://www.threads.com/@softtennis_iq)
- **Pickleball IQ** — [Instagram](https://www.instagram.com/pickleballiq_jp/) ・ [Threads](https://www.threads.com/@pickleballiq_jp)

## How I build / 作り方

- **Stack:** TypeScript ・ React ・ Vite ・ PWA (offline via service worker) ・ Vitest ・ Playwright ・ GitHub Actions → GitHub Pages
- **Grounded in the official rules.** Rule content is checked against the current official rulebooks; soft tennis questions cite the article they are based on.
  <br><sub>ルールの内容は最新の公式ルールと照らし合わせ、ソフトテニスの問題には根拠の条番号をつけています。</sub>
- **Tested before every release.** Each push runs the tests, and the app is published only if they pass.
  <br><sub>push するたびにテストを回し、通ったときだけ公開します。</sub>
- **Privacy first.** No login, no ads, no cookies. Your records stay in your browser; the apps only send anonymous usage counts.
  <br><sub>ログイン・広告・Cookie なし。記録は端末の中だけに保存し、送るのは匿名の利用回数だけです。</sub>
- **Human-led, AI-assisted.** I plan, review and make the final calls; AI agents help write code and produce videos.
  <br><sub>企画・確認・最終判断は自分で行い、コードや動画づくりをAIエージェントと分担しています。</sub>
