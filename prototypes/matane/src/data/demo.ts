/**
 * サンプルデータ（仕様 8.2）。架空の顧客10人で、呼び名は植物の名前。実在の人物を指すものではない。
 * 日付は「起動した日からの相対日数」で作る（いつ起動してもデモが成り立つ）。
 * ひいらぎの「年月だけ」の来店は、今月の4か月前の月末にする（今日 = 2026-11-07 なら 2026-07-31）。
 * 相対日数のままだと月末にそろえたときに経過日数が縮み、ご無沙汰にならない日があるため。
 */
import {
  addDays,
  createDefaultMenus,
  createDefaultSettings,
  createDefaultTemplates,
  endOfMonth,
  localNoonISO,
  MENU_IDS,
  NOTICE_VERSION,
  parseISODate,
  toISODate,
} from '../domain'
import type {
  AcquisitionChannel,
  BackupPayload,
  ContactLog,
  ContactPermission,
  Customer,
  DataSteward,
  ID,
  ISODate,
  ISODateTime,
  NextPlan,
  Visit,
} from '../domain'

/** サンプルの顧客 id（テストと受け入れテストから参照する） */
export const SAMPLE_IDS = {
  momiji: 'sample-momiji',
  suzuran: 'sample-suzuran',
  karin: 'sample-karin',
  yuzu: 'sample-yuzu',
  tsubaki: 'sample-tsubaki',
  nazuna: 'sample-nazuna',
  anzu: 'sample-anzu',
  komugi: 'sample-komugi',
  wakaba: 'sample-wakaba',
  hiiragi: 'sample-hiiragi',
} as const

export const SAMPLE_STYLIST_NAME = 'サンプル美容師'
export const SAMPLE_BOOKING_LINK = 'https://example.com/booking'

const OMAKASE: NextPlan = { kind: 'omakase' }
const SIX_WEEKS: NextPlan = { kind: 'agreed', amount: 6, unit: 'week' }

interface VisitSpec {
  /** 今日からの日数（負） */
  offset: number
  next: NextPlan
  talkMemo?: string
  recipe?: string
}

interface CustomerSpec {
  id: ID
  nickname: string
  kana: string
  steward: DataSteward
  channel: AcquisitionChannel
  permission: ContactPermission
  pinnedMemo?: string
  menuIds: ID[]
  visits: VisitSpec[]
}

/** 今月の n か月前の月末 */
function endOfMonthsAgo(today: ISODate, n: number): ISODate {
  const { y, m } = parseISODate(today)
  const total = y * 12 + (m - 1) - n
  return endOfMonth(toISODate(Math.floor(total / 12), (total % 12) + 1, 1))
}

/**
 * サンプルの BackupPayload を作る。
 * @param today 起動した日（端末のローカル日付）
 * @param now 作成日時（S0 の確認日時などに使う）。省略時は今の時刻
 */
