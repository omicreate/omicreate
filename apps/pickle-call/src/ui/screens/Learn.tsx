// 学ぶ（3択）。1回5問。出題順は orderScenes（前回まちがえた場面 → まだ出していない場面 → 古い順）。
// #/learn?scene=<id> はその場面を1問目に出す（リールからの直リンク）。知らない id は無視する。
// 正解は問題データに書かず、buildScene がエンジンで計算する。責めない言い方にし、ストリークは出さない。
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { buildScene, orderScenes, sceneById } from '../../domain/learn'
import type { BuiltScene, Choice, LearnProgress } from '../../domain/learn'
import { RULESET } from '../../domain/rules/usap-2026'
import type { Format, Lang } from '../../domain/types'
import type { T } from '../../i18n'
import { Court } from '../components/Court'
import { IconBack, IconCheck, IconX } from '../components/Icons'
import { href } from '../router'
import { useApp } from '../store'
import './learn.css'

/** 1回の問題数 */
const SESSION_SIZE = 5

interface Answer {
  id: string
  pick: string
  ok: boolean
}

interface Session {
  ids: string[]
  /** 選択肢の並びの種。記録した答えの総数なので、回ごとに変わり、同じ回の中では変わらない */
  seed: number
  index: number
  answers: Answer[]
  done: boolean
}

function newSession(progress: LearnProgress, pinned?: string): Session {
  const ids = orderScenes(progress, pinned).slice(0, SESSION_SIZE)
  const seed = Object.values(progress).reduce((sum, p) => sum + (Number.isFinite(p.n) ? p.n : 0), 0)
  return { ids, seed, index: 0, answers: [], done: false }
}

function build(id: string, lang: Lang, seed: number): BuiltScene | null {
  const scene = sceneById(id)
  return scene ? buildScene(scene, lang, seed) : null
}

/** 自動の説明と追記をつなぐ空白は、日本語では取る */
const tidy = (text: string, lang: Lang) => (lang === 'ja' ? text.replace(/。\s+/g, '。') : text)

/** 数字だけを等幅にする（例: 5問中4問） */
function withNums(text: string) {
  return text.split(/(\d+)/).map((part, i) =>
    /^\d+$/.test(part) ? (
      <span key={i} className="num">
        {part}
      </span>
    ) : (
      part
    ),
  )
}

/** 形式の短い説明。区切りの位置でだけ折り返す（例: ダブルス・サイドアウト方式・11点） */
function FormatLine({ f, t }: { f: Format; t: T }) {
  const parts = [
    t(f.kind === 'doubles' ? 'common.doubles' : 'common.singles'),
    t(f.scoring === 'sideout' ? 'common.sideout' : 'common.rally'),
    t('common.points', { n: f.target }),
  ]
  // 区切りの後ろの空白（英語の「 · 」）は部分の外に出す（部分の端の空白は折り返しの箱の中で消えるため）
  const sep = t('learn.sep')
  const gap = sep !== sep.trimEnd()
  return (
    <p className="ln-format">
      {parts.map((p, i) => {
        const last = i === parts.length - 1
        return (
          <span key={p}>
            <span className="ln-format-part">
              {p}
              {last ? '' : sep.trimEnd()}
            </span>
            {!last && gap ? ' ' : null}
          </span>
        )
      })}
    </p>
  )
}

/** 図の時点のコールを見せるか。試合開始の場面では、いまのコールがそのまま答えになるので出さない */
const showsNow = (b: BuiltScene) => b.scene.ask !== 'endchange' && b.scene.seq.length > 0

/** 長い問いは少し小さくして、選択肢が画面に入るようにする */
const LONG_QUESTION = { ja: 24, en: 48 }

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

type FocusTarget = 'feedback' | 'question' | 'summary'

