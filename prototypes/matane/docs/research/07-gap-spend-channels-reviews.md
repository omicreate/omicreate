# 個人美容師の支出・予約経路・既存ツールへの不満（key: gap_1_solo_stylist_spend_channels_reviews）

調査日: 2026-11-07 ／ 対象: 1人サロン・業務委託・面貸し・シェアサロン利用の美容師
目的: 企画の前提 (a)『払える額は月1,000〜3,000円』と (b)『予約窓口の一本化と DM 返信の負担が最優先』を、実データで検証する。

凡例: **fact**＝出典を実際に開いて確認した ／ **estimate**＝推定、または二次情報からの計算 ／ **unverified**＝検索結果の要約だけで、本文は確認していない

---

## 0. 結論

| 主張 | 判定 | 理由（要約） |
|---|---|---|
| (a) 払える額は月1,000〜3,000円 | **部分的に支持。ただし未検証の推定のまま** | カルテ・予約の運用ツールは0〜2,000円の帯に集まっている（LiMEのカルテ管理380〜1,980円、無料枠での運用）。一方で、客を連れてくる媒体には月1万〜数万円を払っている（minimoの1件110〜880円、HPBの個人実例で月1.1万〜9.9万円）。支払い意思額（WTP）を直接聞いた調査は見つからなかった。「運用ツールなら」という条件付きで妥当、という位置づけ。 |
| (b) 予約窓口の一本化と DM 返信の負担が最優先 | **「最優先」は支持されない（反証寄り）** | 経路の分散そのものは事実で、1人あたり2〜3経路の事例がある。しかし、既存ツールの低評価レビューで最も多い不満は、ログイン・入力の手間・動作の重さだった。同期の不満は16件中1件、DM 返信の不満は0件。悩みの調査でも、上位は集客・収入・客単価である。DM 負担の数字は、ツール開発者の note に出てくる例示だけだった。 |

## 1. 方法と限界

- **WebSearch は1回しか実行できなかった**（ワークフロー全体で共有する検索上限に達したため）。以降は、既知の公式URL・前段レポートに載っていたURL・公開ページを WebFetch や curl で直接開いて確認した。このため、note・知恵袋・税理士ドットコムの横断的な検索、AIR SALON・SALON VILLAGE・リジョブの調査探しは**できていない（未確認）**。
- **App Store**: 日本版の公開レビューページ（`?see-all=reviews`）に埋め込まれた表示分を読んだ。1アプリあたり約10件で、並び順は App Store の既定。新しい順ではなく、2017〜2026年の投稿が混ざっている。依頼の「★1〜2と★4〜5を各20件」には**届いていない**。非公開の旧レビューAPIは使っていない。
- **Google Play**: パッケージIDを確認できたのは美歴 for Business（`jp.bireki.stylist`）だけで、表示されていたレビューは1件。LiME 公式サイトにある Play のリンクは404だった（2026-11-07）。SALON BOARD・STORES予約・SHAiRE for crew の Play版は、ID を特定できなかった。
- **Airリザーブ**: リクルートの開発元アプリ一覧（iTunes Lookup API）に iOS アプリがなかった。Web専用とみられる（estimate）。
- **STORES予約**: アプリのIDを特定できず、レビューは未取得。

---

## 2. 現在の支出（実額・公表料金）