export function buildDemoData(today: ISODate, now: ISODateTime = new Date().toISOString()): BackupPayload {
  const d = (offset: number) => addDays(today, offset)
  const { cut, color, gray, straight } = MENU_IDS

  const specs: CustomerSpec[] = [
    {
      id: SAMPLE_IDS.momiji,
      nickname: 'もみじ',
      kana: 'もみじ',
      steward: 'self',
      channel: 'own_line',
      permission: 'ok',
      pinnedMemo: '前髪は眉上が好み',
      menuIds: [cut, gray],
      visits: [
        { offset: -126, next: SIX_WEEKS },
        { offset: -84, next: SIX_WEEKS },
        { offset: -42, next: { kind: 'booked', date: d(0) }, recipe: '根元 ブラウン6＋グレー8 1:1／6%／30分' },
      ],
    },
    {
      id: SAMPLE_IDS.suzuran,
      nickname: 'すずらん',
      kana: 'すずらん',
      steward: 'self',
      channel: 'own_minimo',
      permission: 'ok',
      menuIds: [cut, color],
      visits: [
        { offset: -250, next: OMAKASE },
        { offset: -190, next: OMAKASE },
        { offset: -130, next: OMAKASE },
        { offset: -35, next: { kind: 'booked', date: d(-3) }, talkMemo: '犬の散歩の話' },
      ],
    },
    {
      id: SAMPLE_IDS.karin,
      nickname: 'かりん',
      kana: 'かりん',
      steward: 'self',
      channel: 'own_sns',
      permission: 'ok',
      menuIds: [cut, color],
      visits: [
        { offset: -218, next: OMAKASE },
        { offset: -162, next: OMAKASE },
        { offset: -106, next: OMAKASE },
        { offset: -50, next: OMAKASE, talkMemo: '年末に旅行' },
      ],
    },
    {
      id: SAMPLE_IDS.yuzu,
      nickname: 'ゆず',
      kana: 'ゆず',
      steward: 'self',
      channel: 'own_line',
      permission: 'ok',
      menuIds: [cut, gray],
      visits: [
        { offset: -245, next: OMAKASE },
        { offset: -189, next: OMAKASE },
        { offset: -133, next: OMAKASE },
        { offset: -77, next: OMAKASE, talkMemo: '娘さんの受験（秋）' },
      ],
    },
    {
      id: SAMPLE_IDS.tsubaki,
      nickname: 'つばき',
      kana: 'つばき',
      steward: 'self',
      channel: 'referral',
      permission: 'unknown',
      menuIds: [color],
      visits: [
        { offset: -260, next: OMAKASE },
        { offset: -200, next: OMAKASE },
        { offset: -140, next: OMAKASE },
      ],
    },
    {
      id: SAMPLE_IDS.nazuna,
      nickname: 'なずな',
      kana: 'なずな',
      steward: 'self',
      channel: 'own_line',
      permission: 'ok',
      menuIds: [cut, gray],
      visits: [
        { offset: -154, next: OMAKASE },
        { offset: -112, next: OMAKASE },
        { offset: -70, next: OMAKASE },
      ],
    },
    {
      id: SAMPLE_IDS.anzu,
      nickname: 'あんず',
      kana: 'あんず',
      steward: 'salon',
      channel: 'salon_media',
      permission: 'ok',
      menuIds: [cut, color],
      visits: [
        { offset: -200, next: OMAKASE },
        { offset: -140, next: OMAKASE },
        { offset: -80, next: OMAKASE },
      ],
    },
    {
      id: SAMPLE_IDS.komugi,
      nickname: 'こむぎ',
      kana: 'こむぎ',
      steward: 'self',
      channel: 'own_sns',
      permission: 'no',
      pinnedMemo: '連絡は不要とのこと',
      menuIds: [cut],
      visits: [
        { offset: -210, next: OMAKASE },
        { offset: -150, next: OMAKASE },
        { offset: -80, next: OMAKASE },
      ],
    },
    {
      id: SAMPLE_IDS.wakaba,
      nickname: 'わかば',
      kana: 'わかば',
      steward: 'self',
      channel: 'own_minimo',
      permission: 'ok',
      menuIds: [cut, color],
      visits: [{ offset: -5, next: SIX_WEEKS, talkMemo: 'ボブ希望' }],
    },
  ]

  const customers: Customer[] = []
  const visits: Visit[] = []

  for (const s of specs) {
    const first = d(s.visits[0].offset)
    const created = localNoonISO(first)
    const c: Customer = {
      id: s.id,
      nickname: s.nickname,
      kana: s.kana,
      stewardship: { steward: s.steward, channel: s.channel, decidedOn: first },
      contact:
        s.permission === 'unknown'
          ? { permission: 'unknown' }
          : { permission: s.permission, confirmedOn: first, method: 'in_person' },
      createdAt: created,
      updatedAt: created,
    }
    if (s.pinnedMemo) c.pinnedMemo = s.pinnedMemo
    customers.push(c)
    s.visits.forEach((vs, i) => {
      const date = d(vs.offset)
      const v: Visit = {
        id: `${s.id}-v${i + 1}`,
        customerId: s.id,
        date,
        menuIds: [...s.menuIds],
        next: vs.next,
        source: 'checkout',
        createdAt: localNoonISO(date),
        updatedAt: localNoonISO(date),
      }
      if (vs.talkMemo) v.talkMemo = vs.talkMemo
      if (vs.recipe) v.recipe = { text: vs.recipe }
      visits.push(v)
    })
  }

  // ひいらぎ: ざっくり登録（年月だけ、source 'bulk'）
  const hiiragiDate = endOfMonthsAgo(today, 4)
  customers.push({
    id: SAMPLE_IDS.hiiragi,
    nickname: 'ひいらぎ',
    kana: 'ひいらぎ',
    stewardship: { steward: 'self', channel: 'unknown', decidedOn: hiiragiDate },
    contact: { permission: 'unknown' },
    createdAt: localNoonISO(hiiragiDate),
    updatedAt: localNoonISO(hiiragiDate),
  })
  visits.push({
    id: `${SAMPLE_IDS.hiiragi}-v1`,
    customerId: SAMPLE_IDS.hiiragi,
    date: hiiragiDate,
    dateApprox: 'month',
    menuIds: [straight],
    next: { kind: 'none' },
    source: 'bulk',
    createdAt: localNoonISO(hiiragiDate),
    updatedAt: localNoonISO(hiiragiDate),
  })

  // 連絡記録は kind 'koekake' の2件だけ
  const contacts: ContactLog[] = [
    {
      id: `${SAMPLE_IDS.karin}-k1`,
      customerId: SAMPLE_IDS.karin,
      date: d(-55),
      kind: 'koekake',
      via: 'line_link',
      createdAt: localNoonISO(d(-55)),
    },
    {
      id: `${SAMPLE_IDS.nazuna}-k1`,
      customerId: SAMPLE_IDS.nazuna,
      date: d(-10),
      kind: 'koekake',
      via: 'copy',
      createdAt: localNoonISO(d(-10)),
    },
  ]

  const settings = createDefaultSettings({ version: NOTICE_VERSION, ackedAt: now })
  settings.stylistName = SAMPLE_STYLIST_NAME
  settings.bookingLink = { self: SAMPLE_BOOKING_LINK }

  return {
    schemaVersion: 1,
    customers,
    visits,
    menus: createDefaultMenus(),
    contacts,
    templates: createDefaultTemplates(now),
    settings,
    counters: {
      firstUsedOn: d(-260),
      visitsSaved: visits.filter((v) => v.source !== 'bulk').length,
      mataneSent: 0,
      koekakeSent: contacts.length,
      koekakeSkipped: 0,
      actuallyVisitedFixes: 0,
    },
  }
}
