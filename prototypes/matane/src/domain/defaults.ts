/**
 * 初期値（仕様 4.9 のメニューと出典・時点、設定の初期値、4.10 の文面）。
 * 出典のない値はすべて「仮の値」で、設定で変えられる。
 */
import type { ISODate, ISODateTime, LocalCounters, Menu, MessageTemplate, Settings } from './types'

/** S0 で確認してもらう文面の版（Settings.notice.version） */
export const NOTICE_VERSION = '2026-11-07'

/** アプリの版（このアプリについて） */
export const APP_VERSION = '0.1.0'

/** メニューの id（サンプルデータとテストから参照する） */
export const MENU_IDS = {
  cut: 'cut',
  cutShort: 'cut_short',
  cutBob: 'cut_bob',
  cutMedium: 'cut_medium',
  cutLong: 'cut_long',
  color: 'color',
  gray: 'gray',
  bleach: 'bleach',
  perm: 'perm',
  straight: 'straight',
  treatment: 'treatment',
} as const

const CRAFT = 'craft: DEMI 2024-07、QJ 2026-04更新'

/** メニューと目安の初期値（4.9）。チップに出すのは 8.1 の7つ */
export const DEFAULT_MENUS: readonly Menu[] = [
  {
    id: MENU_IDS.cut,
    name: 'カット',
    aliases: ['cut'],
    defaultIntervalDays: null,
    source: { label: '長さで幅が大きいため目安に使わない', asOf: '2026-04' },
    visible: true,
    order: 1,
  },
  {
    id: MENU_IDS.cutShort,
    name: 'カット・ショート',
    aliases: ['ショート', 'ショートカット'],
    defaultIntervalDays: 30,
    source: { label: `1か月（${CRAFT}）`, asOf: '2026-04' },
    visible: false,
    order: 2,
  },
  {
    id: MENU_IDS.cutBob,
    name: 'カット・ボブ',
    aliases: ['ボブ'],
    defaultIntervalDays: 45,
    source: { label: `1.5か月（${CRAFT}）`, asOf: '2026-04' },
    visible: false,
    order: 3,
  },
  {
    id: MENU_IDS.cutMedium,
    name: 'カット・ミディアム',
    aliases: ['ミディアム'],
    defaultIntervalDays: 60,
    source: { label: `2か月（${CRAFT}）`, asOf: '2026-04' },
    visible: false,
    order: 4,
  },
  {
    id: MENU_IDS.cutLong,
    name: 'カット・ロング',
    aliases: ['ロング'],
    defaultIntervalDays: 75,
    source: { label: `2〜3か月の中間として置いた値（${CRAFT}）`, asOf: '2026-04' },
    visible: false,
    order: 5,
  },
  {
    id: MENU_IDS.color,
    name: 'カラー',
    aliases: ['色', 'color'],
    defaultIntervalDays: 60,
    source: { label: `約2か月（${CRAFT}）`, asOf: '2026-04' },
    visible: true,
    order: 6,
  },
  {
    id: MENU_IDS.gray,
    name: '白髪染め',
    aliases: ['しらがぞめ', '白髪', 'グレイカラー', 'グレーカラー'],
    defaultIntervalDays: 42,
    source: { label: `1〜1.5か月、4〜6週の人も多い（${CRAFT}）`, asOf: '2026-04' },
    visible: true,
    order: 7,
  },
  {
    id: MENU_IDS.bleach,
    name: 'ブリーチ',
    aliases: ['bleach'],
    defaultIntervalDays: 30,
    source: { label: `約1か月（${CRAFT}）`, asOf: '2026-04' },
    visible: true,
    order: 8,
  },
  {
    id: MENU_IDS.perm,
    name: 'パーマ',
    aliases: ['perm'],
    defaultIntervalDays: 75,
    source: { label: `2〜3か月（QJ）、3か月（DEMI）の中間として置いた値（${CRAFT}）`, asOf: '2026-04' },
    visible: true,
    order: 9,
  },
  {
    id: MENU_IDS.straight,
    name: '縮毛矯正',
    aliases: ['しゅくもうきょうせい', '矯正', 'ストパー'],
    defaultIntervalDays: 90,
    source: { label: `2〜4か月（DEMI、QJ）。HPB は3か月〜半年（${CRAFT}）`, asOf: '2026-04' },
    visible: true,
    order: 10,
  },
  {
    id: MENU_IDS.treatment,
    name: 'トリートメント',
    aliases: ['TR'],
    defaultIntervalDays: null,
    source: { label: '出典なし（目安に使わない）', asOf: '2026-04' },
    visible: true,
    order: 11,
  },
]

/** 全体の目安の出典（4.9） */
export const GLOBAL_DEFAULT_SOURCE = {
  days: 87,
  label: '女性の年間利用回数4.18回からの換算（market、美容センサス2026上期。推定）',
  short: '美容センサス2026上期から換算',
  asOf: '2026上期',
} as const

/** メニューの初期値のコピー（書き換えても DEFAULT_MENUS は変わらない） */
export function createDefaultMenus(): Menu[] {
  return DEFAULT_MENUS.map((m) => ({ ...m, aliases: [...m.aliases], source: m.source ? { ...m.source } : undefined }))
}

