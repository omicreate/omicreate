/** 入力の確かめ（4.3・4.7・4.9 のエラー文言）。保存層ではなく画面から呼ぶ */
import { findSameDayVisit } from './visits'
import { charLength, matchKey } from './text'
import type { Customer, ID, ISODate, NextPlan, Visit } from './types'

export const LIMITS = {
  nickname: 20,
  pinnedMemo: 100,
  talkMemo: 500,
  recipe: 1000,
  agreedWeeks: 26,
  agreedMonths: 12,
} as const

export const VALIDATION_MESSAGES = {
  nicknameRequired: '呼び名を入れてください',
  nicknameTooLong: '20文字までにしてください',
  duplicateNickname: '同じ呼び名の方がいます',
  menuRequired: 'メニューを1つ選んでください',
  futureDate: '未来の日付は入れられません。次回の予約は『予約日を入れる』へ',
  bookedNotAfter: '予約日は来店日より後の日付にしてください',
  sameDay: 'この日の記録がすでにあります',
  url: 'https:// で始まるURLを入れてください',
  price: '金額は0以上の整数で入れてください',
  agreedRange: '目安は1〜26週か1〜12か月で選んでください',
  tooLong: (max: number) => `${max}文字までにしてください`,
} as const

export interface NicknameCheck {
  /** 保存を止めるエラー */
  error?: string
  /** 保存は止めない注意（同じ呼び名の方がいます） */
  warning?: string
}

/** 呼び名: 1〜20文字。同じ呼び名がいれば注意（保存は止めない） */
export function validateNickname(nickname: string, customers: readonly Customer[], excludeId?: ID): NicknameCheck {
  const trimmed = nickname.trim()
  if (trimmed === '') return { error: VALIDATION_MESSAGES.nicknameRequired }
  if (charLength(trimmed) > LIMITS.nickname) return { error: VALIDATION_MESSAGES.nicknameTooLong }
  const key = matchKey(trimmed)
  const dup = customers.some((c) => !c.deletedAt && c.id !== excludeId && matchKey(c.nickname) === key)
  return dup ? { warning: VALIDATION_MESSAGES.duplicateNickname } : {}
}

/** 予約リンク: 空か https:// で始まるURLだけ */
export function validateBookingLink(url: string | undefined): string | null {
  if (!url || url.trim() === '') return null
  const t = url.trim()
  if (!/^https:\/\/[^\s]+$/.test(t)) return VALIDATION_MESSAGES.url
  try {
    new URL(t)
  } catch {
    return VALIDATION_MESSAGES.url
  }
  return null
}

export interface VisitInputCheck {
  date: ISODate
  menuIds: readonly ID[]
  next: NextPlan
  price?: number
  talkMemo?: string
  recipeText?: string
  /** ざっくり登録だけはメニュー0でもよい */
  allowNoMenu?: boolean
}

/** 来店記録のエラー（保存を止めるもの）。なければ空配列 */
export function validateVisitInput(input: VisitInputCheck, today: ISODate): string[] {
  const errors: string[] = []
  if (!input.allowNoMenu && input.menuIds.length === 0) errors.push(VALIDATION_MESSAGES.menuRequired)
  if (input.date > today) errors.push(VALIDATION_MESSAGES.futureDate)
  if (input.next.kind === 'booked' && input.next.date <= input.date) errors.push(VALIDATION_MESSAGES.bookedNotAfter)
  if (input.next.kind === 'agreed') {
    const max = input.next.unit === 'week' ? LIMITS.agreedWeeks : LIMITS.agreedMonths
    if (!Number.isInteger(input.next.amount) || input.next.amount < 1 || input.next.amount > max) {
      errors.push(VALIDATION_MESSAGES.agreedRange)
    }
  }
  if (input.price != null && (!Number.isInteger(input.price) || input.price < 0)) errors.push(VALIDATION_MESSAGES.price)
  if (input.talkMemo && charLength(input.talkMemo) > LIMITS.talkMemo) errors.push(VALIDATION_MESSAGES.tooLong(LIMITS.talkMemo))
  if (input.recipeText && charLength(input.recipeText) > LIMITS.recipe) errors.push(VALIDATION_MESSAGES.tooLong(LIMITS.recipe))
  return errors
}

/** 同じ客・同じ日の記録がすでにあるか（4.3。［その記録を開く］［それでも保存］を出す） */
export function sameDayConflict(
  visits: readonly Visit[],
  customerId: ID,
  date: ISODate,
  editingVisitId?: ID,
): Visit | undefined {
  return findSameDayVisit(visits, customerId, date, editingVisitId)
}

/** 金額の入力欄（全角数字・カンマ・円を許す）。空なら undefined、読めなければ null */
export function parsePriceInput(text: string): number | undefined | null {
  const s = text.normalize('NFKC').replace(/[,\s円¥]/g, '')
  if (s === '') return undefined
  if (!/^\d+$/.test(s)) return null
  return Number(s)
}
