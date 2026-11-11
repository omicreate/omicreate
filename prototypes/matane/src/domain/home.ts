/** ホーム（4.2）に出すものをまとめて計算する */
import { dormantSummaryText, eligibility, exclusionSummaryText, type EligibilityResult } from './eligibility'
import { homeNotice, type HomeNotice } from './freshness'
import { confirmList, todaysCustomers, type ConfirmItem, type TodayCustomer } from './today'
import type { ContactLog, Customer, ISODate, LocalCounters, Menu, Settings, Visit } from './types'

export interface HomeInput {
  customers: readonly Customer[]
  visits: readonly Visit[]
  contacts: readonly ContactLog[]
  menus: readonly Menu[]
  settings: Settings
  counters: LocalCounters
  today: ISODate
  /** サンプル用データベースを開いているか */
  isSample: boolean
  /** ホーム画面から開いているか */
  isStandalone?: boolean
}

export interface HomeModel {
  /** お知らせ帯（優先順に1つ） */
  notice: HomeNotice | null
  /** 今日のお客様 */
  todays: TodayCustomer[]
  /** 来た？の確認 */
  confirms: ConfirmItem[]
  /** 声をかけてもよさそうな人 */
  eligibility: EligibilityResult
  /** 「所属サロンの顧客 1人・…は出していません」 */
  exclusionSummary: string | null
  /** 「1年以上来ていない人 ○人」 */
  dormantSummary: string | null
  /** 顧客が0人（空の状態の案内を出す） */
  noCustomers: boolean
}

export function buildHomeModel(input: HomeInput): HomeModel {
  const { customers, visits, contacts, menus, settings, counters, today, isSample, isStandalone } = input
  const elig = eligibility({ customers, visits, contacts, menus, settings, today })
  return {
    notice: homeNotice({ customers, visits, counters, settings, today, isSample, isStandalone }),
    todays: todaysCustomers(customers, visits, today),
    confirms: confirmList(customers, visits, menus, settings, today),
    eligibility: elig,
    exclusionSummary: exclusionSummaryText(elig.summary, settings),
    dormantSummary: dormantSummaryText(elig.dormant.length),
    noCustomers: !customers.some((c) => !c.deletedAt),
  }
}
