# 海外の個人スタイリスト向けツールと評判（competitors_global）

調査日: 2026-11-07 ／ 対象: Fresha・Vagaro・GlossGenius・Booksy・Square Appointments・StyleSeat（米国版の料金を中心に記載）

種別の凡例: **fact**＝出典ページを実際に開いて確認 ／ **estimate**＝推定・二次情報からの計算 ／ **unverified**＝検索結果の要約のみで本文は見ていない

---

## 0. 要約

- 6社とも「予約・自動リマインド・カード決済・顧客カルテ」は標準装備で、差が出るのは**料金の取り方**。月額は約20〜35ドル（1人利用）で、そこに①カード決済手数料（2.3〜3.3％程度）と②マーケットプレイス経由の新規客手数料（20〜30％）が乗る。
- 個人向けの工夫で目立つのは次の5つ。**デポジット＋無断キャンセル料の自動請求**、**会計時の再予約の促しと施術周期に合わせたリマインド**、**カルテへのフォーミュラ・ビフォーアフター写真の記録**、**面貸し（booth renter）向けの賃料徴収**、**即日入金**。
- 評判（App Store 米国版）では★4.4〜4.9と高評価が並ぶ。ただし低評価レビューの不満は共通していて、**手数料が後から増える、自分で集めた客にも新規客手数料がかかる、入金の保留や口座凍結、サポートにつながらない、意図しない自動請求**の5点に集中している。
- Reddit（r/hairstylist など）は、検索ツールでも取得ツールでも reddit.com にアクセスできず**本文を確認できなかった**。代わりに App Store レビューと Trustpilot で補った。

## 1. 調査方法と限界

- 公式の料金ページ、ヘルプ、App Store の説明文とレビュー一覧ページを WebFetch で開いて確認した。
- reddit.com は WebSearch では対象外ドメインとしてエラーになり、WebFetch でも取得できなかった。このためReddit の声は**未確認**。
- 一部の公式ページは価格が動的表示で、数値を取得できなかった（Square の米国価格、Vagaro の決済手数料）。そうした項目は第三者記事の数値に unverified または estimate を付けて載せた。
- Fresha の日本語料金ページはドル建てで表示された。これはアクセス元の地域による表示の可能性があり、日本で円建ての提供があるかどうかは未確認。

## 2. 主要6サービスの料金比較（米国・2026-11-07時点）

| サービス | 1人利用の月額 | カード決済手数料 | 新規客（マーケットプレイス）手数料 | 種別 |
|---|---|---|---|---|
| GlossGenius | Standard $28（年払いなら$24）／Gold $56／Platinum $168 | 説明文は「2.4%+$0.15」、オンライン請求は2.9%+$0.30 | マーケットプレイス型ではない | fact |
| Vagaro | $23.99（最初の6か月の特別価格。ページには$30も表示）＋1カレンダーごとに$10（7つまで） | 2.75%（対面）とする記事が多い | 「Fill My Books」機能経由の予約に課金（料率は未確認） | 月額はfact、手数料はunverified |
| Fresha | Independent $19.95（1人）／Team $14.95×人数 | オンライン2.79%+$0.20／対面2.29%+$0.20／手入力3.30%+$0.20 | 初回のみ20%（最低$6）。直接リンク・Instagram経由は無料 | fact |
| Booksy | $29.99（＋スタッフ1人ごとに$20） | モバイル・手入力2.69%+$0.30／リーダー2.49%+$0.10 | Boost経由の客は初回来店の30%（上限$100） | fact |
| Square Appointments | Free／Plus／Premium（無断キャンセル料はPlus以上） | 記事ではFreeが対面2.6%+15¢、Plus以上が2.5%+15¢ | なし | プランと機能はfact、価格（$0/$49/$149）と手数料はunverified |
| StyleSeat | Premium $35 | カード提示あり2.5%+$0.30／保存カード2.6%+$0.30 | 初回の30%（上限$50）。混雑枠の20%割増（Smart Pricing）にも5.5%（上限$16.50） | fact（ヘルプ記事の日付は2026-10-02） |

参考（日本）: Square 予約の日本版は フリー無料／プラス¥3,000／プレミアム¥8,000（店舗ごとの月額）。決済手数料は対面2.5%〜、非対面3.75%、オンライン3.6%。—fact

規模感:
- Fresha は「13万以上の事業者、月3,500万件以上の予約」。2026年5月にKKRから8,000万ドルを調達し、評価額は10億ドル超（THE BRIDGE、2026-05-28）。—fact
- GlossGenius は「6万以上のスパ・サロン」、評価額5.1億ドル（TechCrunch、2023-07-27。数字は古い）。—fact

