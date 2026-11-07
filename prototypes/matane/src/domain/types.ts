/**
 * またね帳のデータ型（仕様 5.1）。
 * 健康情報（アレルギー・既往歴・服薬・妊娠など）の欄は型の段階で作らない（仕様 5.3・7.2）。
 * 電話番号・メールアドレス・住所・生年月日・性別の欄も作らない。
 */

/** 端末のローカル日付 'YYYY-MM-DD' */
export type ISODate = string
/** ISO 8601（タイムゾーンつき）。作成・更新の記録用 */
export type ISODateTime = string
/** crypto.randomUUID() など */
export type ID = string

/* ========== 顧客 ========== */

/** データの管理者。'salon' は所属サロン（委託元）が管理する顧客 */
export type DataSteward = 'self' | 'salon'

/** 獲得経路 */
export type AcquisitionChannel =
  | 'own_sns' // 本人のSNS
  | 'own_minimo' // 本人のminimo
  | 'own_line' // 本人のLINE
  | 'own_other' // 本人のその他（自分のサイト、通りがかりなど）
  | 'referral' // 紹介
  | 'salon_media' // サロン媒体（サロン名義のHPBなど）
  | 'salon_handover' // サロンからの引き継ぎ
  | 'unknown'

/** 管理者と経路。登録時に必須 */
export interface Stewardship {
  steward: DataSteward
  channel: AcquisitionChannel
  decidedOn: ISODate
}

/** 連絡してよいか（本人に確かめた記録） */
export type ContactPermission = 'unknown' | 'ok' | 'no'

/** 本人に確かめた方法: 対面で聞いた／メッセージの返事で */
export type ContactMethod = 'in_person' | 'message'

export interface ContactConsent {
  permission: ContactPermission
  confirmedOn?: ISODate // 本人に確かめた日
  method?: ContactMethod // 対面で聞いた／メッセージの返事で
}

export interface Customer {
  id: ID
  nickname: string // 呼び名。1〜20文字。フルネームは求めない
  kana?: string // 検索用。ひらがな
  lineDisplayName?: string // LINEで宛先を選ぶときの目印（任意）
  // 電話番号・メールアドレス・住所・生年月日・性別・健康情報の欄は作らない
  stewardship: Stewardship
  contact: ContactConsent
  pinnedMemo?: string // 顧客カード上部の一言。最大100文字。健康のことは書かない
  snoozeUntil?: ISODate // この日まで声かけ候補に出さない（当日を含む）
  archived?: { on: ISODate; reason: 'stopped' | 'moved' | 'other' } // リストから外した
  createdAt: ISODateTime
  updatedAt: ISODateTime
  deletedAt?: ISODateTime // 取り消し用の一時的な削除印（6.1）
}

/* ========== 来店記録 ========== */

/** 会計時に決めた次回の約束 */
export type NextPlan =
  | { kind: 'booked'; date: ISODate } // 次回の予約日（来店日より後）
  | { kind: 'agreed'; amount: number; unit: 'week' | 'month' } // 目安（週は1〜26、月は1〜12）
  | { kind: 'omakase' } // おまかせ（目安なし）
  | { kind: 'none' } // 未入力

/** カラーレシピ。構造化しない自由メモ */
export interface ColorRecipeMemo {
  text: string // 最大1000文字
  copiedFromVisitId?: ID // 「前回のメモを複製」で作ったとき
}

export type VisitSource = 'checkout' | 'batch' | 'one_line' | 'bulk' | 'fix'

export interface Visit {
  id: ID
  customerId: ID
  date: ISODate // 未来の日付は不可
  dateApprox?: 'month' // 年月だけの登録。date はその月の末日（当月なら今日）
  menuIds: ID[] // 1つ以上。ざっくり登録だけは0でもよい
  price?: number // 円・0以上の整数・任意。MVPでは集計に使わない
  next: NextPlan
  bookingResolution?: 'not_visited' // 予約日を過ぎて「来なかった」と確認した
  recipe?: ColorRecipeMemo
  talkMemo?: string // 会話メモ。最大500文字
  source: VisitSource // 入力した経路（fix＝実は来ていた）
  createdAt: ISODateTime
  updatedAt: ISODateTime
  deletedAt?: ISODateTime
}

/* ========== メニュー ========== */

export interface Menu {
  id: ID
  name: string // 'カラー'
  aliases: string[] // 1行入力の別名
  defaultIntervalDays: number | null // null は目安に使わない
  source?: { label: string; asOf: string } // 出典と幅・時点
  visible: boolean // チップに出すか
  order: number
}

/* ========== 連絡の記録 ========== */

export type ContactKind = 'koekake' | 'matane'
export type ContactVia = 'line_link' | 'copy'

export interface ContactLog {
  id: ID
  customerId: ID
  date: ISODate
  kind: ContactKind // 声かけ／またねカード
  via: ContactVia
  stewardWarningAcked?: boolean // 所属サロンの顧客で、注意を確認して送った
  createdAt: ISODateTime
  deletedAt?: ISODateTime
}

