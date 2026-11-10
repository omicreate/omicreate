# ピックルコール

**Pickle Call** — a pickleball score caller for the phone or tablet beside the court.
Tap the team that won the rally. The app shows and speaks the next score call (e.g. "4-2-1"), the server, which side they serve from and who receives, on a court diagram. It explains each step with the rule number, and a short 3-choice quiz helps you learn to call the score yourself.

- **Use:** https://omicreate.github.io/pickle-call/ (planned; free, no sign-up, works offline)
- **Languages:** Japanese / English (switch in Settings, or open with `?lang=en`)
- **Rules:** based on the USA Pickleball Official Rulebook 2026 (checked 2026-11-06). Not an official app and not affiliated with USA Pickleball.
- **Privacy:** no account, no cookies, no ads. Games, names and settings stay in this device's browser. Anonymous counts are sent only if a counter URL is set at build time, never names or scores, and never with Do Not Track / GPC on.
- **License:** code MIT ([LICENSE](LICENSE)); icon, texts and quiz content © 2026 omicreate, all rights reserved ([NOTICE.md](NOTICE.md)).

*The rest of this README is in Japanese.*

---

ピックルボールの得点係アプリです。ラリーが終わるたびに勝ったチームを1回タップするだけで、次のコール（例: 4-2-1）、サーバー、サーブする位置、レシーバーを、大きな数字・コート図・読み上げで教えます。
体験会・練習会の主催者や、得点係を頼まれた人が、コート脇のスマホかタブレット1台で使うことを想定しています。数え方は条番号つきで説明し、3択の「学ぶ」で覚えて、自分でコールできるようになったら卒業できます。

## 公開URL

- 使う: https://omicreate.github.io/pickle-call/ （公開予定）
- リポジトリ: https://github.com/omicreate/pickle-call （公開予定。いまは omicreate のリポジトリの `apps/pickle-call/` にあります）

## 主な機能

- **スコア係**: 勝ったチームのボタンを押すと、コール（ダブルスは3つの数字、シングルスとラリー方式は2つ）、サーバー、右から／左から、レシーバーを表示して読み上げます。
  - 0-0-2 で始まること、得点したらサーバーが左右を入れ替えること、サイドアウト後は右の人から打つことを、コート図の立ち位置で示します。
  - 「1手戻す」は何手でも戻せます。現実とずれたら「スコアを直す」で合わせられます。
  - ゲームポイント、サイドアウト、エンドチェンジの目安を知らせます。「なぜこのスコア？」で理由と条番号を見られます。
- **試合の設定**: ダブルス／シングルス、サイドアウト方式／ラリー方式（仮規則）、11／15／21点、2点差、名前（任意のニックネーム）、最初にサーブするチーム。「前回の設定ではじめる」で1タップで始められます。
- **結果**: 勝ったチーム、ラリー数、サイドアウト数、時間。「次のゲーム」（エンドとサーブ権を交代）や、結果の共有（端末の共有機能。使えなければコピー）ができます。
- **学ぶ（3択）**: 実際の場面から「次のコールは？」「次にサーブするのは？」を選ぶ12の場面。5問ずつ、間違えた場面から優先して出します。解説には条番号がつきます。`#/learn?scene=start-call` のように場面を直接開けます。
- **数え方とルール**: スコア係がつまずきやすい10の要点を、条番号と出典つきでまとめています。
- **履歴**: 終わったゲームを新しい順に100件まで残します（端末の中だけ）。
- **設定**: 言語（日本語／英語）、画面の色（自動／明るい／暗い）、高コントラスト（日差しの下でも読みやすい白黒）、読み上げのオンオフと速さ、数字の読み方（フォー・ツー・ワン／よん・に・いち）、画面を消さない（Wake Lock）、名前を履歴に残すか、匿名の回数を送るか、データをすべて消す。
- **オフライン**: 一度開けば、電波のない場所でも動きます（Service Worker）。ホーム画面に追加して、アプリのように使えます。