## 3. 個人（ソロ／面貸し）向けの工夫（機能別）

| 機能 | 具体例 | 種別 |
|---|---|---|
| デポジット＋無断キャンセル料 | **StyleSeat**: 定額か％でデポジットを設定でき（Premiumのみ）、無断キャンセル・直前キャンセルの規定（NSLC）が残額を補う。例: デポジット30%＋規定50%なら差分の20%を自動請求。キャンセル料率は施術者が決め、StyleSeatは返金しない。**Booksy**: 「キャンセル規定を設定すれば代わりに執行」。同社は「昨年1,560万ドルをノーショーから回収」と主張。**Square**: 無断キャンセル料はPlus以上 | fact |
| 再予約の促し | **GlossGenius**: 会計時に自動で再予約を促す。**Booksy**: 自動の再予約リマインド。**StyleSeat**: スタイルが崩れる時期（例: ブレイズを外す時期）に合わせて再予約を促す | fact |
| フォーミュラ・写真 | **GlossGenius**: 「formula or preference details」のメモ、ビフォーアフター画像、2枚を並べて比較。**StyleSeat**: 顧客ごとのメモ・写真・履歴。**Square**: 顧客プロフィールに写真・PDFを添付できる（コミュニティの過去回答）。**Vagaro**: App Store説明文では好みとアレルギーのメモのみ確認、フォーミュラ欄は未確認。色剤の計量・原価計算に特化した **SalonScale** という別アプリもある | GlossGenius・StyleSeatはfact、Squareはunverified |
| 自動リマインド | 全社にある。Fresha はメールとアプリ通知が無制限で、SMSは月100通まで無料、超過は$0.02/通。Booksy はSMS月2,000通無料。GlossGenius はメール無制限、テキストは500通 | fact |
| 売上レポート | GlossGenius は人気メニュー・上位顧客・売上の一覧ダッシュボード。Vagaro は「収入・予約を追跡し傾向を把握」 | fact |
| 面貸し（booth renter） | Vagaro は「ブース利用者のスケジュールを色分けで管理」。賃料の自動徴収、歩合を賃料から控除する機能もある | 色分けはfact、賃料徴収はunverified（ベンダーのミラードメインの検索結果） |
| 入金スピード | GlossGenius は同営業日の入金が無料。Booksy は翌営業日が無料、30分入金は1.5% | fact |

デポジットの効果について:
- Kitomba（NZのサロン向けソフト会社）の自社データでは、100%前払いを求めるサロンは前払いなしのサロンより取消・無断キャンセルが平均29%少ない。また平均的なサロンでは予約の10件に1件が取消か無断キャンセルになる（2024-09-26）。対象サロン数や期間は書かれていない。—fact（ベンダーの自社データ）

## 4. 評判（App Store 米国版。数値は2026-11-07時点）

| アプリ | 評価 | 称賛 | 不満 |
|---|---|---|---|
| GlossGenius | ★4.5（4.5K件） | 使いやすい、見た目が良い、サポートが助けてくれる、始めたばかりの個人に向く | 稼働時間中の障害、デポジット予約でデビットカードが通らない、レシートを別の顧客に誤送信（プライバシー懸念）、デスクトップ版が不十分 |
| Vagaro Pro | ★4.4（16K件） | 機能が網羅的、リマインド、即日入金、10年以上使い続けている声 | 新規客が空き枠を見つけにくく電話してくる、予約メニューのカテゴリが全部開いた状態になり客が迷う |
| Booksy Biz | ★4.5（15K件） | 導入支援、メッセージの一斉送信、即日入金 | Boostの手数料（既存客が新規扱いされる）、予告なしのノーショー請求、サポートの長い待ち時間 |
| Fresha for business | ★4.8（約4K件） | 簡単、無料だった頃の評価が高い | 「Google・Instagram経由の客にも新規客手数料がかかった」、月額化と人数課金（「人数課金はしないと約束された」）、SMSが100通を超えると有料、入金の保留、「72時間前で50%」のような段階的なキャンセル料を設定できない |
| Square Appointments | ★4.9（195K件） | 予約ページがきれい、自動確認とリマインド | アプリ内でダークモードを切り替えられない、アップデートで操作手順が増えた、値上げ・バンドル廃止で乗り換えにくい |
| StyleSeat（顧客・施術者共通） | ★4.9（291K件） | 主に顧客側の評価（予約しやすい） | 施術者からは、自分のリンク経由の客に新規客手数料、オフにしたのに自動チェックアウトされる、チャージバックと異議申し立て手数料、期限切れカードを顧客が更新できない |

