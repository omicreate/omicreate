/** 画面に出す表示名（日本語）。責める言い方は使わない（4.0） */
import type {
  AcquisitionChannel,
  ContactMethod,
  ContactPermission,
  ContactVia,
  ContactKind,
  DataSteward,
  NextPlan,
  TimingStatus,
  VisitSource,
} from './types'
import { formatMonthDay } from './dates'

export const STATUS_LABELS: Record<TimingStatus, string> = {
  no_data: '来店記録なし',
  archived: 'リストから外した',
  today: '今日',
  booked: '予約あり',
  confirm: '確認待ち',
  not_yet: 'まだ',
  soon: 'そろそろ',
  overdue: 'ご無沙汰',
  lapsed: '離れたかも',
  dormant: '1年以上来ていない',
}

export const STEWARD_LABELS: Record<DataSteward, string> = {
  self: '本人',
  salon: '所属サロン',
}

export const CHANNEL_LABELS: Record<AcquisitionChannel, string> = {
  own_sns: '本人SNS',
  own_minimo: '本人minimo',
  own_line: '本人LINE',
  own_other: '本人のその他',
  referral: '紹介',
  salon_media: 'サロン媒体',
  salon_handover: 'サロンからの引き継ぎ',
  unknown: '不明',
}

/** ざっくり登録・登録フォームの並び順 */
export const CHANNEL_ORDER: readonly AcquisitionChannel[] = [
  'own_sns',
  'own_minimo',
  'own_line',
  'own_other',
  'referral',
  'salon_media',
  'salon_handover',
  'unknown',
]

export const PERMISSION_LABELS: Record<ContactPermission, string> = {
  ok: 'OK',
  no: 'しない',
  unknown: '未確認',
}

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  in_person: '対面で',
  message: 'メッセージの返事で',
}

export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  koekake: '声かけ',
  matane: 'またねカード',
}

export const CONTACT_VIA_LABELS: Record<ContactVia, string> = {
  line_link: 'LINE',
  copy: 'コピー',
}

export const VISIT_SOURCE_LABELS: Record<VisitSource, string> = {
  checkout: '会計',
  batch: 'まとめ記録',
  one_line: '1行入力',
  bulk: 'ざっくり登録',
  fix: '実は来ていた',
}

/** 獲得経路で「サロン媒体」「サロンからの引き継ぎ」を選ぶと、管理者の初期値を「所属サロン」にする（4.7） */
export function defaultStewardForChannel(channel: AcquisitionChannel): DataSteward {
  return channel === 'salon_media' || channel === 'salon_handover' ? 'salon' : 'self'
}

/** 次回の約束の短い表示: 「6週」「2か月」「予約 12/19」「おまかせ」「未入力」 */
export function nextPlanLabel(next: NextPlan): string {
  switch (next.kind) {
    case 'booked':
      return `予約 ${formatMonthDay(next.date)}`
    case 'agreed':
      return next.unit === 'week' ? `${next.amount}週` : `${next.amount}か月`
    case 'omakase':
      return 'おまかせ'
    case 'none':
      return '未入力'
  }
}

/** 来店記録の次回のチップ（4.3）: ［4週］［6週］［2か月］［3か月］［おまかせ］ */
export const NEXT_CHIPS: ReadonlyArray<{ label: string; next: NextPlan }> = [
  { label: '4週', next: { kind: 'agreed', amount: 4, unit: 'week' } },
  { label: '6週', next: { kind: 'agreed', amount: 6, unit: 'week' } },
  { label: '2か月', next: { kind: 'agreed', amount: 2, unit: 'month' } },
  { label: '3か月', next: { kind: 'agreed', amount: 3, unit: 'month' } },
  { label: 'おまかせ', next: { kind: 'omakase' } },
]
