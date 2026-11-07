/** 文面の差し込み（仕様 6.10）と、目安の根拠の表示 */
import { formatMonthDayJa, parseISODate, weekdayJa } from './dates'
import { agreedDueDate, shortestIntervalMenu } from './due'
import { GLOBAL_DEFAULT_SOURCE } from './defaults'
import type { CalcSettings, Customer, DueInfo, ID, ISODate, Menu, NextPlan, Settings, Visit } from './types'

const PLACEHOLDER_RE = /\{([^{}\n]+)\}/g

export type TemplateVars = Record<string, string | null | undefined>

export interface RenderResult {
  text: string
  /** vars にない差し込み（打ち間違いなど）。画面で黄色く示す */
  unknown: string[]
}

/**
 * renderTemplate(body, vars):
 *  1. 行ごとに {名前} を vars で置き換える
 *  2. 中身が空の差し込みを含む行は、行ごと消す
 *  3. vars にない差し込みはそのまま残す（unknown に入れる）
 */
export function renderTemplate(body: string, vars: TemplateVars): RenderResult {
  const unknown = new Set<string>()
  const out: string[] = []
  for (const line of body.split(/\r?\n/)) {
    let drop = false
    const replaced = line.replace(PLACEHOLDER_RE, (whole, rawName: string) => {
      const name = rawName.trim()
      if (!Object.prototype.hasOwnProperty.call(vars, name)) {
        unknown.add(name)
        return whole
      }
      const value = vars[name]
      if (value == null || value.trim() === '') {
        drop = true
        return ''
      }
      return value
    })
    if (!drop) out.push(replaced)
  }
  return { text: out.join('\n'), unknown: [...unknown] }
}

export interface TextSegment {
  text: string
  /** 不明な差し込み（黄色で示す） */
  unknown: boolean
}

/** 文面を「不明な差し込み」とそれ以外に分ける（黄色の強調表示用） */
export function splitUnknownPlaceholders(text: string, knownNames: readonly string[]): TextSegment[] {
  const known = new Set(knownNames)
  const segments: TextSegment[] = []
  let last = 0
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    const name = m[1].trim()
    if (known.has(name)) continue
    const start = m.index ?? 0
    if (start > last) segments.push({ text: text.slice(last, start), unknown: false })
    segments.push({ text: m[0], unknown: true })
    last = start + m[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last), unknown: false })
  return segments
}

/** 文面に含まれる差し込みの名前 */
export function placeholdersIn(body: string): string[] {
  return [...new Set([...body.matchAll(PLACEHOLDER_RE)].map((m) => m[1].trim()))]
}

/** duePhrase(D): 1〜10 →「M月上旬ごろ」、11〜20 →「M月中旬ごろ」、21〜末日 →「M月下旬ごろ」 */
export function duePhrase(d: ISODate): string {
  const { m, d: day } = parseISODate(d)
  const part = day <= 10 ? '上旬' : day <= 20 ? '中旬' : '下旬'
  return `${m}月${part}ごろ`
}

/** bookedPhrase(D):「M月D日（曜）」 */
export function bookedPhrase(d: ISODate): string {
  return `${formatMonthDayJa(d)}（${weekdayJa(d)}）`
}

/** spanForCustomer(days): 49日未満は「n週間」、それ以外は「m か月」「⌊m⌋か月半」 */
export function spanForCustomer(days: number): string {
  if (days < 49) return `${Math.round(days / 7)}週間`
  const m = Math.round((days / 30.44) * 2) / 2
  if (Number.isInteger(m)) return `${m}か月`
  return `${Math.floor(m)}か月半`
}

/** spanForStylist(days):「n週」 */
export function spanForStylist(days: number): string {
  return `${Math.round(days / 7)}週`
}

