/** 画面の外枠: 下のタブ、サンプル表示中の帯、保存できないときの帯 */
import type { JSX } from 'react'
import { MESSAGES } from '../../domain'
import { BoardIcon, HomeIcon, PeopleIcon, SettingsIcon } from './Icons'

export type TabKey = 'home' | 'customers' | 'board' | 'settings'

const TABS: ReadonlyArray<{ key: TabKey; label: string; href: string; Icon: () => JSX.Element }> = [
  { key: 'home', label: 'ホーム', href: '#/', Icon: HomeIcon },
  { key: 'customers', label: 'お客様', href: '#/customers', Icon: PeopleIcon },
  { key: 'board', label: 'ボード', href: '#/board', Icon: BoardIcon },
  { key: 'settings', label: '設定', href: '#/settings', Icon: SettingsIcon },
]

export function TabBar({ active }: { active: TabKey | null }) {
  return (
    <nav className="tabbar" aria-label="画面の切り替え">
      <div className="tabbar-inner">
        {TABS.map(({ key, label, href, Icon }) => (
          <a key={key} className="tab" href={href} aria-current={active === key ? 'page' : undefined}>
            <Icon />
            <span>{label}</span>
          </a>
        ))}
      </div>
    </nav>
  )
}

export function SampleBand() {
  return (
    <div className="band" role="note">
      サンプル表示中
    </div>
  )
}

export function StorageBand() {
  return (
    <div className="band band-warn" role="alert">
      {MESSAGES.storageUnavailable}
    </div>
  )
}