export function Learn({ scene }: { scene?: string }) {
  const { t, lang, learn, actions } = useApp()
  const pinned = scene && sceneById(scene) ? scene : undefined
  const [session, setSession] = useState(() => newSession(learn, pinned))

  // 開いたまま別の場面の直リンクに来たら、その場面から始め直す
  const [pinnedSeen, setPinnedSeen] = useState(pinned)
  if (pinned !== pinnedSeen) {
    setPinnedSeen(pinned)
    if (pinned) setSession(newSession(learn, pinned))
  }

  const focusNext = useRef<FocusTarget | null>(null)
  const questionHead = useRef<HTMLHeadingElement>(null)
  const feedbackHead = useRef<HTMLHeadingElement>(null)
  const feedbackBox = useRef<HTMLElement>(null)
  const summaryHead = useRef<HTMLHeadingElement>(null)

  // 答えた後は解説の見出しへ、次の問題では問いへ、まとめでは点数へフォーカスを移す
  useEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = null
    if (target === 'feedback') {
      feedbackBox.current?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
      feedbackHead.current?.focus({ preventScroll: true })
      return
    }
    window.scrollTo(0, 0)
    const el = target === 'question' ? questionHead.current : summaryHead.current
    el?.focus({ preventScroll: true })
  })

  const total = session.ids.length
  const id = session.ids[session.index]
  const built = useMemo(() => (id ? build(id, lang, session.seed) : null), [id, lang, session.seed])
  const answer: Answer | undefined = session.answers[session.index]

  const pick = (c: Choice) => {
    if (!id || answer || session.done) return
    actions.recordLearn(id, c.correct)
    focusNext.current = 'feedback'
    setSession((s) => (s.answers.length > s.index ? s : { ...s, answers: [...s.answers, { id, pick: c.id, ok: c.correct }] }))
  }

  const next = () => {
    if (!answer) return
    if (session.index + 1 < total) {
      focusNext.current = 'question'
      setSession((s) => ({ ...s, index: s.index + 1 }))
      return
    }
    if (!session.done) actions.learnFinished()
    focusNext.current = 'summary'
    setSession((s) => ({ ...s, done: true }))
  }

  const again = () => {
    // 直リンクの場面は最初の回だけ。URL からも外す（再読み込みで同じ場面が先頭に戻らないように）
    try {
      if (scene) history.replaceState(history.state, '', href('learn'))
    } catch {
      // URL を書き換えられなくても続けられる
    }
    focusNext.current = 'question'
    setSession(newSession(learn))
  }

  return (
    <main className="page ln">
      <header className="page-head ln-head">
        <a className="icon-btn ln-back" href={href('home')} aria-label={t('learn.backToHome')}>
          <IconBack />
        </a>
        <h1>{t('learn.title')}</h1>
        {!session.done && total > 0 && (
          <p className="ln-progress num" aria-hidden="true">
            {t('learn.progress', { n: session.index + 1, total })}
          </p>
        )}
      </header>

      {!session.done && total > 0 && (
        <div className="ln-bar" aria-hidden="true">
          {session.ids.map((sid, i) => (
            <span key={`${sid}-${i}`} data-step={i < session.answers.length ? 'done' : i === session.index ? 'now' : 'todo'} />
          ))}
        </div>
      )}

      {session.done ? (
        <Summary session={session} headRef={summaryHead} onAgain={again} />
      ) : built ? (
        <Question
          key={`${session.seed}:${session.index}:${built.scene.id}`}
          built={built}
          index={session.index}
          total={total}
          answer={answer}
          isLast={session.index + 1 >= total}
          onPick={pick}
          onNext={next}
          questionRef={questionHead}
          feedbackRef={feedbackHead}
          feedbackBoxRef={feedbackBox}
        />
      ) : null}
    </main>
  )
}

interface QuestionProps {
  built: BuiltScene
  index: number
  total: number
  answer?: Answer
  isLast: boolean
  onPick: (c: Choice) => void
  onNext: () => void
  questionRef: RefObject<HTMLHeadingElement | null>
  feedbackRef: RefObject<HTMLHeadingElement | null>
  feedbackBoxRef: RefObject<HTMLElement | null>
}

