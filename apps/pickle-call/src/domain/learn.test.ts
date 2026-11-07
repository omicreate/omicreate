// 学ぶ（learn.ts）: 12場面の3択。正解はテストの中でもエンジン（replay・applyEvent・deriveView）から独立に計算し直し、
// 仕様 §8.7 の表とも突き合わせる。出題順（orderScenes）と記録（recordAnswer）も確かめる。
import { describe, expect, it } from 'vitest'
import { applyEvent, initialState, replay } from './engine'
import { answerOf, buildScene, LEARN_NAMES, orderScenes, recordAnswer, SCENES, sceneById, sceneSetup, type LearnProgress, type Scene } from './learn'
import { RULESET } from './rules/usap-2026'
import type { Format, GameEvent, Lang, PlayerId, Setup, Team } from './types'
import { deriveView } from './view'

const LANGS: Lang[] = ['ja', 'en']

/** 仕様 §8.7 の表（エンジンが出すべき正解）。ここだけは手で書いた照合用 */
const SPEC_ANSWERS: Record<string, string> = {
  'start-call': '0-0-2',
  'first-point': '1-0-2',
  'server-moves': 'left',
  'start-sideout': '0-1-1',
  'first-server': 'B1',
  receiver: 'A1',
  'second-server': '1-1-2',
  'even-right': 'right',
  'singles-odd': 'left',
  'rally-call': '1-1',
  'rally-win': 'win',
  'end-change': 'first-6',
}

/** 仕様 §8.7: 既定はダブルス・サイドアウト方式・11点・2点差・Aが先にサーブ。スターティングサーバーは A1 と B1 */
function independentSetup(scene: Scene): Setup {
  const format: Format = { kind: 'doubles', scoring: 'sideout', target: 11, winBy: 2, ...scene.format }
  return { format, names: {}, startingServer: { A: 'A1', B: 'B1' }, firstServingTeam: 'A', rulesetId: 'usap-2026' }
}

const toEvents = (seq: Team[]): GameEvent[] => seq.map((winner, i) => ({ type: 'rally', winner, at: i }))

/** 正解の id をエンジンから独立に計算する（learn.ts の buildScene は使わない） */
function computeAnswer(scene: Scene): string {
  const setup = independentSetup(scene)
  const events = toEvents(scene.seq)
  switch (scene.ask) {
    case 'call':
    case 'server':
    case 'receiver':
    case 'side': {
      const state = replay(setup, events)
      const prev = events.length ? replay(setup, events.slice(0, -1)) : null
      const view = deriveView(prev, state, setup, events[events.length - 1])
      if (scene.ask === 'call') return view.callText
      if (scene.ask === 'server') return view.server
      if (scene.ask === 'receiver') return view.receiver
      return view.positions[scene.subject ?? view.server]!
    }
    case 'outcome': {
      const before = replay(setup, events)
      const hypo = scene.hypo!
      const after = applyEvent(before, { type: 'rally', winner: hypo, at: events.length }, setup)
      if (after.winner) return 'win'
      return after.score[hypo] === before.score[hypo] ? 'sideout' : 'continue'
    }
    case 'endchange':
      return `first-${RULESET.endChange[setup.format.target]}`
  }
}

