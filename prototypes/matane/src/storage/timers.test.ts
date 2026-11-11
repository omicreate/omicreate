import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDraftSaver, createUndoable } from './timers'
import { loadSampleData, openRepository, SAMPLE_DB } from './index'
import { SAMPLE_IDS } from '../data/demo'

describe('下書きの自動保存（0.3秒後・flush ですぐ）', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('最後の入力から0.3秒後に1回だけ保存する', async () => {
    const saved: string[] = []
    const s = createDraftSaver<string>((d) => {
      saved.push(d)
    })
    s.schedule('ゆ')
    await vi.advanceTimersByTimeAsync(200)
    s.schedule('ゆず')
    await vi.advanceTimersByTimeAsync(299)
    expect(saved).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(saved).toEqual(['ゆず'])
    expect(s.hasPending()).toBe(false)
  })

  it('flush ですぐ保存し、cancel で捨てる', async () => {
    const saved: string[] = []
    const s = createDraftSaver<string>((d) => {
      saved.push(d)
    })
    s.schedule('途中')
    await s.flush()
    expect(saved).toEqual(['途中'])
    s.schedule('捨てる')
    s.cancel()
    await vi.advanceTimersByTimeAsync(1000)
    expect(saved).toEqual(['途中'])
  })
})

describe('削除の取り消し（10秒）', () => {
  afterEach(() => vi.useRealTimers())

  it('10秒以内なら元に戻せる。10秒たつと確定し、戻せない', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const u1 = createUndoable({ undo: () => void calls.push('undo1'), commit: () => void calls.push('commit1') })
    expect(await u1.undo()).toBe(true)
    await vi.advanceTimersByTimeAsync(10_000)
    const u2 = createUndoable({ undo: () => void calls.push('undo2'), commit: () => void calls.push('commit2') })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await u2.undo()).toBe(false)
    expect(calls).toEqual(['undo1', 'commit2'])
  })

  it('dismiss は取り消しも確定もせずに窓を閉じる', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const u = createUndoable({ undo: () => void calls.push('undo'), commit: () => void calls.push('commit') })
    u.dismiss()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await u.undo()).toBe(false)
    await u.commitNow()
    expect(calls).toEqual([])
    expect(u.isSettled()).toBe(true)
  })

  it('保存層と組み合わせる: 削除印 → 取り消し、または完全削除', async () => {
    const factory = new IDBFactory()
    const repo = await openRepository({ dbName: SAMPLE_DB, factory })
    await loadSampleData(repo, '2026-11-07', '2026-11-07T00:00:00.000Z')
    const visitId = `${SAMPLE_IDS.wakaba}-v1`
    await repo.softDeleteVisit(visitId)
    const u = createUndoable({ undo: () => repo.restoreVisit(visitId), commit: () => repo.purgeVisit(visitId) })
    await u.commitNow()
    expect(await u.undo()).toBe(false)
    expect(await repo.getVisit(visitId)).toBeUndefined()
    repo.close()
  })
})
