/** 声かけ候補（仕様 6.6） */
import { daysBetween } from './dates'
import { computeDueInfo, isCandidateStatus } from './due'
import { compareNames } from './text'
import { groupContactsByCustomer, groupVisitsByCustomer, normalizeVisits } from './visits'
import type {
  CalcSettings,
  Candidate,
  CandidateLabel,
  ContactLog,
  Customer,
  DueInfo,
  ExclusionReason,
  ID,
  ISODate,
  Menu,
  Visit,
} from './types'

/** 除外理由を調べる順（6.6 の b） */
export const EXCLUSION_ORDER: readonly ExclusionReason[] = [
  'salon',
  'no_contact',
  'not_confirmed_ok',
  'snoozed',
  'max_contacts',
  'cooldown',
]

type EligibilitySettings = Pick<
  CalcSettings,
  'globalDefaultIntervalDays' | 'thresholds' | 'cooldownDays' | 'maxContactsPerGap' | 'listLimit' | 'onlyContactOkInList'
>

/** 削除印のない声かけ（koekake）の記録で、日付が今日以前のもの（古い順） */
export function koekakeLogs(contacts: readonly ContactLog[], today: ISODate): ContactLog[] {
  return contacts
    .filter((c) => !c.deletedAt && c.kind === 'koekake' && c.date <= today)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/**
 * 除外理由（最初に当てはまったもの）。当てはまらなければ null。
 * contacts はその客の連絡記録。due.lastVisit がない客には使わない。
 */
export function exclusionReason(
  customer: Customer,
  due: DueInfo,
  contacts: readonly ContactLog[],
  settings: Pick<CalcSettings, 'cooldownDays' | 'maxContactsPerGap' | 'onlyContactOkInList'>,
  today: ISODate,
): ExclusionReason | null {
  if (customer.stewardship.steward === 'salon') return 'salon'
  if (customer.contact.permission === 'no') return 'no_contact'
  if (settings.onlyContactOkInList && customer.contact.permission !== 'ok') return 'not_confirmed_ok'
  if (customer.snoozeUntil && today <= customer.snoozeUntil) return 'snoozed'
  const logs = koekakeLogs(
    contacts.filter((c) => c.customerId === customer.id),
    today,
  )
  const lastDate = due.lastVisit?.date
  if (lastDate) {
    const afterLast = logs.filter((c) => c.date > lastDate).length
    if (afterLast >= settings.maxContactsPerGap) return 'max_contacts'
  }
  if (logs.length > 0) {
    const C = logs[logs.length - 1].date
    if (daysBetween(C, today) < settings.cooldownDays) return 'cooldown'
  }
  return null
}

/** ラベル（6.6） */
export function candidateLabels(
  customer: Customer,
  visits: readonly Visit[],
  due: DueInfo,
  today: ISODate,
): CandidateLabel[] {
  const labels: CandidateLabel[] = []
  if (customer.contact.permission === 'unknown') labels.push('contact_unconfirmed')
  if (due.lastVisit?.dateApprox) labels.push('approx_last_visit')
  const own = normalizeVisits(
    visits.filter((v) => v.customerId === customer.id),
    today,
  )
  const dates = new Set(own.map((v) => v.date))
  const L = own[own.length - 1]
  if (L && dates.size === 1 && !L.dateApprox && L.source !== 'bulk') labels.push('first_visit')
  return labels
}

/** 並べ方: 遅れの割合 E/I の大きい順 → E の大きい順 → 呼び名の五十音順 */
export function compareCandidates(
  a: { customer: Customer; due: DueInfo },
  b: { customer: Customer; due: DueInfo },
): number {
  const E1 = a.due.elapsedDays ?? 0
  const I1 = a.due.intervalDays ?? 1
  const E2 = b.due.elapsedDays ?? 0
  const I2 = b.due.intervalDays ?? 1
  const lhs = E1 * I2
  const rhs = E2 * I1
  if (lhs !== rhs) return rhs - lhs
  if (E1 !== E2) return E2 - E1
  return compareNames(a.customer, b.customer)
}

export interface ExcludedCustomer {
  customer: Customer
  due: DueInfo
  reason: ExclusionReason
}

export interface EligibilityResult {
  /** 候補の全員（並べ済み） */
  candidates: Candidate[]
  /** 先頭から listLimit 人 */
  shown: Candidate[]
  /** ［ほかに○人］の人数 */
  moreCount: number
  /** 区分は候補なのに除外した人 */
  excluded: ExcludedCustomer[]
  /** 除外した人を理由ごとに数えたもの */
  summary: Record<ExclusionReason, number>
  /** 1年以上来ていない人（リストから外した人は除く） */
  dormant: Array<{ customer: Customer; due: DueInfo }>
  /** 全顧客の目安と区分 */
  dueById: Map<ID, DueInfo>
}

export interface EligibilityInput {
  customers: readonly Customer[]
  visits: readonly Visit[]
  contacts: readonly ContactLog[]
  menus: readonly Menu[]
  settings: EligibilitySettings
  today: ISODate
}

function emptySummary(): Record<ExclusionReason, number> {
  return { salon: 0, no_contact: 0, not_confirmed_ok: 0, snoozed: 0, max_contacts: 0, cooldown: 0 }
}

/** 声かけ候補・除外理由・要約（6.6） */
export function eligibility(input: EligibilityInput): EligibilityResult {
  const { customers, visits, contacts, menus, settings, today } = input
  const visitsBy = groupVisitsByCustomer(visits)
  const contactsBy = groupContactsByCustomer(contacts)
  const candidates: Candidate[] = []
  const excluded: ExcludedCustomer[] = []
  const dormant: Array<{ customer: Customer; due: DueInfo }> = []
  const summary = emptySummary()
  const dueById = new Map<ID, DueInfo>()

  for (const customer of customers) {
    if (customer.deletedAt) continue
    const own = visitsBy.get(customer.id) ?? []
    const due = computeDueInfo(customer, own, menus, settings, today)
    dueById.set(customer.id, due)
    if (due.status === 'dormant') dormant.push({ customer, due })
    if (!isCandidateStatus(due.status)) continue
    const reason = exclusionReason(customer, due, contactsBy.get(customer.id) ?? [], settings, today)
    if (reason) {
      excluded.push({ customer, due, reason })
      summary[reason]++
      continue
    }
    candidates.push({ customer, due, labels: candidateLabels(customer, own, due, today) })
  }

  candidates.sort(compareCandidates)
  dormant.sort((a, b) => compareNames(a.customer, b.customer))
  const limit = Math.max(0, settings.listLimit)
  return {
    candidates,
    shown: candidates.slice(0, limit),
    moreCount: Math.max(0, candidates.length - limit),
    excluded,
    summary,
    dormant,
    dueById,
  }
}

/** 除外理由の表示名 */
export function exclusionReasonLabel(
  reason: ExclusionReason,
  settings: Pick<CalcSettings, 'cooldownDays' | 'maxContactsPerGap'>,
): string {
  switch (reason) {
    case 'salon':
      return '所属サロンの顧客'
    case 'no_contact':
      return '連絡しない'
    case 'not_confirmed_ok':
      return '連絡OKが未確認'
    case 'snoozed':
      return '見送り中'
    case 'max_contacts':
      return `同じ空白期間に${settings.maxContactsPerGap}回声かけ済み`
    case 'cooldown':
      return `声をかけてから${settings.cooldownDays}日以内`
  }
}

/**
 * 出していない人の要約（4.2 の 6）。
 * 例: 「所属サロンの顧客 1人・連絡しない 1人・声をかけてから30日以内 1人は出していません」。0人なら null。
 */
export function exclusionSummaryText(
  summary: Record<ExclusionReason, number>,
  settings: Pick<CalcSettings, 'cooldownDays' | 'maxContactsPerGap'>,
): string | null {
  const parts = EXCLUSION_ORDER.filter((r) => summary[r] > 0).map(
    (r) => `${exclusionReasonLabel(r, settings)} ${summary[r]}人`,
  )
  if (parts.length === 0) return null
  return `${parts.join('・')}は出していません`
}

/** 「1年以上来ていない人 ○人」。0人なら null */
export function dormantSummaryText(count: number): string | null {
  return count > 0 ? `1年以上来ていない人 ${count}人` : null
}

/** ラベルの表示名 */
export const CANDIDATE_LABEL_TEXT: Record<CandidateLabel, string> = {
  contact_unconfirmed: '連絡OKは未確認',
  approx_last_visit: '最終来店はおおよそ',
  first_visit: 'はじめて',
}
