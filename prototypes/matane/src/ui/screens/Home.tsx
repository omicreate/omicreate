/** S1 ホーム（4.2）: お知らせ帯 → ［来店を記録］ → 今日のお客様 → 来た？ → 声かけ候補 → 出していない人 → まとめ記録 */
import { useState } from 'react'
import {
  bookedPhrase,
  CANDIDATE_LABEL_TEXT,
  dueBasisLine,
  firstLine,
  formatMonthDay,
  menuText,
  MESSAGES,
  staleDismissUntil,
  type Candidate,
  type ConfirmItem,
  type Menu,
  type TodayCustomer,
} from '../../domain'
import { loadSampleData, SAMPLE_DB } from '../../storage'
import { resolveNotVisited } from '../../state/actions'
import { useApp, useSettings } from '../../state/AppState'
import { useHomeModel } from '../../state/derived'
import { useFeedback } from '../../state/feedback'
import { to } from '../../state/router'
import { nowISO } from '../../state/today'
import { Empty, SectionHead, StatusBadge } from '../components/Basics'
import { ChevronRight } from '../components/Icons'

export const HOME_TEXT = {
  noCustomers: 'まずはお客様をざっくり登録しましょう。呼び名と、最後に来た月だけで始められます',
  noToday: '今日の予約は入っていません。会計時に次回の予約日を入れるか、［予約を入れる］で入れると、ここに出ます',
  noCandidates: '今日は声をかける人はいません',
  profileHint: 'またねカードと声かけの文面には、自分の名前（署名）と予約リンクが入ります。',
  profileLink: '自分の名前と予約リンクを設定する',
} as const