function Question({ built, index, total, answer, isLast, onPick, onNext, questionRef, feedbackRef, feedbackBoxRef }: QuestionProps) {
  const { t, lang } = useApp()
  const { scene, setup } = built
  const showCourt = scene.ask !== 'endchange'
  const showNow = showsNow(built)
  const isRally = setup.format.scoring === 'rally'
  const isCall = scene.ask === 'call'

  return (
    <section className="ln-q" data-testid="learn-question" data-scene={scene.id} aria-labelledby="ln-question">
      <div className={`ln-stage${showCourt ? '' : ' ln-stage-text'}`}>
        {showCourt && (
          <div className="ln-court">
            <Court setup={setup} view={built.beforeView} size="sm" showRoles />
          </div>
        )}
        <div className="ln-context">
          <FormatLine f={setup.format} t={t} />
          {showNow && (
            <p className="ln-now">
              <span className="ln-now-label">{t('learn.nowCall')}</span>
              <span className="ln-now-call num" data-testid="learn-now-call">
                {built.beforeView.callText}
              </span>
            </p>
          )}
          {built.situation && <p className="ln-situation">{built.situation}</p>}
        </div>
      </div>

      <h2
        id="ln-question"
        className={`ln-question${built.question.length > LONG_QUESTION[lang] ? ' ln-question-long' : ''}`}
        ref={questionRef}
        tabIndex={-1}
      >
        <span className="visually-hidden">{t('learn.progressLabel', { n: index + 1, total })} </span>
        {built.question}
      </h2>

      <div className="ln-choices" role="group" aria-label={t('learn.choices')}>
        {built.choices.map((c) => {
          const state = !answer ? 'idle' : c.correct ? 'correct' : c.id === answer.pick ? 'wrong' : 'rest'
          return (
            <button
              key={c.id}
              type="button"
              className={`ln-choice${isCall ? ' ln-choice-call' : ''}`}
              data-state={state}
              data-choice={c.id}
              data-correct={c.correct ? 'true' : 'false'}
              disabled={!!answer}
              onClick={() => onPick(c)}
            >
              <span className="ln-choice-mark" aria-hidden="true">
                {state === 'correct' && <IconCheck />}
                {state === 'wrong' && <IconX />}
              </span>
              <span className={`ln-choice-label${isCall ? ' num' : ''}`}>{c.label}</span>
              {state === 'correct' && <span className="ln-choice-tag">{t('learn.tagCorrect')}</span>}
              {state === 'wrong' && <span className="ln-choice-tag">{t('learn.tagPicked')}</span>}
            </button>
          )
        })}
      </div>

      <div className="ln-live" aria-live="polite">
        {answer && (
          <section className="ln-feedback" ref={feedbackBoxRef} data-ok={answer.ok ? 'true' : 'false'} data-testid="learn-feedback">
            <h2 className="ln-fb-head" ref={feedbackRef} tabIndex={-1}>
              <span className="ln-fb-icon" aria-hidden="true">
                {answer.ok ? <IconCheck /> : <IconX />}
              </span>
              {t(answer.ok ? 'learn.correct' : 'learn.wrong')}
            </h2>
            {!answer.ok && <p className="ln-fb-answer">{t('learn.answer', { answer: built.answerLabel })}</p>}
            {built.explanation && <p className="ln-fb-text">{tidy(built.explanation, lang)}</p>}
            {isRally && <p className="ln-note">{t('learn.rallyNote')}</p>}
            {built.refs.length > 0 && <Refs refs={built.refs} />}
            <button type="button" className="btn btn-primary btn-block btn-lg ln-next" onClick={onNext}>
              {t(isLast ? 'learn.toSummary' : 'learn.next')}
            </button>
          </section>
        )}
      </div>
    </section>
  )
}

function Refs({ refs }: { refs: string[] }) {
  const { t, lang } = useApp()
  return (
    <div className="ln-refs">
      <h3 className="ln-refs-head">{t('learn.refs')}</h3>
      <ul className="ln-refs-list">
        {refs.map((r) => {
          const title = RULESET.refs[r]?.[lang] ?? ''
          const no = r.startsWith('CD-') ? t('learn.change', { no: r.slice(3) }) : r
          return (
            <li key={r}>
              <span className="ln-ref-no num">{no}</span>
              {title && <span className="ln-ref-title">{title}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

interface SummaryProps {
  session: Session
  headRef: RefObject<HTMLHeadingElement | null>
  onAgain: () => void
}

function Summary({ session, headRef, onAgain }: SummaryProps) {
  const { t, lang } = useApp()
  const total = session.answers.length
  const n = session.answers.filter((a) => a.ok).length
  const rows = useMemo(
    () => session.answers.map((a) => ({ a, built: build(a.id, lang, session.seed) })),
    [session.answers, session.seed, lang],
  )
  const score = `${t('learn.score', { n, total })} ${t('learn.scoreSuffix')}`

  return (
    <section className="ln-sum" data-testid="learn-summary" aria-labelledby="ln-score">
      <p className="ln-kicker">{t('learn.summaryTitle')}</p>
      <h2 id="ln-score" className="ln-score" ref={headRef} tabIndex={-1}>
        {withNums(score)}
      </h2>
      <p className="ln-msg">{n === total ? t('learn.msgAll', { total }) : t('learn.msgSome')}</p>

      <div className="ln-actions">
        <button type="button" className="btn btn-primary btn-block btn-lg" onClick={onAgain}>
          {t('learn.again')}
        </button>
        <a className="btn btn-block" href={href('setup')}>
          {t('learn.tryScoring')}
        </a>
        <a className="btn btn-quiet btn-block" href={href('home')}>
          {t('learn.home')}
        </a>
      </div>

      <h3 className="ln-review-head">{t('learn.review')}</h3>
      <ol className="ln-review">
        {rows.map(({ a, built }, i) => (
          <li key={`${a.id}-${i}`} data-ok={a.ok ? 'true' : 'false'}>
            <span className="ln-review-mark">
              <span className="ln-review-icon" aria-hidden="true">
                {a.ok ? <IconCheck /> : <IconX />}
              </span>
              {t(a.ok ? 'learn.reviewOk' : 'learn.reviewNg')}
            </span>
            <span className="ln-review-body">
              {built && showsNow(built) && (
                <span className="ln-review-ctx">
                  {t('learn.nowCall')} <span className="num">{built.beforeView.callText}</span>
                </span>
              )}
              <span className="ln-review-q">{built?.question ?? a.id}</span>
              {built && <span className="ln-review-a">{t('learn.reviewAnswer', { answer: built.answerLabel })}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
