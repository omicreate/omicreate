# Notice / 権利について

**The source code is MIT-licensed (see [LICENSE](LICENSE)). The content below is not.**
It is © 2026 omicreate, all rights reserved — please don't reuse it without permission, even inside a fork.

**コードは MIT ライセンスで自由に使えます。ただし、下のものは MIT の対象外です。**
© 2026 omicreate（無断での転載・再利用はご遠慮ください。フォークの中でも同じです）。

| What / 対象 | Where / 場所 |
|---|---|
| App name, icon and OGP image<br>アプリ名・アイコン・紹介画像（OGP） | `public/icon*`, `public/apple-touch-icon.png`, `public/ogp.png`, `scripts/ogp.html` |
| Quiz scenes, questions and explanations<br>学ぶ（3択）の場面・問題文・解説 | `src/domain/learn.ts`, `src/i18n/learn.ts` |
| Rule summaries and the scoring guide<br>ルールの要約・数え方のガイドの文章 | `src/domain/rules/usap-2026.ts`（summaries / refs の文）, `src/i18n/screens.ts`（guide） |
| Screen text and other written content<br>画面の文言・説明などの文章 | text in `src/i18n/` and `src/` (UI strings), `README.md` |

If you build something from this code, please replace these with your own name, icon, texts and questions.
このコードを使って何か作るときは、アプリ名・アイコン・文章・問題をご自身のものに差し替えてください。

## Rules / ルールについて

This app is based on the USA Pickleball Official Rulebook 2026, but it is **not an official app** and is not affiliated with or endorsed by USA Pickleball. The rulebook text is not reproduced; the app shows short summaries, rule numbers and links to the sources only. No USA Pickleball logo is used.

USA Pickleball 公式ルールブック 2026年版をもとに作っていますが、**公式アプリではありません**（USA Pickleball とは関係がなく、承認も受けていません）。ルールブックの条文は転載せず、要約と条番号と出典へのリンクだけを載せています。USA Pickleball のロゴは使っていません。

Questions / 問い合わせ: open an issue.