/* ========== 文面 ========== */

export interface MessageTemplate {
  kind: ContactKind
  body: string // {呼び名} などの差し込みを含む
  isDefault: boolean // 初期の文面のままか
  updatedAt: ISODateTime
}

/* ========== 設定 ========== */

export interface PinLock {
  pinHash: string // base64。PBKDF2-SHA256 の結果
  salt: string // base64、16バイト
  iterations: number
  autoLockMinutes: number // 5（仮の値）
}

export interface Settings {
  schemaVersion: 1
  stylistName: string // 文面の署名（空でもよい）
  bookingLink: { self?: string; salon?: string } // https:// で始まるURLだけ
  globalDefaultIntervalDays: number // 87
  thresholds: {
    soonPct: number // 85
    lapsedPct: number // 150
    dormantDays: number // 365
  }
  cooldownDays: number // 30
  maxContactsPerGap: number // 2
  listLimit: number // 5
  onlyContactOkInList: boolean // false
  staleRecordDays: number // 7
  backupReminderDays: number // 14
  compareWindowDays: number // 60
  lock?: PinLock
  lastBackupAt?: ISODateTime
  staleDismissedUntil?: ISODate // 「休みでした」で記録停止の表示を止める日
  notice: { version: string; ackedAt: ISODateTime } // データの持ち主・持ち出しの注意を確認した記録
}

/* ========== 端末内だけの補助データ ========== */

/** 入力途中の下書き。formId 例: 'visit:new', 'visit:edit:<id>', 'bulk', 'koekake:<customerId>' */
export interface Draft {
  formId: string
  data: unknown
  updatedAt: ISODateTime
}

/** 使い方の回数。端末の外へは自動で送らない */
export interface LocalCounters {
  firstUsedOn: ISODate
  visitsSaved: number
  mataneSent: number
  koekakeSent: number
  koekakeSkipped: number
  actuallyVisitedFixes: number // ［実は来ていた］で直した回数
}

export type CounterKey = Exclude<keyof LocalCounters, 'firstUsedOn'>

/** バックアップから戻す直前の状態（1回分だけ保持） */
export interface RestorePoint {
  createdAt: ISODateTime
  payload: BackupPayload
}

/* ========== バックアップ ========== */

export interface BackupPayload {
  schemaVersion: 1
  customers: Customer[]
  visits: Visit[]
  menus: Menu[]
  contacts: ContactLog[]
  templates: MessageTemplate[]
  settings: Omit<Settings, 'lock'> // PINは端末ごとのものなので含めない
  counters: LocalCounters
}

/** 暗号化バックアップのファイル形式（既定） */
export interface EncryptedBackupFile {
  format: 'matane-backup'
  version: 1
  createdAt: ISODateTime
  encrypted: true
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string /* base64, 16バイト */ }
  cipher: { name: 'AES-GCM'; length: 256; iv: string /* base64, 12バイト */ }
  payload: string // base64(AES-GCM(UTF-8(JSON.stringify(BackupPayload))))
}

/* ========== 計算結果（保存しない） ========== */

export type TimingStatus =
  | 'no_data' // 来店記録なし
  | 'archived' // リストから外した
  | 'today' // 今日が予約日
  | 'booked' // 予約日が先
  | 'confirm' // 予約日を過ぎたが記録なし（来た？）
  | 'not_yet' // まだ
  | 'soon' // そろそろ
  | 'overdue' // ご無沙汰
  | 'lapsed' // 離れたかも
  | 'dormant' // 1年以上来ていない

export type DueBasis = 'booked' | 'agreed' | 'personal' | 'menu' | 'global'

export interface DueInfo {
  status: TimingStatus
  lastVisit?: Visit
  dueDate?: ISODate
  basis?: DueBasis
  intervalDays?: number // I = 目安日 − 最終来店日
  elapsedDays?: number // E = 今日 − 最終来店日
  personalCycleDays?: number | null
  personalIntervalsUsed?: number
}

export type ExclusionReason = 'salon' | 'no_contact' | 'not_confirmed_ok' | 'snoozed' | 'max_contacts' | 'cooldown'

export type CandidateLabel = 'contact_unconfirmed' | 'approx_last_visit' | 'first_visit'

export interface Candidate {
  customer: Customer
  due: DueInfo
  labels: CandidateLabel[]
}

/** 計算に使う設定の部分（Settings 全体でも渡せる） */
export type CalcSettings = Pick<
  Settings,
  | 'globalDefaultIntervalDays'
  | 'thresholds'
  | 'cooldownDays'
  | 'maxContactsPerGap'
  | 'listLimit'
  | 'onlyContactOkInList'
  | 'staleRecordDays'
  | 'backupReminderDays'
  | 'compareWindowDays'
>