- Trustpilot の GlossGenius は2.1（13件。標本は少ない）。不満は入金保留が中心で、「約1.8万ドルが約1か月保留された」という声もある。ほかに移行に28日かかり予約約60件が欠落した、本人確認による資金ロックなど。—fact
- Reddit の声（r/hairstylist、r/Hair など）: **未確認**（アクセス不可）。

## 5. 不満の共通パターン

1. **手数料の不透明さと後付け**: マーケットプレイスの新規客判定が誤る。無料機能が有料化される。SMS通数に上限がある。
2. **決済をサービス側が握ることのリスク**: 入金の保留、口座の凍結、チャージバック。サービス本体の決済を使うことが強制される。
3. **サポート**: ボット対応に終始する、返信が数日かかる。
4. **意図しない自動処理**: 自動チェックアウト、予告なしのノーショー請求、誤送信。
5. **キャンセル規定の柔軟性不足**: 時間帯ごとに料率を段階的に変えられない。

## 6. 日本の個人美容師に持ち込めるアイデア

- **段階的なキャンセル規定を予約時に同意させ、その記録を残す**（例: 前日○%・当日○%・無断○%）。請求するかどうかは毎回施術者が判断する。
- **施術周期に合わせた再来提案**: カラーのリタッチ、縮毛矯正、カットの周期を顧客ごとに学習し、「そろそろ」の提案を作る（StyleSeat の「外す時期に合わせた再予約の促し」の日本版）。
- **会計時のワンタップ次回予約**（GlossGenius 型）。
- **構造化カルテ**: 薬剤のブランド・番手・オキシ濃度・放置時間・前回の写真比較。過去回の複製と差分記録ができるようにする。
- **「自分で集客した客は手数料ゼロ」を明示し、マーケットプレイスに依存しない設計**。海外で最も多い不満を最初から避けられる。
- **手取りが見えるレポート**: 業務委託の歩合や面貸しの場所代を差し引いた月次の手取り（Vagaro の賃料管理の個人版）。
- **データの出し入れが簡単なこと**（CSV入出力）。乗り換えコストへの不満への対策になる。
- **送信前の宛先確認**（誤送信の防止）。

## 7. 持ち込めない／調整が必要な点（文化・決済・法令）

| 項目 | 理由 | 種別 |
|---|---|---|
| 高い無断キャンセル料の一律自動請求 | 消費者契約法9条は、解除に伴う違約金のうち「平均的な損害」を超える部分を無効とする。事前の明示と同意も必要とされる。米国型の「100%を自動で請求」はそのまま使えず、メニューや時間に応じて根拠を持たせる必要がある | fact（freeeの弁護士監修記事、2026-08-04更新）。e-Govの条文本文は取得できず未確認 |
| SMS中心のリマインド | 日本では LINE公式アカウントが現実的な連絡手段になる。料金はコミュニケーションプランが¥0で月200通、ライトが¥5,000で5,000通、スタンダードが¥15,000で30,000通。米国のSMS通数前提の設計は合わない | 料金はfact、LINEが主流という点はestimate |
| 決済の抱え込み（自社決済の強制） | 日本では対面2.5%〜（Square JP）などの外部決済やQR決済が広く使われている。海外では決済を握ることが入金保留の不満を生んでいる。まずは外部決済につなぐか記録するだけの方が導入しやすい | 手数料はfact、方針はestimate |
| チップ機能 | 日本ではチップの習慣が一般的ではない | estimate |
| マーケットプレイス集客 | 日本はホットペッパービューティーが大きく、掲載ヘアサロンは6.4万店以上（2025年4月、第三者記事）。新しい集客プラットフォームで正面から競うのは難しい | unverified |
| 出張（モバイル）スタイリスト機能 | 美容師法により業務は原則として美容所で行う。出張は病気の人・儀式の直前・福祉施設入所者などの例外に限られ、届出が必要な場合もある | fact（仙台市、2025-02-16） |
| 写真カルテの共有・活用 | 顔写真は個人情報なので、取得目的の明示や第三者提供の扱いに配慮が必要 | estimate（個人情報保護法の本文は今回未確認） |

## 8. アプリ設計への示唆（まとめ）

- 中心機能は「カルテ（フォーミュラ＋写真）×再来提案×キャンセル規定の同意記録」。決済とマーケットプレイスは持たない。
- 課金はわかりやすい定額にし、通数や人数で後から積み増す形を避ける。
- 自動化はすべて「提案→本人が確定」の形にする。勝手に請求・送信しない。

## 出典一覧