export function Home() {
  const app = useApp()
  const model = useHomeModel()
  const { toast, offerUndo } = useFeedback()
  const settings = useSettings()
  const [showMore, setShowMore] = useState(false)
  if (!model) return null
  const menus = app.data.menus

  const startSample = () => app.openDb(SAMPLE_DB, (repo) => loadSampleData(repo, app.today, nowISO()))

  const notVisited = async (item: ConfirmItem) => {
    let undo: () => Promise<void>
    try {
      undo = await app.mutate((repo) => resolveNotVisited(repo, { customer: item.customer, booking: item.booking, now: nowISO() }))
    } catch {
      toast(MESSAGES.saveFailed)
      return
    }
    offerUndo({
      key: `not-visited:${item.booking.source === 'visit' ? item.booking.visit.id : `customer:${item.customer.id}`}`,
      message: `${item.customer.nickname}さんを「来なかった」にしました`,
      undo,
    })
  }

  const dismissStale = async () => {
    try {
      await app.mutate((repo) => repo.updateSettings((s) => ({ ...s, staleDismissedUntil: staleDismissUntil(app.today) })))
      toast('7日間、この表示を止めます')
    } catch {
      toast(MESSAGES.saveFailed)
    }
  }

  // サンプルから移ったときなど、自分の名前と予約リンクがまだ空なら、文面に入ることを案内する（4.1）
  const needsProfile = !app.isSample && !settings.stylistName.trim() && !settings.bookingLink.self && !settings.bookingLink.salon

  const candidates = showMore ? model.eligibility.candidates : model.eligibility.shown

  return (
    <main className="screen stack" aria-labelledby="home-title">
      <h1 className="visually-hidden" id="home-title">
        ホーム
      </h1>

      {model.notice && (
        <div className="notice" role="region" aria-label="お知らせ">
          <p className="notice-title">{model.notice.text}</p>
          {model.notice.kind === 'stale' && (
            <div className="btn-row">
              <a className="btn btn-primary" href="#/batch">
                まとめて記録する
              </a>
              <button type="button" className="btn btn-outline" onClick={() => void dismissStale()}>
                休みでした
              </button>
            </div>
          )}
          {model.notice.kind === 'backup' && (
            <div className="btn-row">
              <a className="btn btn-primary" href="#/settings/data">
                バックアップする
              </a>
            </div>
          )}
        </div>
      )}

      <a className="btn btn-hero" href={to('/visit')}>
        来店を記録
      </a>
      {/* 主ボタンより目立たせない（会計後に LINE・電話で入った予約を、美容師が自分で入れる）。
          お客様がまだいなくても出す（電話の新しいお客様の予約から始めることもあるので） */}
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <a className="btn btn-outline btn-sm" href={to('/booking')}>
          予約を入れる
        </a>
      </div>

      {model.noCustomers ? (
        <Empty
          actions={
            <>
              <a className="btn btn-primary" href="#/bulk">
                ざっくり登録
              </a>
              <button type="button" className="btn btn-outline" onClick={() => void startSample()}>
                サンプルで試す
              </button>
            </>
          }
        >
          {HOME_TEXT.noCustomers}
        </Empty>
      ) : null}

      {model.noCustomers && needsProfile && (
        <div className="stack-xs">
          <p className="muted small">{HOME_TEXT.profileHint}</p>
          <a className="btn btn-outline btn-sm" href="#/settings/me">
            {HOME_TEXT.profileLink}
          </a>
        </div>
      )}

      {model.noCustomers ? null : (
        <>
          <section aria-labelledby="today-title">
            <SectionHead id="today-title" title="今日のお客様" count={model.todays.length ? `${model.todays.length}人` : undefined} />
            {model.todays.length === 0 ? (
              <p className="muted">{HOME_TEXT.noToday}</p>
            ) : (
              <ul className="list">
                {model.todays.map((t) => (
                  <TodayRow key={t.customer.id} item={t} menus={menus} />
                ))}
              </ul>
            )}
          </section>

          {model.confirms.length > 0 && (
            <section aria-labelledby="confirm-title">
              <SectionHead id="confirm-title" title="来た？の確認" count={`${model.confirms.length}人`} />
              <div className="stack-sm">
                {model.confirms.map((c) => (
                  <div className="card" key={c.customer.id}>
                    {/* 呼び名だけでなくカード全体を押せる（44px 以上）。ボタンはその上に出す */}
                    <a className="name stretched" href={`#/customer/${encodeURIComponent(c.customer.id)}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {c.customer.nickname}
                    </a>
                    <p className="meta">予約 {bookedPhrase(c.bookedDate)}</p>
                    <div className="btn-flow raise" style={{ marginTop: 12 }}>
                      <a className="btn btn-primary btn-sm" href={to('/visit', { c: c.customer.id, date: c.bookedDate, same: 1, back: '#/' })}>
                        来た
                      </a>
                      <a className="btn btn-sm" href={to('/visit', { c: c.customer.id, same: 1, focus: 'date', back: '#/' })}>
                        別の日に来た
                      </a>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => void notVisited(c)}>
                        来なかった
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="cand-title">
            <SectionHead id="cand-title" title="声をかけてもよさそうな人" count={`${model.eligibility.candidates.length}人`} />
            {model.eligibility.candidates.length === 0 ? (
              <p className="muted">{HOME_TEXT.noCandidates}</p>
            ) : (
              <div className="stack-sm">
                {candidates.map((c) => (
                  <CandidateCard key={c.customer.id} c={c} menus={menus} />
                ))}
                {model.eligibility.moreCount > 0 && !showMore && (
                  <button type="button" className="btn btn-outline btn-block" onClick={() => setShowMore(true)}>
                    ほかに{model.eligibility.moreCount}人
                  </button>
                )}
              </div>
            )}
            {(model.exclusionSummary || model.dormantSummary) && (
              <div style={{ marginTop: 12 }}>
                {model.exclusionSummary && (
                  <a className="summary-link" href={to('/customers', { filter: 'excluded' })}>
                    {model.exclusionSummary}
                  </a>
                )}
                {model.dormantSummary && (
                  <a className="summary-link" href={to('/customers', { filter: 'dormant' })}>
                    {model.dormantSummary}
                  </a>
                )}
              </div>
            )}
          </section>

          <a className="list-link card" href="#/batch" style={{ padding: '12px 16px' }}>
            <span className="grow">閉店後のまとめ記録</span>
            <ChevronRight />
          </a>
        </>
      )}
      {settings.onlyContactOkInList && <p className="faint xs">連絡OKの人だけを候補にしています（設定で変えられます）</p>}
    </main>
  )
}

function TodayRow({ item, menus }: { item: TodayCustomer; menus: readonly Menu[] }) {
  const prev = item.previousVisit
  const recipe = firstLine(prev?.recipe?.text)
  const talk = firstLine(prev?.talkMemo)
  return (
    <li className="list-item">
      <div className="grow">
        <a className="name stretched" href={`#/customer/${encodeURIComponent(item.customer.id)}`} style={{ color: 'inherit', textDecoration: 'none' }}>
          {item.customer.nickname}
        </a>
        {prev ? (
          <p className="meta">
            前回 {formatMonthDay(prev.date)}　{menuText(prev.menuIds, menus) || 'メニューなし'}
          </p>
        ) : item.recorded ? null : (
          <p className="meta">はじめてのご来店</p>
        )}
        {recipe && <p className="meta clamp2">レシピ: {recipe}</p>}
        {talk && <p className="meta oneline">会話: {talk}</p>}
      </div>
      {item.recorded ? (
        <span className="badge raise">記録済み</span>
      ) : (
        <a
          className="btn btn-primary btn-sm raise"
          href={to('/visit', { c: item.customer.id, same: 1, back: '#/' })}
          aria-label={`${item.customer.nickname}さん 来た`}
        >
          来た
        </a>
      )}
    </li>
  )
}

function CandidateCard({ c, menus }: { c: Candidate; menus: readonly Menu[] }) {
  const href = `#/koekake/${encodeURIComponent(c.customer.id)}`
  return (
    <article className="card candidate" aria-label={c.customer.nickname}>
      <div className="candidate-head">
        <span className="name">{c.customer.nickname}</span>
        <StatusBadge status={c.due.status} />
      </div>
      <p className="basis">{dueBasisLine(c.due, menus)}</p>
      {c.due.lastVisit && <p className="meta">前回 {menuText(c.due.lastVisit.menuIds, menus) || 'メニューなし'}</p>}
      {c.labels.length > 0 && (
        <div className="badges" style={{ marginTop: 8 }}>
          {c.labels.map((l) => (
            <span key={l} className="tag">
              {CANDIDATE_LABEL_TEXT[l]}
            </span>
          ))}
        </div>
      )}
      <a className="btn btn-block stretched" href={href}>
        声をかける
      </a>
    </article>
  )
}