describe('場面のデータ', () => {
  it('12場面で、id は重複しない。仕様の12個の id と同じ', () => {
    expect(SCENES).toHaveLength(12)
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(12)
    expect(SCENES.map((s) => s.id).sort()).toEqual(Object.keys(SPEC_ANSWERS).sort())
  })

  it('sceneById は id で引ける。ない id は undefined', () => {
    for (const s of SCENES) expect(sceneById(s.id)).toBe(s)
    expect(sceneById('nope')).toBeUndefined()
  })

  it('side の問いには subject、outcome の問いには hypo がある', () => {
    for (const s of SCENES) {
      if (s.ask === 'side') expect(s.subject).toBeDefined()
      if (s.ask === 'outcome') expect(s.hypo).toBeDefined()
    }
  })

  it('sceneSetup: 既定の形式と、言語ごとの名前（シングルスは2人だけ）', () => {
    const d = sceneSetup(sceneById('start-call')!, 'ja')
    expect(d.format).toEqual({ kind: 'doubles', scoring: 'sideout', target: 11, winBy: 2 })
    expect(d.names).toEqual({ A1: 'あおい', A2: 'そら', B1: 'はると', B2: 'りん' })
    expect(d.startingServer).toEqual({ A: 'A1', B: 'B1' })
    expect(d.firstServingTeam).toBe('A')
    expect(sceneSetup(sceneById('start-call')!, 'en').names).toEqual({ A1: 'Ava', A2: 'Sam', B1: 'Ken', B2: 'Lily' })
    const sg = sceneSetup(sceneById('singles-odd')!, 'ja')
    expect(sg.format.kind).toBe('singles')
    expect(Object.keys(sg.names).sort()).toEqual(['A1', 'B1'])
    // 共有の名前表は書き換えない
    expect(Object.keys(LEARN_NAMES.ja)).toHaveLength(4)
  })
})

describe.each(LANGS)('12場面すべて（%s）', (lang) => {
  describe.each(SCENES.map((s) => [s.id, s] as const))('%s', (_id, scene) => {
    const built = buildScene(scene, lang, 0)

    it('選択肢はちょうど3つ。正解はちょうど1つ。id もラベルも重複しない', () => {
      expect(built.choices).toHaveLength(3)
      expect(built.choices.filter((c) => c.correct)).toHaveLength(1)
      expect(new Set(built.choices.map((c) => c.id)).size).toBe(3)
      expect(new Set(built.choices.map((c) => c.label)).size).toBe(3)
      for (const c of built.choices) expect(c.label.trim()).not.toBe('')
    })

    it('正解はエンジンで独立に計算した答えと同じで、仕様 §8.7 の表とも一致する', () => {
      const correct = built.choices.find((c) => c.correct)!
      const computed = computeAnswer(scene)
      expect(correct.id).toBe(computed)
      expect(computed).toBe(SPEC_ANSWERS[scene.id])
      expect(answerOf(scene, lang)).toBe(computed)
      expect(answerOf(scene)).toBe(computed) // 言語を省くと日本語で作る（正解の id は言語によらない）
      expect(built.answerLabel).toBe(correct.label)
    })

    it('人の問いは名前で、側の問いは言語に合った言葉で答える', () => {
      const correct = built.choices.find((c) => c.correct)!
      if (scene.ask === 'server' || scene.ask === 'receiver') {
        expect(correct.label).toBe(LEARN_NAMES[lang][correct.id as PlayerId])
        for (const c of built.choices) expect(c.label).toBe(LEARN_NAMES[lang][c.id as PlayerId])
      }
      if (scene.ask === 'side') {
        const labels: Record<string, Record<Lang, string>> = {
          right: { ja: '右', en: 'Right' },
          left: { ja: '左', en: 'Left' },
          either: { ja: 'どちらでもよい', en: 'Either side' },
        }
        for (const c of built.choices) expect(c.label).toBe(labels[c.id][lang])
      }
      if (scene.ask === 'call') for (const c of built.choices) expect(c.label).toBe(c.id)
    })

    it('問題の前後の状態: before は「このあと起きたこと」の直前、after はその後', () => {
      const setup = independentSetup(scene)
      const events = toEvents(scene.seq)
      if (scene.ask === 'outcome') {
        expect(built.before).toEqual(replay(setup, events))
        expect(built.after).toEqual(applyEvent(built.before, { type: 'rally', winner: scene.hypo!, at: events.length }, setup))
      } else if (events.length) {
        expect(built.before).toEqual(replay(setup, events.slice(0, -1)))
        expect(built.after).toEqual(replay(setup, events))
      } else {
        expect(built.before).toEqual(initialState(setup))
        expect(built.after).toEqual(built.before)
      }
      expect(built.beforeView).toEqual(deriveView(null, built.before, setup))
      expect(built.setup.format).toEqual(setup.format)
    })

    it('文: 問いの {A1} は名前に置き換わり、説明は空でない。条番号は場面のもの', () => {
      expect(built.question).not.toMatch(/\{[AB][12]\}/)
      expect(built.question.trim()).not.toBe('')
      if (scene.subject) expect(built.question).toContain(LEARN_NAMES[lang][scene.subject])
      expect(built.explanation.trim()).not.toBe('')
      if (scene.note) expect(built.explanation).toContain(scene.note[lang])
      if (scene.ask !== 'outcome') expect(built.situation.trim()).not.toBe('')
      expect(built.refs).toEqual(scene.refs)
    })

    it('選択肢の並びはシードで決まる（同じシードなら同じ並び）', () => {
      for (const seed of [0, 1, 2, 7, 12345]) {
        const a = buildScene(scene, lang, seed).choices
        const b = buildScene(scene, lang, seed).choices
        expect(a).toEqual(b)
        // どのシードでも選択肢の中身は同じ（並びだけが変わる）
        expect(a.map((c) => c.id).sort()).toEqual(built.choices.map((c) => c.id).sort())
      }
    })

    it('シードを変えると正解の位置も変わる（いつも同じ位置にはならない）', () => {
      const positions = new Set(Array.from({ length: 30 }, (_, seed) => buildScene(scene, lang, seed).choices.findIndex((c) => c.correct)))
      expect(positions.size).toBeGreaterThanOrEqual(2)
    })
  })
})

