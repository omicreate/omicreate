/** 画面で使う派生値（今日と設定を引数に、中身の純粋関数を呼ぶ） */
import { useMemo } from 'react'
import {
  buildHomeModel,
  eligibility,
  normalizeVisits,
  type ContactLog,
  type Customer,
  type EligibilityResult,
  type HomeModel,
  type ID,
  type Menu,
  type Visit,
} from '../domain'
import { useApp } from './AppState'
import { isStandalone } from './platform'

/** ホーム（4.2）に出すもの一式 */
export function useHomeModel(): HomeModel | null {
  const { data, today, isSample } = useApp()
  return useMemo(() => {
    if (!data.settings || !data.counters) return null
    return buildHomeModel({
      customers: data.customers,
      visits: data.visits,
      contacts: data.contacts,
      menus: data.menus,
      settings: data.settings,
      counters: data.counters,
      today,
      isSample,
      isStandalone: isStandalone(),
    })
  }, [data, today, isSample])
}

/** 声かけ候補・除外・全員の目安（6.6） */
export function useEligibility(): EligibilityResult | null {
  const { data, today } = useApp()
  return useMemo(() => {
    if (!data.settings) return null
    return eligibility({
      customers: data.customers,
      visits: data.visits,
      contacts: data.contacts,
      menus: data.menus,
      settings: data.settings,
      today,
    })
  }, [data, today])
}

export function customerById(customers: readonly Customer[], id: ID | undefined | null): Customer | undefined {
  if (!id) return undefined
  return customers.find((c) => c.id === id && !c.deletedAt)
}

/** その客の来店記録（古い順。今日より後と削除印つきは除く） */
export function visitsOf(visits: readonly Visit[], customerId: ID, today: string): Visit[] {
  return normalizeVisits(
    visits.filter((v) => v.customerId === customerId),
    today,
  )
}

/** その客の連絡記録（新しい順） */
export function contactsOf(contacts: readonly ContactLog[], customerId: ID): ContactLog[] {
  return contacts
    .filter((c) => c.customerId === customerId && !c.deletedAt)
    .slice()
    .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1))
}

/** チップに出すメニュー（並び順）。選ばれている非表示のメニューも出す */
export function chipMenus(menus: readonly Menu[], selected: readonly ID[] = []): Menu[] {
  return menus
    .filter((m) => m.visible || selected.includes(m.id))
    .slice()
    .sort((a, b) => a.order - b.order)
}

/** 最近のお客様（最後の来店記録の作成が新しい順） */
export function recentCustomers(customers: readonly Customer[], visits: readonly Visit[], limit = 5): Customer[] {
  const latest = new Map<ID, string>()
  for (const v of visits) {
    if (v.deletedAt) continue
    const key = `${v.date}|${v.createdAt}`
    const cur = latest.get(v.customerId)
    if (!cur || key > cur) latest.set(v.customerId, key)
  }
  return customers
    .filter((c) => !c.deletedAt)
    .slice()
    .sort((a, b) => {
      const ka = latest.get(a.id) ?? `0|${a.createdAt}`
      const kb = latest.get(b.id) ?? `0|${b.createdAt}`
      return ka < kb ? 1 : ka > kb ? -1 : 0
    })
    .slice(0, limit)
}