## 使い方

1. 公開URLを開きます（ホーム画面に追加しておくと、オフラインでも開けて、記録も消えにくくなります）。
2. 「試合をはじめる」で形式と点数を選び、「開始」を押します（ここで読み上げが有効になります）。
3. ラリーが終わるたびに、勝ったチームのボタンを1回押します。コールと立ち位置が出て、読み上げられます。
4. 押し間違えたら「1手戻す」、現実とずれたら「スコアを直す」を使います。
5. ゲームが終わると結果が出ます。「次のゲーム」か、新しい試合を選びます。

数え方を覚えたいときは、ホームの「学ぶ（3択）」から始めます。

## データ/プライバシー

- **アカウント登録はありません。** ログイン・Cookie・広告・他社の解析ツールは使いません。
- **保存場所**: 設定、進行中の試合、前回の設定、履歴、学ぶの記録は、このブラウザの localStorage（端末の中）だけに保存します。キーはすべて `pickle-call:` で始まります（同じ omicreate.github.io にある姉妹アプリの記録とは混ざりません）。設定の「データをすべて消す」で、`pickle-call:` のキーだけを消せます。
- **名前**: 入力は任意です。ニックネームをおすすめします。名前は端末の外に送りません。設定で「名前を履歴に残す」をオフにすると、これから終わるゲームは名前なしで残ります。
- **外部への送信**: 実行中に外へ通信するのは、次の「匿名の回数」だけです（フォント・CDN・画像などは読み込みません）。
  - ビルド時に環境変数 `VITE_COUNTER_URL`（https の URL。例: 自分の Google Apps Script の受け口）を設定したときだけ送ります。**未設定（空）のビルドは何も送りません。**
  - 送るのは、公開URL（`https://omicreate.github.io/pickle-call/`）のホストで開いたときだけです。
  - 送る項目: アプリ名（`pickle-call`）、できごと（開いた `open`・試合を始めた `start`・ゲームを終えた／学ぶを終えた `finish`・結果を共有した `share`）、アプリの版、形式の短いコード（例: `d-so-11` ＝ダブルス・サイドアウト・11点。学ぶは `learn`、共有は `result`）、リンクについていた流入元の印（`?src=` があったときだけ）、ホーム画面から開いたか（`open` のときだけ）。
  - 送らないもの: 名前、スコア、端末ID、Cookie、位置、言語の設定。
  - ブラウザの「追跡しない」（Do Not Track）か Global Privacy Control がオンのとき、または設定で「匿名の回数を送る」をオフにしたときは送りません。
  - 送り方は `fetch`（GET・no-cors・Cookie なし・リファラーなし）です。失敗しても無視します。送り先は CSP（`connect-src`）で Google Apps Script のドメインだけに限っています。
  - 送る内容は、アプリの「数え方とルール」の画面にも書いてあります。
- ブラウザによっては、しばらく開かないと保存した記録が消えることがあります（特に iOS）。ホーム画面に追加すると消えにくくなります。

## 権利/ライセンス

- **コード**: MIT License（[LICENSE](LICENSE)）。
- **コード以外**: アイコン、アプリ名とロゴ、OGP画像、画面の文言、ガイドの文章、学ぶの問題文と解説は © 2026 omicreate（All rights reserved）。MIT の対象外です。詳しくは [NOTICE.md](NOTICE.md)。
- USA Pickleball 公式ルールブック 2026年版をもとに作成していますが、**公式アプリではありません**。USA Pickleball とは関係がなく、承認も受けていません。USA Pickleball のロゴは使っていません。
- ルールブックの条文は転載していません（ルールブックに無断転載禁止の表示があるため）。アプリには要約と条番号と出典へのリンクだけを載せています。
- アイコンとOGP画像は、このアプリのために作ったオリジナルです。他社のロゴやキャラクターは使っていません。

## ルールの出典