describe('仕様 §8.7 の名前つきの正解', () => {
  it('first-server ははると（Ken）、receiver はあおい（Ava）', () => {
    expect(buildScene(sceneById('first-server')!, 'ja', 0).answerLabel).toBe('はると')
    expect(buildScene(sceneById('first-server')!, 'en', 0).answerLabel).toBe('Ken')
    expect(buildScene(sceneById('receiver')!, 'ja', 0).answerLabel).toBe('あおい')
    expect(buildScene(sceneById('receiver')!, 'en', 0).answerLabel).toBe('Ava')
  })

  it('rally-win は「Bチームの勝ち（ゲーム終了）」、end-change は「先に6点」', () => {
    expect(buildScene(sceneById('rally-win')!, 'ja', 0).answerLabel).toBe('Bチームの勝ち（ゲーム終了）')
    expect(buildScene(sceneById('rally-win')!, 'en', 0).answerLabel).toBe('Team B wins the game')
    expect(buildScene(sceneById('end-change')!, 'ja', 0).answerLabel).toBe('どちらかが先に6点になったとき')
    expect(buildScene(sceneById('end-change')!, 'en', 0).answerLabel).toBe('When a side first reaches 6')
  })

  it('コールの誤答は仕様の作り方の順（①入れ替え ②番号の入れ違い ③番号を落とす ④サーブ側+1）から重複なく2つ', () => {
    const ids = (id: string) => buildScene(sceneById(id)!, 'ja', 0).choices.map((c) => c.id).sort()
    // 0-0-2: ①は同じになるので飛ばし、②0-0-1、③0-0
    expect(ids('start-call')).toEqual(['0-0', '0-0-1', '0-0-2'].sort())
    // 1-0-2: ①0-1-2、②1-0-1
    expect(ids('first-point')).toEqual(['0-1-2', '1-0-1', '1-0-2'].sort())
    // 1-1（2つの数字）: ①は同じなので飛ばし、③1-1-1、④2-1
    expect(ids('rally-call')).toEqual(['1-1', '1-1-1', '2-1'].sort())
  })
})