| # | 項目 | 金額 | 時点 | 種別 | 出典 |
|---|---|---|---|---|---|
| 1 | minimo 手数料（来店1件ごと、税込） | 施術0円→110円、〜2,200円→440円、〜6,600円→660円、6,601円以上→880円。新規・リピーターの区別なし。個人なら本人払い | 2026-02-01来店分から（記事は2026-10-02更新） | fact（二次）。公式規約ページは本文を取得できず**未確認** | esthemachine-ec |
| 2 | 同上の当事者の声 | 「2月から0円でも手数料がかかる」「手数料が高く運営に掲載側は搾取されている」 | 2026-01-20 | fact | minimo App Store レビュー |
| 3 | LiME カルテ管理プラン（税抜） | 月380〜1,980円（総売上に連動。例: 37〜52万円→1,020円、85万円以上→1,980円） | 2026-11-07 閲覧 | fact | LiME 料金ページ |
| 4 | LiME ネット予約プラン（税抜） | 月980〜5,780円（売上連動。STEKiNA 登録で最大2,000円引き、レビュー1件ごとに100円引き） | 同上 | fact | 同上 |
| 5 | LiME 利用者の実態 | 「100人超えてるけど全て無料の範囲で使ってます」 | 2019-05-04 | fact（1件の事例） | LiME App Store レビュー |
| 6 | 美歴 Personal（スタッフ1名） | 月8,800円、初期0円〜（税の区分と契約期間は記載なし）。別途、App Store の説明文には「個人利用なら基本機能・規定枠まで無料」 | 2026-11-07 | fact | 美歴 料金ページ／美歴 for Business App Store |
| 7 | 美歴 有料利用者の声 | 「毎月の料金がもう少し下がってくれるといい」 | 2025-02-19 | fact | 美歴 for Business App Store レビュー |
| 8 | HPB 個人サロンの実例（ネイル。ヘアではない） | 開業時は99,000円プランを半年 → 11,000円前後を約2年 → EPRP が月1万円前後から約2.7万円前後に値上がりして無料プランへ → 2024年6月から66,000円プラン（年契約なら月55,000円）を半年 → 現在は無料プラン | 2026-03-07 投稿 | fact（個人の事例） | note（ふじこ） |
| 9 | HPB SSプラン | 個人サロン向けで、固定費を抑えたプラン。1年契約で自動更新。**金額は非公開** | 2026-08-25 更新 | fact（金額は**未確認**） | Square 記事 |
| 10 | HPB 掲載費の幅 | 「月額2万〜25万円」「最低プランは月2万円程度」（根拠の記載なし） | 2026-11-02 更新 | 記事の記述はfact、数値はestimate扱い | jinrai |
| 11 | HPB 都心のコアエリア | 「月額40万円超」。ポイント手数料2%（競合事業者 Hairbook の主張） | 2025-07-27 | fact（主張） | note（Hairbook CEO） |
| 12 | HPB 予約手数料 | 共通ネット予約利用料は施術料金の1%＋ポイント原資の負担（SSプランなどは率が異なる場合あり）。別の記事では2% | 2026-08／2026-05 | fact（二次） | Square／freee |
| 13 | SALON BOARD 利用者の声 | 「12ヶ月で数十万の支払い」（月数万円に相当、estimate）、「毎月高額払ってるのに」 | 2022-01-10／2019-12-19 | fact | SALON BOARD App Store レビュー |
| 14 | LINE 公式アカウント（税別） | 0円（200通）／5,000円（5,000通）／15,000円（30,000通、追加は〜3円/通） | 追加メッセージ料金は2026-10-01に改定 | fact | LINEヤフー for Business |
| 15 | LINE ビューティープラス（税別） | 初期30,000円、年契約14,000円/月（一括払い）、月契約17,500円/月、2名以上で11,000円/月を加算。年契約は2027年8月まで半額の7,000円/月 | 2026-11-07 閲覧 | fact | LINEヤフー サービスページ |
| 16 | SHAiRE アプリ（他店利用、税込） | 予約・顧客管理5,500円/月、決済1,100円/月（初期33,000円）、決済手数料2.545〜2.945%。GO TODAY の店舗では無料 | 同上 | fact | GO TODAY |
| 17 | Airリザーブ（税込） | フリー0円／ベーシック5,500円／スタンダード11,000円 | 同上 | fact | Airリザーブ |
| 18 | STORES予約（税込） | フリー0円（月50件）／スモール9,790円（年契約）・12,980円（複数月契約、200件）。CSV出力はビジネス28,600円から | 同上 | fact | STORES |
| 19 | Square予約 | フリー0円／プラス3,000円／プレミアム8,000円（店舗ごと）。Googleカレンダー同期と自動予約確認はプラス以上 | 同上 | fact | Square |
| 20 | freee予約 | 月3,180円 | 2025-12-10 更新 | fact（二次） | freee 記事 |

### 支出の分布（目安）