| # | 出典 | URL | 確認 |
|---|---|---|---|
| 1 | GlossGenius Pricing | https://www.glossgenius.com/pricing | fact |
| 2 | GlossGenius Client Management | https://glossgenius.com/client-management | fact |
| 3 | GlossGenius App Store（説明・レビュー） | https://apps.apple.com/us/app/glossgenius-booking-payments/id1081286979 | fact |
| 4 | Trustpilot GlossGenius | https://www.trustpilot.com/review/glossgenius.com | fact |
| 5 | TechCrunch（GlossGenius 2023） | https://techcrunch.com/2023/07/27/glossgenius-raises-28m-to-expand-its-bookings-and-payments-platform-for-beauty-businesses | fact |
| 6 | Vagaro Pricing | https://www.vagaro.com/pro/pricing | fact |
| 7 | Vagaro Pro App Store（説明・レビュー） | https://apps.apple.com/us/app/vagaro-pro/id346778559 | fact |
| 8 | Vagaro 手数料・追加機能（第三者記事） | https://koalendar.com/blog/vagaro-pricing | unverified |
| 9 | Vagaro 賃料徴収（ミラードメイン） | https://as-marketing-wus2-as-marketing-wus2-main.azurewebsites.net/pro/automatic-rent-fees | unverified |
| 10 | Fresha Pricing | https://www.fresha.com/pricing | fact |
| 11 | Fresha for business App Store レビュー | https://apps.apple.com/us/app/fresha-for-business/id1455346253?see-all=reviews&platform=iphone | fact |
| 12 | THE BRIDGE（Fresha 調達、2026-05-28） | https://thebridge.jp/2026/05/fresha-kkr-80m-funding | fact |
| 13 | Booksy Pricing | https://biz.booksy.com/en-us/pricing | fact |
| 14 | Booksy Biz App Store（説明・レビュー） | https://apps.apple.com/us/app/booksy-biz-booking-payments/id725335996 | fact |
| 15 | Square Appointments Pricing（米国） | https://squareup.com/us/en/appointments/pricing | fact（機能のみ） |
| 16 | Square 価格（第三者記事、2026-10-07） | https://koalendar.com/blog/square-appointments-pricing | unverified |
| 17 | Square Appointments App Store レビュー | https://apps.apple.com/us/app/square-appointments-scheduler/id1023050786?see-all=reviews&platform=iphone | fact |
| 18 | Square 顧客プロフィールへの写真添付（コミュニティ） | https://community.squareup.com/t5/Archived-Discussions-Read-Only/Can-I-attach-a-photo-to-a-client-profile/td-p/33142 | unverified |
| 19 | Square 予約 日本の料金 | https://squareup.com/jp/ja/appointments/pricing | fact |
| 20 | Square 日本の決済手数料 | https://squareup.com/jp/ja/pricing | fact |
| 21 | StyleSeat Premium Plan | https://help.styleseat.com/articles/13612504-the-premium-plan | fact |
| 22 | StyleSeat Deposits | https://www.styleseat.com/blog/styleseat-deposits/ | fact |
| 23 | StyleSeat 無断・直前キャンセルの返金 | https://help.styleseat.com/articles/13612497-refund-missed-or-late-cancel-appointment | fact |
| 24 | StyleSeat Braiders | https://styleseat.com/join/braiders | fact |
| 25 | StyleSeat App Store レビュー | https://apps.apple.com/us/app/styleseat-salon-appointments/id414313281?see-all=reviews&platform=iphone | fact |
| 26 | Kitomba（デポジットの効果） | https://www.kitomba.com/blog/deposits-vs-cancellation-fees-salons/ | fact |
| 27 | SalonScale | https://salonscale.com/pricing | unverified |
| 28 | freee（キャンセル料と法律） | https://www.freee.co.jp/kb/kb-reservation-management/cancellation-fees-and-law/ | fact |
| 29 | e-Gov 消費者契約法 | https://laws.e-gov.go.jp/law/412AC0000000061 | 未確認（本文取得不可） |
| 30 | 仙台市 出張理容・出張美容 | https://www.city.sendai.jp/sekatsuese/jigyosha/kankyo/shokuhin/shisetsu/riyogyo/shutcho.html | fact |
| 31 | LINE公式アカウント 料金 | https://www.lycbiz.com/jp/service/line-official-account/plan/ | fact |
| 32 | ホットペッパー掲載数（第三者記事） | https://www.shopowner-support.net/attracting_customers/salon/hair/hair_salon_hotpatter/ | unverified |
| 33 | Reddit r/hairstylist | （アクセス不可） | 未確認 |