- **USA Pickleball Official Rulebook 2026**（2026-11-06 に照合）
  - 公式ページ: https://usapickleball.org/rules/
  - 照合に使った掲載版（PDF、Pickleball Canada 掲載）: https://pickleballcanada.org/wp-content/uploads/2026/03/2026-Official-Rulebook-EN.pdf
  - 2026年版の変更点（Change Document）: https://pickleballcanada.org/wp-content/uploads/2026/04/2026-Rulebook-Change-Document-EN.pdf
- 2026年版で章立てと条番号が全面的に変わりました。アプリの条番号はすべて2026年版のものです。主に使う条:
  - 4.A 得点（サーブ側だけが得点）、4.B・15.C ゲームの勝ち（11／15／21点、2点差）
  - 5.A.1〜5.A.3 シングルスのサーブ位置とサイドアウト
  - 5.B・5.B.2・5.B.3・5.B.5・5.B.6 ダブルスのサーブ順、1人目／2人目のサーバー、立ち位置
  - 5.C〜5.C.2 位置の誤り（アプリは裁定せず、正しい位置を示すだけ）
  - 6.B.1・6.B.2 コール（シングルスは2つ、ダブルスは3つの数字。開始は 0-0-2）、6.D コールから10秒以内のサーブ
  - 14.A〜14.A.5 ラリー方式（仮規則。使うかは主催者が決めます）、Change Document 20番（レシーブ側も決勝点を取れる）
  - 21.B.1〜21.B.4 エンドチェンジの目安、21.F.2・21.F.3 ゲーム間の交代
- 日本語の用語は、日本ピックルボール協会のルール解説に合わせています: https://japanpickleball.org/pickleball/rule/
- 規則のデータは `src/domain/rules/usap-2026.ts`、計算は `src/domain/engine.ts`（純粋な関数）にあります。条番号つきのゴールデンテストは `src/domain/engine.test.ts` です。

## 技術構成

- 実行方式: 静的サイト（Vite 8 + React 19 + TypeScript strict）。サーバーは要りません。
- 画面の切り替え: ハッシュ（`#/play`、`#/learn?scene=…`）。Vite の `base` は `'./'`（相対）なので、GitHub Pages の `/pickle-call/` でも、ほかの置き場所でも同じビルドで動きます。
- PWA: 手書きの `public/sw.js`（ひな形）に、ビルド後 `scripts/build-sw.mjs` が版と事前キャッシュの一覧を埋め込みます。ページはネット優先（つながらなければキャッシュの `index.html`）、JS・CSS・アイコンはキャッシュ優先です。`public/manifest.webmanifest`、アイコンは `public/icon*.svg` から `scripts/build-icons.mjs` で PNG にします。
- 読み上げ: ブラウザの Web Speech API（speechSynthesis）。音声ファイルや外部の音声サービスは使いません。
- 書体: システムフォントだけ（Web フォントは読み込みません）。
- 主なファイル:
  - `src/domain/` 純粋なロジック（スコア計算、立ち位置、コール、学ぶの場面）
  - `src/infra/` 保存・読み上げ・Wake Lock・共有・匿名の回数
  - `src/ui/` 画面と部品、`src/i18n/` 日本語と英語の文言、`src/design/` デザイントークン（明るい／暗い／高コントラスト）
  - `scripts/` ビルド用のスクリプト（Service Worker、アイコン、OGP、1ファイル版、公開前チェック）
- テスト: Vitest（ロジックのゴールデンテストと性質テスト）、Playwright + @axe-core/playwright（画面の流れとアクセシビリティ）。
- 外部ライブラリ（実行時）: React と React DOM だけです。

## 開発

Node.js 22 を使います。

```sh
npm ci                  # 依存を入れる（package-lock.json のとおり）
npm run dev             # 開発サーバー
npm test                # 公開前チェック（check:public-info）と単体テスト（Vitest）
npm run build           # 型チェック → dist/ に出力 → dist/sw.js に事前キャッシュの一覧を埋め込む
npm run test:e2e        # 画面の流れとアクセシビリティを確かめる（Playwright。CI では build のあとに実行）
npm run build:artifact  # claude.ai で試せる1ファイル版を dist-artifact/index.html に作る
```