| 区分 | 下限 | 上限 | 中央値の目安 | 種別 |
|---|---|---|---|---|
| 運用ツール（カルテ・予約・配信） | 0円（無料枠だけで運用する例がある） | 8,800円（美歴 Personal）〜14,000円（LINE ビューティープラス） | 1,000〜5,000円。月売上50〜85万円で LiME を使う場合、カルテのみで1,020〜1,980円、ネット予約を足すと3,920〜7,760円（税抜） | estimate（公表料金からの計算） |
| 集客媒体を含めた合計 | 0円（紹介・SNSのみ） | 25万〜40万円超（都心の HPB、根拠の弱い主張） | 1.5万〜3万円。minimo で新規20件×660〜880円＝1.3万〜1.8万円、または HPB 低価格プランの実例1.1万〜2.7万円に、LINE・カルテを加える | estimate（実態調査はなく、n＝0） |

---

## 3. 個人の予約経路の構成

### 3.1 公表調査

| 調査 | 主体・時点・n | 内容 | 個人美容師への当てはめ | 種別 |
|---|---|---|---|---|
| 美容センサス2026年上期（美容室編） | リクルート。実査は2026-01-21〜02-12。女性のネット予約方法は n=5,118（複数回答） | 女性の予約方法: 電話19.5%（前年比1.5pt減）、ネット予約計58.1%。ネット予約の内訳は、予約サイト・アプリ（HPBなど）42.6%、サロンのホームページ7.0%、LINE 7.0%、サロン独自のアプリ3.6%、Instagram 1.1% | **生活者側のデータで、個人美容師の経路比率ではない**。根拠としては中程度 | fact |
| 美容サロン就業実態調査 2025年版・2026年版 | リクルート。2026年版は2026-04-24公表、本調査は2026-02-16〜24、美容師は1,038s | 雇用形態を聞いている。美容師（n=2,833、スクリーニング段階）は、オーナー36.4%、オーナー以外の正社員39.3%、業務委託・フリーランス4.2%。目次に**予約経路・集客・ツール支出の設問はない** | 雇用形態別に予約経路をクロス集計することは**できない** | fact |
| GO TODAY | ニュース一覧の1ページ目に調査記事はなかった。累計1,300人以上がフリーランス美容師に、毎月40人が独立 | SHAiRE が明記している予約の受け口は、顧客アプリ経由だけ | 経路比率のデータはない | fact |
| SALOWIN | 自社データ（n・時点の記載なし） | 悩みの上位は集客、客単価の伸び悩み、SNS運用の負担。平均月売上は専有席1面あたり80万円、平均客単価13,000円。**経路の構成比はない** | — | fact |
| MIXI（minimo）・LiME | 経路に関する調査は見つからなかった | — | — | fact（見つからなかったこと） |
| AIR SALON・SALON VILLAGE・リジョブ | 検索上限のため調べていない | — | — | 未確認 |

### 3.2 個別の事例（**事例であり、統計ではない**）

1. 業務委託10年目の美容師: 友人は LINE、ほかに HPB と電話。HPB 経由の予約は店の都合で断れない（知恵袋、2026-03-28）。—fact
2. minimo 掲載者: minimo と SALON BOARD を連携。掲載停止中にも予約が成立して客が来店したが、PCにも携帯にも通知がなく、画面にも反映されていなかった（App Store、2019-10-27）。—fact
3. SHAiRE for crew 利用者: 予約は LiME、決済だけ SHAiRE を使い分けている（App Store、2024-10-18）。—fact
4. LiME 利用者: LINE 連携で予約を受け、予約時にチャットで要望を聞いている（App Store、2020-11-05／2020-03-24）。—fact
5. HPB 経由の予約で無断キャンセル。連絡手段は電話とメール（知恵袋、2025-01-17）。—fact
6. ネイルの個人サロン: HPB の有料プランと無料プランを何度も行き来している（note、2026-03-07）。—fact
7. AI DM 返信ツールの開発者: β ユーザーの印象として「DMの6割前後が確認・予約」。施術後に40〜50件たまるという場面は例示（note、2026-05-31）。—fact（ただし数値は実測ではない）

