/**
 * 画面の操作から呼ぶ保存の手順（中身の純粋関数で記録を作り、保存層に書く）。
 * 呼び出し側は useApp().mutate(repo => ...) で包み、書き込みのあとに読み直す。
 */
import {
  applyVisitToCustomer,
  createContactLog,
  createCustomer,
  createVisit,
  markNotVisited,
  snoozeUntilFor,
  unmarkNotVisited,
  withContactPermission,
  type AcquisitionChannel,
  type ColorRecipeMemo,
  type ContactKind,
  type ContactPermission,
  type ContactVia,
  type Customer,
  type DataSteward,
  type DueInfo,
  type ID,
  type ISODate,
  type ISODateTime,
  type LocalCounters,
  type NextPlan,
  type Visit,
  type VisitSource,
} from '../domain'
import type { Repository } from '../storage'

export interface VisitFields {
  date: ISODate
  dateApprox?: 'month'
  menuIds: ID[]
  next: NextPlan
  price?: number
  recipe?: ColorRecipeMemo
  talkMemo?: string
}

export interface SaveVisitInput {
  /** 既存の客（どちらか一方） */
  customer?: Customer
  /** その場で登録する客 */
  newCustomer?: { nickname: string; steward: DataSteward; channel: AcquisitionChannel }
  fields: VisitFields
  source: VisitSource
  /** 連絡の可否（来店記録で更新したとき） */
  permission?: ContactPermission
  /** 直している来店記録（編集のとき） */
  editing?: Visit
  today: ISODate
  now: ISODateTime
}

export interface SaveVisitResult {
  customer: Customer
  visit: Visit
  /** リストから外していた客を戻した */
  unarchived: boolean
}

function firstUsed(counters: LocalCounters | null | undefined, today: ISODate): string {
  return counters?.firstUsedOn ?? today
}

/** 来店記録を保存する（4.3）。リストから外していた客は自動で戻す */
export async function saveVisit(repo: Repository, input: SaveVisitInput): Promise<SaveVisitResult> {
  const { fields, today, now } = input
  let customer: Customer
  let isNewCustomer = false
  if (input.customer) {
    customer = input.customer
  } else if (input.newCustomer) {
    customer = createCustomer({
      nickname: input.newCustomer.nickname,
      steward: input.newCustomer.steward,
      channel: input.newCustomer.channel,
      permission: input.permission,
      today,
      now,
    })
    isNewCustomer = true
  } else {
    throw new Error('客が選ばれていません')
  }

  let visit: Visit
  if (input.editing) {
    const e = input.editing
    const keepResolution =
      e.bookingResolution && e.next.kind === 'booked' && fields.next.kind === 'booked' && e.next.date === fields.next.date
    visit = {
      id: e.id,
      customerId: e.customerId,
      date: fields.date,
      menuIds: [...fields.menuIds],
      next: fields.next,
      source: e.source,
      createdAt: e.createdAt,
      updatedAt: now,
    }
    if (e.dateApprox && e.date === fields.date) visit.dateApprox = e.dateApprox
    if (keepResolution) visit.bookingResolution = e.bookingResolution
    if (fields.price != null) visit.price = fields.price
    if (fields.recipe?.text) visit.recipe = { ...fields.recipe }
    if (fields.talkMemo) visit.talkMemo = fields.talkMemo
  } else {
    visit = createVisit({
      customerId: customer.id,
      date: fields.date,
      dateApprox: fields.dateApprox,
      menuIds: fields.menuIds,
      next: fields.next,
      source: input.source,
      price: fields.price,
      recipe: fields.recipe,
      talkMemo: fields.talkMemo,
      now,
    })
  }

  let unarchived = false
  if (isNewCustomer) {
    await repo.saveRecords({ customers: [customer], visits: [visit] })
  } else {
    const applied = applyVisitToCustomer(customer, { permission: input.permission, today, now, editing: !!input.editing })
    unarchived = applied.unarchived
    customer = applied.changed ? applied.customer : customer
    await repo.saveVisitWithCustomer(visit, applied.changed ? applied.customer : undefined)
  }

  if (!input.editing) {
    const counters = await repo.getCounters()
    await repo.incrementCounter('visitsSaved', 1, firstUsed(counters, today))
    if (input.source === 'fix') await repo.incrementCounter('actuallyVisitedFixes', 1, firstUsed(counters, today))
  }
  return { customer, visit, unarchived }
}

/** ［送った］: 連絡の記録を残す（声かけ・またねカード） */
export async function recordContact(
  repo: Repository,
  input: {
    customer: Customer
    kind: ContactKind
    via: ContactVia
    stewardWarningAcked?: boolean
    today: ISODate
    now: ISODateTime
  },
): Promise<void> {
  const log = createContactLog({
    customerId: input.customer.id,
    date: input.today,
    kind: input.kind,
    via: input.via,
    stewardWarningAcked: input.stewardWarningAcked,
    now: input.now,
  })
  await repo.putContact(log)
  await repo.incrementCounter(input.kind === 'koekake' ? 'koekakeSent' : 'mataneSent', 1, input.today)
}

export type SkipOption = 'two_weeks' | 'next_cycle' | 'no_contact'

/** ［今回は見送る］（4.5）: 2週間／次の周期まで／連絡しないにする */
export async function skipKoekake(
  repo: Repository,
  input: { customer: Customer; option: SkipOption; due: DueInfo; today: ISODate; now: ISODateTime },
): Promise<Customer> {
  const { customer, option, due, today, now } = input
  const next =
    option === 'no_contact'
      ? withContactPermission(customer, 'no', { today, now, method: null })
      : { ...customer, snoozeUntil: snoozeUntilFor(option, due, today), updatedAt: now }
  await repo.putCustomer(next)
  await repo.incrementCounter('koekakeSkipped', 1, today)
  return next
}

/** ［来なかった］: 予約を流れたことにする。取り消し用に元の記録を返す */
export async function setNotVisited(repo: Repository, visit: Visit, now: ISODateTime): Promise<Visit> {
  await repo.putVisit(markNotVisited(visit, now))
  return visit
}

export async function clearNotVisited(repo: Repository, visit: Visit, now: ISODateTime): Promise<void> {
  await repo.putVisit(unmarkNotVisited(visit, now))
}