/** 計算に使う設定の初期値（4.9 の区分としきい値。すべて仮の値） */
export const DEFAULT_THRESHOLDS = {
  soonPct: 85,
  lapsedPct: 150,
  dormantDays: 365,
} as const

/** 設定の初期値。notice は S0 の［読みました］で作る */
export function createDefaultSettings(notice: Settings['notice']): Settings {
  return {
    schemaVersion: 1,
    stylistName: '',
    bookingLink: {},
    globalDefaultIntervalDays: GLOBAL_DEFAULT_SOURCE.days,
    thresholds: { ...DEFAULT_THRESHOLDS },
    cooldownDays: 30,
    maxContactsPerGap: 2,
    listLimit: 5,
    onlyContactOkInList: false,
    staleRecordDays: 7,
    backupReminderDays: 14,
    compareWindowDays: 60,
    notice: { ...notice },
  }
}

/** 計算の既定値（Settings を持たない場面のテストなどで使う） */
export const DEFAULT_CALC_SETTINGS = createDefaultSettings({ version: NOTICE_VERSION, ackedAt: '' })

/** 自動ロックまでの時間（分、仮の値） */
export const DEFAULT_AUTO_LOCK_MINUTES = 5

/** 4.10 声かけ（初期値） */
export const DEFAULT_KOEKAKE_TEMPLATE = [
  '{呼び名}さん、こんにちは。',
  '美容師の{自分の名前}です。',
  '前回の{前回のメニュー}から{経過}ほどたちましたが、髪の調子はいかがですか？',
  'ご予約はこちらからどうぞ。 {予約リンク}',
  '気になることがあれば、このままお返事ください。',
].join('\n')

/** 4.10 またねカード（初期値） */
export const DEFAULT_MATANE_TEMPLATE = [
  '{呼び名}さん、今日はありがとうございました。',
  '今日のメニュー：{今日のメニュー}',
  '次回の目安：{次回の目安}',
  'ご予約はこちらからどうぞ。 {予約リンク}',
  '{自分の名前}',
].join('\n')

/** 差し込みの一覧（設定の文面の画面で出す） */
export const TEMPLATE_PLACEHOLDERS = {
  koekake: ['呼び名', '自分の名前', '前回のメニュー', '経過', '予約リンク'],
  matane: ['呼び名', '今日のメニュー', '次回の目安', '予約リンク', '自分の名前'],
} as const

export function defaultTemplateBody(kind: MessageTemplate['kind']): string {
  return kind === 'koekake' ? DEFAULT_KOEKAKE_TEMPLATE : DEFAULT_MATANE_TEMPLATE
}

export function createDefaultTemplates(now: ISODateTime): MessageTemplate[] {
  return [
    { kind: 'koekake', body: DEFAULT_KOEKAKE_TEMPLATE, isDefault: true, updatedAt: now },
    { kind: 'matane', body: DEFAULT_MATANE_TEMPLATE, isDefault: true, updatedAt: now },
  ]
}

export function createDefaultCounters(firstUsedOn: ISODate): LocalCounters {
  return {
    firstUsedOn,
    visitsSaved: 0,
    mataneSent: 0,
    koekakeSent: 0,
    koekakeSkipped: 0,
    actuallyVisitedFixes: 0,
  }
}

/** 画面の固定文言のうち、計算・保存と結びつくもの */
export const MESSAGES = {
  memoNote: '体質・病歴・妊娠など健康のことは書かないでください',
  healthWarning: '健康に関することは書かないでください（要配慮個人情報にあたる場合があります）',
  notCarte: 'またね帳はカルテの代わりではありません。アレルギーなど安全に関わる記録は、今お使いのカルテで管理してください。',
  storageUnavailable: 'この状態では記録を保存できません。通常のブラウザで開くか、ホーム画面に追加してください',
  wrongPassphraseOrCorrupt: 'パスフレーズが違うか、ファイルが壊れています',
  newerVersion: '新しい版のファイルです。アプリを更新してください',
  cryptoUnavailable: 'この画面では暗号化を使えません。安全な接続（https）で開いてください',
  passphraseTooShort: 'パスフレーズは8文字以上にしてください',
  pinFormat: 'PINは4〜8桁の数字にしてください',
  pinWrong: 'PINが違います',
  plainExportWarning: '暗号化されていないファイルです。LINEやメールで送らず、自分だけが見られる場所に保存してください',
  salonWarning:
    'この方のデータの管理者は所属サロンです。所属先の了解なく個人の連絡先から案内すると、契約や法令上の問題になることがあります。所属先のルールで認められている場合だけ続けてください。',
  boardNotProof: '比べるための事実です。声かけの効果を示すものではありません。人数が少ないうちは偶然の差が大きくなります',
  boardCompare: '比べる相手は業界平均ではなく、先月のあなたです（個人美容師の信頼できる基準値はありません）',
  install: 'ホーム画面に追加すると、データが消えにくくなります',
  saveFailed: '保存できませんでした。端末の空き容量を確認し、バックアップを書き出してください',
} as const