### 3.3 比率の目安

- 生活者全体（女性）: HPB などのサイト約43%、電話約20%、LINE 7%、ホームページ7%、Instagram 約1%（根拠: **強**。ただし個人美容師の比率ではない）。—fact
- 個人美容師: **公表されたデータはない**。事例からは、1人あたり2〜3経路（媒体＋LINE か電話＋紹介）を併用していると読める（根拠: **弱**）。—estimate
- Instagram DM は生活者全体では1.1%と小さい。個人美容師では高い可能性があるが、根拠はない。—estimate

---

## 4. 既存ツールへの不満（App Store 日本版の公開表示分。2026-11-07取得）

| アプリ | 評価（件数） | 称賛 | 不満 |
|---|---|---|---|
| SALON BOARD | ★1.6（57） | 少数（iPad の自動入力を求める★5が1件） | 頻繁なログイン要求（9件中7件）、入力中の操作ブロック、反応の遅さ、Apple Pencil が効かない、高い掲載費、サポートにつながらない |
| LiME | ★4.2（2,836） | サポートと改善の速さ（8件中7件）、LINE 連携で客の手間がゼロ、UI | バグ、サポートがチャットとAIだけ、料金への不満が他にあることへの言及。表示分は2017〜2020年の投稿 |
| 美歴 for Business | ★4.2（58）。Google Play は500＋DL | カルテが楽、担当者の対応が速い、クラウド保存で機種変更しても消えない | 入力途中でポップアップが出てカルテが全部消えた（★1）、月額を下げてほしい、写真の速度 |
| SHAiRE for crew | ★3.5（33） | 決済 | 不具合で決済できない、強制アップデート、メニューを削除できない、一括既読ができない、横画面に非対応 |
| minimo（顧客アプリ。掲載者の投稿4件のみ） | ★4.7（313,976。大半は顧客） | — | 2026年2月からの手数料、直前・当日キャンセルの多さ、口コミ審査がない、連携先に予約が反映されない、サポート |
| 美歴 for Business（Google Play） | — | 複数スタッフで共有できる | バックアップ機能がほしい（★5） |

### 不満カテゴリ別の件数（1件のレビューを複数カテゴリに数える）

標本: 計40件。内訳は★1〜2が16件（うち LiME の1件は本文が称賛で、評価と本文が食い違うため除外）、★4〜5が21件、★3が3件。

| カテゴリ | ★1〜2（n=16） | ★4〜5（n=21、要望として） | 合計 |
|---|---|---|---|
| 料金・値上げ | 4 | 1 | 5 |
| 入力の手間 | 5 | 1 | 6 |
| 予約の同期・二重予約 | 1 | 0 | 1 |
| データ移行・持ち出し | 0 | 1（バックアップの要望） | 1 |
| サポート | 3 | 1 | 4 |
| 動作の重さ・オフライン（不具合を含む） | 5 | 3 | 8 |
| （その他）ログインの頻度・不可 | 7 | 1 | 8 |
| （その他）キャンセル・客質、強制アップデート | 2 | 0 | 2 |
| （称賛）サポートの速さ | — | 10 | — |

種別: 件数は fact（表示分を数えたもの）。傾向として一般化するのは estimate。標本が小さく、SALON BOARD に偏っている点に注意。

---

## 5. LINE ビューティープラス

- 提供開始は**2026-09-08**。プレスリリースの表記は「本日より開始」で、対象はヘアサロン（少人数運営を想定）。—fact
- 料金（税別）: 初期サポート30,000円、年契約14,000円/月（1年分を一括払い）、月契約17,500円/月。2名以上は11,000円/月を加算。キャンペーンで、2027年8月までに年契約すれば7,000円/月、2027年10月まで複数スタッフ料が無料。無料トライアルはない。利用開始まで約5〜6週間。—fact
- **1人サロン専用のプランはない**。1名なら加算がないだけ。LINE 公式アカウントの月額プランが別途必要かどうかは、マニュアルにも書かれていない（未確認）。—fact
- 機能: LINE 上での予約、リマインド、カルテ（写真最大6枚）、カウンセリングシート、空席配信、分析、専用アプリ。外部予約サイトとの連携は「かんざし連携」（問い合わせ制、最低3か月）。Square ターミナル連携は2027年春頃の予定。—fact