describe('orderScenes（出題順）', () => {
  const ids = SCENES.map((s) => s.id)

  it('記録がなければ SCENES の順', () => {
    expect(orderScenes({})).toEqual(ids)
  })

  it('まちがえた場面（古い順）→ まだ出していない場面（SCENES の順）→ 正解した場面（古い順）', () => {
    const p: LearnProgress = {
      [ids[5]]: { n: 1, ok: 0, last: 'ng', at: 300 },
      [ids[9]]: { n: 2, ok: 1, last: 'ng', at: 100 },
      [ids[0]]: { n: 1, ok: 1, last: 'ok', at: 50 },
      [ids[3]]: { n: 3, ok: 3, last: 'ok', at: 10 },
      [ids[11]]: { n: 1, ok: 1, last: 'ok', at: 999 },
    }
    const unseen = ids.filter((id) => !p[id])
    expect(orderScenes(p)).toEqual([ids[9], ids[5], ...unseen, ids[3], ids[0], ids[11]])
  })

  it('ディープリンクの場面（pinned）は先頭。残りの順は変わらない', () => {
    const p: LearnProgress = { [ids[2]]: { n: 1, ok: 0, last: 'ng', at: 5 } }
    const base = orderScenes(p)
    const pinned = orderScenes(p, 'rally-win')
    expect(pinned[0]).toBe('rally-win')
    expect(pinned.slice(1)).toEqual(base.filter((id) => id !== 'rally-win'))
    // まちがえた場面を pinned にしても重複しない
    expect(orderScenes(p, ids[2])).toEqual(base)
  })

  it('知らない pinned は無視する', () => {
    expect(orderScenes({}, 'no-such-scene')).toEqual(ids)
  })

  it('いつも全場面の並べ替え（抜けも重複もない）。記録に知らない id があっても無視する', () => {
    const p: LearnProgress = {
      ghost: { n: 1, ok: 0, last: 'ng', at: 1 },
      [ids[4]]: { n: 1, ok: 0, last: 'ng', at: 2 },
      [ids[7]]: { n: 1, ok: 1, last: 'ok', at: 3 },
    }
    const order = orderScenes(p, ids[7])
    expect(order).toHaveLength(12)
    expect([...order].sort()).toEqual([...ids].sort())
  })
})

describe('recordAnswer', () => {
  it('初めての答えを記録する', () => {
    expect(recordAnswer({}, 'start-call', true, 1000)).toEqual({ 'start-call': { n: 1, ok: 1, last: 'ok', at: 1000 } })
    expect(recordAnswer({}, 'start-call', false, 1000)).toEqual({ 'start-call': { n: 1, ok: 0, last: 'ng', at: 1000 } })
  })

  it('回数・正解数・最後の結果・時刻を更新し、元の記録は書き換えない', () => {
    const p0: LearnProgress = { receiver: { n: 2, ok: 2, last: 'ok', at: 10 }, 'rally-call': { n: 1, ok: 0, last: 'ng', at: 5 } }
    const frozen = structuredClone(p0)
    const p1 = recordAnswer(p0, 'receiver', false, 20)
    expect(p1.receiver).toEqual({ n: 3, ok: 2, last: 'ng', at: 20 })
    expect(p1['rally-call']).toBe(p0['rally-call'])
    expect(p0).toEqual(frozen)
    const p2 = recordAnswer(p1, 'receiver', true, 30)
    expect(p2.receiver).toEqual({ n: 4, ok: 3, last: 'ok', at: 30 })
  })

  it('まちがえた場面は次の出題で先頭に来る', () => {
    let p: LearnProgress = {}
    for (const [i, s] of SCENES.entries()) p = recordAnswer(p, s.id, true, i)
    p = recordAnswer(p, 'even-right', false, 100)
    expect(orderScenes(p)[0]).toBe('even-right')
    expect(orderScenes(p)[1]).toBe(SCENES[0].id)
  })
})