- 初めて E2E を動かすときは `npx playwright install --with-deps chromium` でブラウザを入れます。
- E2E（`e2e/`）は `dist/` を `vite preview`（ポート 4176）で配信して試すので、先に `npm run build` をします。Chromium のモバイル表示（Pixel 7）ですべてを、幅360×高さ740の小さな電話でレイアウト（横スクロールなし・スコア係の主要な要素がスクロールなしで見える）を確かめます。読み上げと Wake Lock は差し替えて記録します。WebKit（iPhone）のスモークテストはまだありません。
- `npm run icons` は `public/icon.svg` と `public/icon-maskable.svg` から PNG（192・512・maskable・apple-touch-icon）を作ります。`npm run ogp` は `scripts/ogp.html` を撮って `public/ogp.png`（1200×630）を作ります。どちらも直したときだけ実行し、できた画像をコミットします（日本語の書体が入っている端末で撮り、文字化けがないか画像を見て確かめます）。
- `npm run build:artifact` は `VITE_NO_SW=1` で別にビルドし、JS と CSS とアイコンを1つの HTML に埋め込みます（Service Worker を登録しない、CSP の meta と manifest のリンクを外す）。本番の `dist/` には触れません。
- 匿名の回数を試すときは、ビルド時に `VITE_COUNTER_URL` を渡します（公開URL以外のホストでは送りません）。
- `npm run check:public-info` は、端末の中のパスや開発用の住所など、公開してはいけない文字列が入っていないかを調べます。

## 実機で確かめること

次の点はまだ実機で確かめていません（**未確認**）。確かめたら、結果をここに書きます。

| 確かめること | 結果 |
|---|---|
| iOS Safari で日本語の読み上げが出るか。最初の「開始」のタップで有効になるか | 未確認 |
| iOS のホーム画面に追加したアプリで、読み上げが出るか | 未確認 |
| Android Chrome で、オフラインでも日本語の読み上げが出るか（端末の読み上げエンジンしだい） | 未確認 |
| iOS 18.4 以上のホーム画面のアプリで、試合中に画面が消えないか（Wake Lock） | 未確認 |
| 屋外の日差しの下で読めるか（高コントラストを含む）、読み上げが聞こえるか | 未確認 |
| 機内モードで起動して、スコア係が使えるか | 未確認 |

参考: Screen Wake Lock は、iOS Safari では 16.4 から一部対応（ホーム画面のアプリでは動かない）、18.4 から完全対応とされています（MDN の互換データ）。

## 公開のしかた

### (a) おすすめ: 専用の公開リポジトリ `omicreate/pickle-call` を作る

1. GitHub で public リポジトリ `omicreate/pickle-call` を作ります。
2. このフォルダ（`apps/pickle-call/`）の中身を、そのリポジトリの一番上にコピーして push します（`node_modules/`・`dist/`・`dist-artifact/`・`test-results/` は除く。`.gitignore` に入っています）。
3. リポジトリの Settings > Pages > Build and deployment の Source を「GitHub Actions」にします。
4. `main` に push すると、`.github/workflows/deploy.yml` がテスト（単体・E2E）とビルドを通したときだけ、`https://omicreate.github.io/pickle-call/` に公開します。
5. 匿名の回数を集めるときは、Settings > Secrets and variables > Actions > Variables に `VITE_COUNTER_URL` を追加します（空なら何も送りません）。

### (b) このリポジトリに置いたままにする

`.github/workflows/pickle-call.yml` が、`apps/pickle-call/` を変えた push と pull request のたびに、公開前チェック・単体テスト・ビルド・E2E を動かします。ここからは公開しません（GitHub Pages への公開は (a) で行います）。