## 6. 規模

| 指標 | 値 | 時点 | 種別 |
|---|---|---|---|
| minimo 登録者（美容師・ネイリスト・アイデザイナーなど） | 4万人以上 | 日付の記載なし（MIXI 事業ページ） | fact（時点は不明） |
| minimo（2016年） | 登録者2万人以上、月間ユーザー20万人以上 | 2016-05-30 | fact（古い） |
| LiME 登録美容師数 | **公表は見つからなかった**。「業界シェア No.1（2023年当社調べ）」の表示のみ。App Store の評価件数は2,836件 | 2026-11-07 | fact |
| 美歴 for Business | App Store の評価58件、Google Play 500＋DL | 同上 | fact |
| GO TODAY | 累計1,300人以上がフリーランス美容師に、毎月40人が独立 | 同上 | fact（自社の表示） |

---

## 7. 企画への示唆

1. **価格**: 運用ツールの相場は0〜2,000円帯（LiME のカルテ管理）。無料で十分に使え、有料は月1,000〜2,000円という設計が相場に合う。ただし WTP は未検証なので、LP や事前登録で価格を試す必要がある。「集客につながる」と示せる機能なら、より高い価格も受け入れられる余地がある（estimate）。
2. **最初に解く課題**: 予約の一本化を前面に出すより、**ログイン不要・速い・入力が消えない・オフラインで動く記録**を軸にする方がレビューの実態に合う。経路の分散は「HPB・minimo・LINE・電話の予約を数秒で転記できる台帳」として扱う。
3. **LINE ビューティープラス**（初期3万円＋月7,000〜17,500円）と SALON BOARD は、LINE中心・HPB中心の一元化をすでに提供している。個人向けの低価格版や補完として位置づける。
4. **経路別のコスト可視化**: minimo の1件課金と HPB の固定費を、予約経路ごとの獲得単価として比べられるようにする。
5. **バックアップと持ち出しを無料にする**: 低評価の不満としては少ないが、要望として出ている。

## 8. 未解決

- HPB SSプランの実額（公式は非公開。個人の実額報告は、今回の検索上限のため集められなかった）
- minimo 公式の手数料規約本文（ボット対策で取得できなかった）
- 個人美容師の予約経路比率と WTP（公表データなし。自前の調査が必要）
- Google Play のレビュー、STORES予約・Airリザーブのレビュー
- AIR SALON・SALON VILLAGE・リジョブの調査の有無

---

## 出典一覧（すべて今回の調査で開いたページ）

