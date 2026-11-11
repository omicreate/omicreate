/** 記録を作る・直すための純粋関数（保存は storage 側で行う） */
import { bookingSetOn } from './booking'
import { addDays } from './dates'
import { parseLastVisitInput, type LastVisitParse } from './lastVisitInput'
import type {
  AcquisitionChannel,
  ColorRecipeMemo,
  ContactKind,
  ContactLog,
  ContactPermission,
  ContactVia,
  Customer,
  DataSteward,
  DueInfo,
  ID,
  ISODate,
  ISODateTime,
  NextPlan,
  Visit,
  VisitSource,
} from './types'

/** 新しい id（crypto.randomUUID。使えない環境では乱数から作る） */
export function newId(): ID {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export interface NewCustomerInput {
  nickname: string
  kana?: string
  lineDisplayName?: string
  steward: DataSteward
  channel: AcquisitionChannel
  permission?: ContactPermission
  pinnedMemo?: string
  today: ISODate
  now: ISODateTime
  id?: ID
}

/** 顧客を作る。stewardship と contact は必須（contact.permission の初期値は 'unknown'） */
export function createCustomer(input: NewCustomerInput): Customer {
  const c: Customer = {
    id: input.id ?? newId(),
    nickname: input.nickname.trim(),
    stewardship: { steward: input.steward, channel: input.channel, decidedOn: input.today },
    contact: { permission: input.permission ?? 'unknown' },
    createdAt: input.now,
    updatedAt: input.now,
  }
  if (input.kana) c.kana = input.kana
  if (input.lineDisplayName) c.lineDisplayName = input.lineDisplayName
  if (input.pinnedMemo) c.pinnedMemo = input.pinnedMemo
  if (input.permission && input.permission !== 'unknown') {
    c.contact.confirmedOn = input.today
    c.contact.method = 'in_person'
  }
  return c
}

export interface NewVisitInput {
  customerId: ID
  date: ISODate
  menuIds: ID[]
  next: NextPlan
  source: VisitSource
  now: ISODateTime
  dateApprox?: 'month'
  price?: number
  recipe?: ColorRecipeMemo
  talkMemo?: string
  id?: ID
}

/** 来店記録を作る */
export function createVisit(input: NewVisitInput): Visit {
  const v: Visit = {
    id: input.id ?? newId(),
    customerId: input.customerId,
    date: input.date,
    menuIds: [...input.menuIds],
    next: input.next,
    source: input.source,
    createdAt: input.now,
    updatedAt: input.now,
  }
  if (input.dateApprox) v.dateApprox = input.dateApprox
  if (input.price != null) v.price = input.price
  if (input.recipe && input.recipe.text) v.recipe = { ...input.recipe }
  if (input.talkMemo) v.talkMemo = input.talkMemo
  return v
}

/** 連絡の記録を作る */
export function createContactLog(input: {
  customerId: ID
  date: ISODate
  kind: ContactKind
  via: ContactVia
  stewardWarningAcked?: boolean
  now: ISODateTime
  id?: ID
}): ContactLog {
  const log: ContactLog = {
    id: input.id ?? newId(),
    customerId: input.customerId,
    date: input.date,
    kind: input.kind,
    via: input.via,
    createdAt: input.now,
  }
  if (input.stewardWarningAcked) log.stewardWarningAcked = true
  return log
}

/** ［前回のメモを複製］: 直近の来店のレシピメモをそのまま入れ、複製元を記録する */
export function copyRecipeFrom(visit: Visit | undefined): ColorRecipeMemo | undefined {
  if (!visit?.recipe?.text) return undefined
  return { text: visit.recipe.text, copiedFromVisitId: visit.id }
}

/**
 * 来店を保存したときの顧客の更新（4.3）:
 * リストから外していた客は自動で戻す（unarchived = true のとき「リストに戻しました」）。
 * ただし既存の来店記録を直しただけ（editing）のときは戻さない（引っ越しなどで外した人が、メモの手直しで候補に戻らないように）。
 * 連絡の可否を記録で更新したときは確かめた日を残す。
 * 新しい来店の日付（visitDate）が、あとから入れた予約を入れた日以降なら、その予約を消す（新しい来店記録の次回が引き継ぐ）。
 */
export function applyVisitToCustomer(
  customer: Customer,
  input: { permission?: ContactPermission; today: ISODate; now: ISODateTime; editing?: boolean; visitDate?: ISODate },
): { customer: Customer; unarchived: boolean; changed: boolean; bookingCleared: boolean } {
  let next: Customer = customer
  let changed = false
  let bookingCleared = false
  if (!input.editing && input.visitDate && customer.booking) {
    let setOn: ISODate | null = null
    try {
      setOn = bookingSetOn(customer.booking)
    } catch {
      setOn = null
    }
    if (!setOn || input.visitDate >= setOn) {
      const { booking: _b, ...rest } = next
      void _b
      next = rest
      changed = true
      bookingCleared = true
    }
  }
  const unarchived = !!customer.archived && !input.editing
  if (unarchived) {
    const { archived: _a, ...rest } = next
    void _a
    next = rest
    changed = true
  }
  if (input.permission && input.permission !== customer.contact.permission) {
    next = {
      ...next,
      contact:
        input.permission === 'unknown'
          ? { permission: 'unknown' }
          : { permission: input.permission, confirmedOn: input.today, method: 'in_person' },
    }
    changed = true
  }
  if (changed) next = { ...next, updatedAt: input.now }
  return { customer: next, unarchived, changed, bookingCleared }
}

/**
 * 連絡の可否を変える（顧客カードの編集・［連絡しないにする］）。
 * 'ok'/'no' は本人に確かめた日と方法を残す（method の省略は対面）。
 * method に null を渡すと、本人に確かめたのではなく美容師の判断として、確かめた日・方法を残さない（［今回は見送る］→［連絡しないにする］）
 */
export function withContactPermission(
  customer: Customer,
  permission: ContactPermission,
  input: { today: ISODate; now: ISODateTime; method?: 'in_person' | 'message' | null },
): Customer {
  return {
    ...customer,
    contact:
      permission === 'unknown' || input.method === null
        ? { permission }
        : { permission, confirmedOn: input.today, method: input.method ?? 'in_person' },
    updatedAt: input.now,
  }
}

/** ［リストから外す（来なくなった・引っ越しなど）］ */
export function archiveCustomer(
  customer: Customer,
  reason: 'stopped' | 'moved' | 'other',
  input: { today: ISODate; now: ISODateTime },
): Customer {
  return { ...customer, archived: { on: input.today, reason }, updatedAt: input.now }
}

/** リストに戻す */
export function unarchiveCustomer(customer: Customer, now: ISODateTime): Customer {
  const { archived: _a, ...rest } = customer
  void _a
  return { ...rest, updatedAt: now }
}

export type SnoozeOption = 'two_weeks' | 'next_cycle'

/** ［今回は見送る］の snoozeUntil（2週間＝今日＋14日、次の周期まで＝今日＋目安の間隔の日数） */
export function snoozeUntilFor(option: SnoozeOption, due: DueInfo, today: ISODate): ISODate {
  if (option === 'two_weeks') return addDays(today, 14)
  return addDays(today, Math.max(1, due.intervalDays ?? 14))
}

export interface BulkRowInput {
  nickname: string
  lastVisitText: string
  menuIds: ID[]
  steward: DataSteward
  channel: AcquisitionChannel
  today: ISODate
  now: ISODateTime
}

/**
 * ざっくり登録の1行（4.7）: 顧客と、最終来店が読めればその来店記録（source 'bulk'、年月だけなら dateApprox）。
 * 最終来店が読めないときは来店なしで顧客だけを作り、parse にエラーを返す。
 */
export function createBulkRecords(input: BulkRowInput): { customer: Customer; visit?: Visit; parse: LastVisitParse } {
  const customer = createCustomer({
    nickname: input.nickname,
    steward: input.steward,
    channel: input.channel,
    today: input.today,
    now: input.now,
  })
  const parse = parseLastVisitInput(input.lastVisitText, input.today)
  if (parse.kind !== 'date') return { customer, parse }
  const visit = createVisit({
    customerId: customer.id,
    date: parse.date,
    dateApprox: parse.approx ? 'month' : undefined,
    menuIds: input.menuIds,
    next: { kind: 'none' },
    source: 'bulk',
    now: input.now,
  })
  return { customer, visit, parse }
}