/** メニュー名のつなぎ方: 1つ＝そのまま、2つ＝「AとB」、3つ以上＝「A・B・C」 */
export function joinMenuNames(names: readonly string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]}と${names[1]}`
  return names.join('・')
}

/** メニュー id を名前に（並び順は Menu.order。知らない id は飛ばす） */
export function menuNames(menuIds: readonly ID[], menus: readonly Menu[]): string[] {
  return menuIds
    .map((id) => menus.find((m) => m.id === id))
    .filter((m): m is Menu => !!m)
    .sort((a, b) => a.order - b.order)
    .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
    .map((m) => m.name)
}

export function menuText(menuIds: readonly ID[], menus: readonly Menu[]): string {
  return joinMenuNames(menuNames(menuIds, menus))
}

/** {予約リンク}: steward が 'self' なら自分用、'salon' なら所属サロン用。なければ空 */
export function bookingLinkFor(customer: Customer, settings: Pick<Settings, 'bookingLink'>): string {
  const link = customer.stewardship.steward === 'salon' ? settings.bookingLink.salon : settings.bookingLink.self
  return link ?? ''
}

/** {次回の目安}: 予約＝「M月D日（曜）ご予約済み」、目安＝duePhrase(D)、おまかせ・未入力＝空 */
export function nextPhrase(visitDate: ISODate, next: NextPlan): string {
  switch (next.kind) {
    case 'booked':
      return `${bookedPhrase(next.date)}ご予約済み`
    case 'agreed':
      return duePhrase(agreedDueDate(visitDate, next.amount, next.unit))
    default:
      return ''
  }
}

/** 声かけの差し込み（{呼び名}{自分の名前}{前回のメニュー}{経過}{予約リンク}） */
export function koekakeVars(input: {
  customer: Customer
  lastVisit: Visit
  elapsedDays: number
  menus: readonly Menu[]
  settings: Pick<Settings, 'stylistName' | 'bookingLink'>
}): TemplateVars {
  const { customer, lastVisit, elapsedDays, menus, settings } = input
  return {
    呼び名: customer.nickname,
    自分の名前: settings.stylistName,
    前回のメニュー: menuText(lastVisit.menuIds, menus),
    経過: spanForCustomer(elapsedDays),
    予約リンク: bookingLinkFor(customer, settings),
  }
}

/** またねカードの差し込み（{呼び名}{今日のメニュー}{次回の目安}{予約リンク}{自分の名前}） */
export function mataneVars(input: {
  customer: Customer
  visit: Pick<Visit, 'date' | 'menuIds' | 'next'>
  menus: readonly Menu[]
  settings: Pick<Settings, 'stylistName' | 'bookingLink'>
}): TemplateVars {
  const { customer, visit, menus, settings } = input
  return {
    呼び名: customer.nickname,
    今日のメニュー: menuText(visit.menuIds, menus),
    次回の目安: nextPhrase(visit.date, visit.next),
    予約リンク: bookingLinkFor(customer, settings),
    自分の名前: settings.stylistName,
  }
}

/** 声かけ文面を作る（due は computeDueInfo の結果。最終来店がなければ null） */
export function renderKoekake(input: {
  body: string
  customer: Customer
  due: DueInfo
  menus: readonly Menu[]
  settings: Pick<Settings, 'stylistName' | 'bookingLink'>
}): RenderResult | null {
  const { body, customer, due, menus, settings } = input
  if (!due.lastVisit || due.elapsedDays == null) return null
  return renderTemplate(
    body,
    koekakeVars({ customer, lastVisit: due.lastVisit, elapsedDays: due.elapsedDays, menus, settings }),
  )
}

/** またねカードの文面を作る */
export function renderMatane(input: {
  body: string
  customer: Customer
  visit: Pick<Visit, 'date' | 'menuIds' | 'next'>
  menus: readonly Menu[]
  settings: Pick<Settings, 'stylistName' | 'bookingLink'>
}): RenderResult {
  return renderTemplate(input.body, mataneVars(input))
}

/** LINE共有リンク（4.5）: https://line.me/R/share?text= に文面を URL エンコードして付ける */
export function lineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`
}

/* ========== 目安の根拠の表示（4.2・4.5） ========== */

function agreedLabel(next: NextPlan): string {
  if (next.kind !== 'agreed') return ''
  return next.unit === 'week' ? `${next.amount}週` : `${next.amount}か月`
}

/**
 * 候補カードの1行（4.2）:
 *  いつもの周期 →「いつもは約8週ごと → 今回は11週」
 *  会計時の約束 →「会計時の目安 6週 → 今回は8週」
 *  メニュー・全体 →「目安 約90日（縮毛矯正）→ 99日」
 */
export function dueBasisLine(due: DueInfo, menus: readonly Menu[]): string {
  const E = due.elapsedDays ?? 0
  switch (due.basis) {
    case 'personal':
      return `いつもは約${spanForStylist(due.personalCycleDays ?? due.intervalDays ?? 0)}ごと → 今回は${spanForStylist(E)}`
    case 'agreed':
      return due.lastVisit ? `会計時の目安 ${agreedLabel(due.lastVisit.next)} → 今回は${spanForStylist(E)}` : ''
    case 'menu': {
      const menu = due.lastVisit ? shortestIntervalMenu(due.lastVisit.menuIds, menus) : undefined
      return `目安 約${due.intervalDays}日（${menu?.name ?? 'メニュー'}）→ ${E}日`
    }
    case 'global':
      return `目安 約${due.intervalDays}日（全体の目安）→ ${E}日`
    case 'booked':
      return due.dueDate ? `予約 ${bookedPhrase(due.dueDate)}` : ''
    default:
      return ''
  }
}

/**
 * 目安の根拠（4.5 の 1）:
 *  「いつもの周期（直近3回）」「会計時に決めた6週」
 *  「メニューの目安（縮毛矯正 2〜4か月…）」「全体の目安 約87日（美容センサス2026上期から換算）」
 */
export function dueBasisReason(
  due: DueInfo,
  menus: readonly Menu[],
  settings: Pick<CalcSettings, 'globalDefaultIntervalDays'>,
): string {
  switch (due.basis) {
    case 'personal':
      return `いつもの周期（直近${due.personalIntervalsUsed ?? 0}回）`
    case 'agreed':
      return due.lastVisit ? `会計時に決めた${agreedLabel(due.lastVisit.next)}` : ''
    case 'menu': {
      const menu = due.lastVisit ? shortestIntervalMenu(due.lastVisit.menuIds, menus) : undefined
      if (!menu) return 'メニューの目安'
      return `メニューの目安（${menu.name} ${menu.defaultIntervalDays}日、${menu.source?.label ?? '出典なし'}）`
    }
    case 'global':
      return settings.globalDefaultIntervalDays === GLOBAL_DEFAULT_SOURCE.days
        ? `全体の目安 約${settings.globalDefaultIntervalDays}日（${GLOBAL_DEFAULT_SOURCE.short}）`
        : `全体の目安 約${settings.globalDefaultIntervalDays}日（設定で変更した値）`
    case 'booked':
      return '会計時に入れた予約日'
    default:
      return ''
  }
}

/** 顧客カードの「いつもの周期」（4.6）: 「約8週（直近3回）」／「まだ計算できません（来店2回から）」 */
export function personalCycleText(due: DueInfo): string {
  if (due.personalCycleDays == null) return 'まだ計算できません（来店2回から）'
  return `約${spanForStylist(due.personalCycleDays)}（直近${due.personalIntervalsUsed ?? 0}回）`
}