| # | 出典 | URL | 確認 |
|---|---|---|---|
| 1 | エステマシーン EC：minimo 手数料（2026-10-02更新） | https://esthemachine-ec.com/news/post_1087/ | fact |
| 2 | minimo 利用手数料規約 | https://minimodel.jp/policy/fee | 未確認（本文取得できず） |
| 3 | minimo App Store（レビュー） | https://apps.apple.com/jp/app/id719858778?see-all=reviews&platform=iphone | fact |
| 4 | LiME 料金 | https://limehair.jp/price-list-v2 | fact |
| 5 | LiME トップ | https://limehair.jp/ | fact |
| 6 | LiME App Store（レビュー） | https://apps.apple.com/jp/app/id972351014?see-all=reviews&platform=iphone | fact |
| 7 | LiME Google Play（公式サイトのリンク先） | https://play.google.com/store/apps/details?id=jp.limehair.lime | 404（2026-11-07） |
| 8 | 美歴 料金 | https://bireki.jp/price/ | fact |
| 9 | 美歴 for Business App Store（説明・レビュー） | https://apps.apple.com/jp/app/id1547573731?see-all=reviews&platform=iphone | fact |
| 10 | 美歴 for Business Google Play | https://play.google.com/store/apps/details?id=jp.bireki.stylist&hl=ja&gl=JP | fact |
| 11 | SALON BOARD App Store（レビュー） | https://apps.apple.com/jp/app/id883896559?see-all=reviews&platform=iphone | fact |
| 12 | SHAiRE for crew App Store（レビュー） | https://apps.apple.com/jp/app/id1519746372?see-all=reviews&platform=iphone | fact |
| 13 | iTunes Lookup（リクルートのアプリ一覧） | https://itunes.apple.com/lookup?id=290033993&entity=software&country=jp | fact |
| 14 | note ふじこ（HPB 掲載料、2026-03-07） | https://note.com/nail_33/n/nce9123906667 | fact |
| 15 | note Hairbook CEO（2025-07-27） | https://note.com/shoma0717/n/n484f862bbb9c | fact |
| 16 | Square：HPB 掲載料（2026-08-24） | https://squareup.com/jp/ja/townsquare/the-publication-fee-of-hot-pepper-beauty | fact |
| 17 | shopowner-support：HPB 掲載料（2024-04-19） | https://www.shopowner-support.net/?p=18417 | fact |
| 18 | freee：HPB 手数料（2025-12-10） | https://www.freee.co.jp/personal-business/guide/articles/1907/ | fact |
| 19 | freee：HPB とは（2026-05-01） | https://www.freee.co.jp/kb/kb-reservation-management/what-is-hot-pepper-beauty/ | fact |
| 20 | jinrai（2026-11-02更新） | https://jinrai.co.jp/blog/biyoushitsu-homepage-shukyaku/ | fact |
| 21 | HPB 掲載案内（公式） | https://beauty.hotpepper.jp/doc/keisai/keisai.html | fact |
| 22 | LINE 公式アカウント 料金 | https://www.lycbiz.com/jp/service/line-official-account/plan/ | fact |
| 23 | LINE ビューティープラス サービスページ | https://www.lycbiz.com/jp/service/line-official-account/beauty/ | fact |
| 24 | LINE ビューティープラス プレスリリース（2026-09-08） | https://www.lycbiz.com/jp/news/line-official-account/beauty/20260908/?category=pressrelease | fact |
| 25 | Beauty オプション申込マニュアル（2026-09-09） | https://www.lycbiz.com/jp/manual/OfficialAccountManager/account-settings_plan_beauty/ | fact |
| 26 | GO TODAY SHAiRE アプリ | https://www.shairesalon-go.today/app/ | fact |
| 27 | GO TODAY トップ／ニュース | https://www.shairesalon-go.today/ ／ https://www.shairesalon-go.today/news/ | fact |
| 28 | Airリザーブ | https://airregi.jp/reserve/ | fact |
| 29 | STORES予約 料金 | https://stores.fun/reserve/pricing | fact |
| 30 | Square予約 料金 | https://squareup.com/jp/ja/appointments/pricing | fact |
| 31 | 美容センサス2026年上期 美容室編 PDF | https://hba.beauty.hotpepper.jp/wp/wp-content/uploads/2026/06/census_hair.pdf | fact |
| 32 | 美容サロン就業実態調査 2026 | https://hba.beauty.hotpepper.jp/search/career/77929/ ／ http://hba.beauty.hotpepper.jp/wp/wp-content/uploads/2026/04/data_260424.pdf | fact |
| 33 | 美容サロン就業実態調査 2025 | https://hba.beauty.hotpepper.jp/search/career/65454/ | fact |
| 34 | SALOWIN 集客ロードマップ | https://salowin.jp/note/archives/3872 | fact |
| 35 | note nksktk（DM 返信、2026-05-31） | https://note.com/nksktk_fuu/n/n061763f61ff1 | fact |
| 36 | note kichi（2025-10-06） | https://note.com/yoki1009/n/nce6b0b587df4 | fact |
| 37 | 知恵袋 業務委託10年目（2026-03-28） | https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q10326694900 | fact |
| 38 | 知恵袋 HPB 無断キャンセル（2025-01-17） | https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q10309548695 | fact |
| 39 | MIXI ライフスタイル事業（minimo 4万人） | https://mixi.co.jp/business/lifestyle/ | fact |
| 40 | WWD JAPAN（minimo サロンツール、2016） | https://www.wwdjapan.com/?p=172047 | fact |
