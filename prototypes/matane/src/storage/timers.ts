/**
 * 画面から使う小さな時間の道具（DOMには依存しない）。
 * - createDraftSaver: 最後の入力から0.3秒後に下書きを保存し、pagehide・visibilitychange(hidden) では flush() ですぐ保存する（6.1）
 * - createUndoable: 削除などを10秒間「元に戻す」ことができ、時間がたつか画面を移ったら確定する（6.1）
 */

export const DRAFT_DELAY_MS = 300
export const UNDO_WINDOW_MS = 10_000

export interface DraftSaver<T> {
  /** 入力のたびに呼ぶ（0.3秒の間をおいて保存） */
  schedule(data: T): void
  /** すぐ保存する（pagehide・visibilitychange(hidden)・画面を閉じるとき） */
  flush(): Promise<void>
  /** 保存せずに捨てる（［保存］が成功したあと） */
  cancel(): void
  hasPending(): boolean
}

export function createDraftSaver<T>(save: (data: T) => Promise<void> | void, delayMs = DRAFT_DELAY_MS): DraftSaver<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: { data: T } | null = null
  const clear = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const flush = async () => {
    clear()
    if (!pending) return
    const { data } = pending
    pending = null
    await save(data)
  }
  return {
    schedule(data: T) {
      pending = { data }
      clear()
      timer = setTimeout(() => {
        void flush().catch(() => undefined)
      }, delayMs)
    },
    flush,
    cancel() {
      clear()
      pending = null
    },
    hasPending: () => pending !== null,
  }
}

export interface Undoable {
  /** ［元に戻す］。確定前なら undo を呼んで true */
  undo(): Promise<boolean>
  /** すぐ確定する（画面を移ったとき） */
  commitNow(): Promise<void>
  /** 取り消しも確定もせずに窓を閉じる（同じ対象の新しい窓に引き継ぐとき） */
  dismiss(): void
  isSettled(): boolean
}

/**
 * 取り消しの窓を開く。ms たつか commitNow() で commit を呼ぶ。その前に undo() されたら undo を呼ぶ。
 * どちらか一方だけが1回呼ばれる。
 */
export function createUndoable(handlers: { undo: () => Promise<void> | void; commit: () => Promise<void> | void }, ms = UNDO_WINDOW_MS): Undoable {
  let settled = false
  const timer = setTimeout(() => {
    void commitNow().catch(() => undefined)
  }, ms)
  async function commitNow(): Promise<void> {
    if (settled) return
    settled = true
    clearTimeout(timer)
    await handlers.commit()
  }
  return {
    async undo() {
      if (settled) return false
      settled = true
      clearTimeout(timer)
      await handlers.undo()
      return true
    },
    commitNow,
    dismiss() {
      settled = true
      clearTimeout(timer)
    },
    isSettled: () => settled,
  }
}
