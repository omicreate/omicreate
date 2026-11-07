/**
 * またねカード（4.3）: 差し込み済みの文面（編集できる）→［LINEで送る］［コピー］［送らない］→「送りましたか？」。
 * ［送った］で ContactLog（kind 'matane'）を残し、カードが控えめに上へ消える（このアプリで唯一の動き）。
 */
import { useMemo, useRef, useState } from 'react'
import { defaultTemplateBody, MESSAGES, renderMatane, type ContactVia, type Customer, type Visit } from '../../domain'
import { recordContact } from '../../state/actions'
import { useApp, useSettings } from '../../state/AppState'
import { useFeedback } from '../../state/feedback'
import { prefersReducedMotion } from '../../state/platform'
import { nowISO } from '../../state/today'
import { SentMark } from '../components/Icons'
import { MessageEditor, type MessageEditorHandle } from '../components/MessageEditor'
import { SendActions } from '../components/SendActions'
import { Sheet } from '../components/Sheet'

export function MataneSheet({ customer, visit, onDone }: { customer: Customer; visit: Visit; onDone: () => void }) {
  const app = useApp()
  const settings = useSettings()
  const body = app.data.templates.find((t) => t.kind === 'matane')?.body ?? defaultTemplateBody('matane')
  const initial = useMemo(
    () => renderMatane({ body, customer, visit, menus: app.data.menus, settings }).text,
    // 開いたときの文面で固定する（入力中に読み直しで上書きしない）
    [],
  )
  const [text, setText] = useState(initial)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const editor = useRef<MessageEditorHandle>(null)
  const { toast } = useFeedback()
  const saving = useRef(false)

  const onSent = async (via: ContactVia) => {
    if (saving.current) return
    saving.current = true
    setBusy(true)
    try {
      await app.mutate((repo) => recordContact(repo, { customer, kind: 'matane', via, today: app.today, now: nowISO() }))
      setSent(true)
      window.setTimeout(onDone, prefersReducedMotion() ? 700 : 1200)
    } catch {
      toast(MESSAGES.saveFailed)
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  return (
    <Sheet title="またねカード" onClose={onDone} dismissible={!sent}>
      <div className="stack-sm">
        <p className="muted small">{customer.nickname}さんに次回の目安を渡しましょう。手直しできます。</p>
        <div className="matane-stage">
          <div className={`matane-card${sent ? ' is-sent' : ''}`}>
            <MessageEditor ref={editor} label="またねカードの文面" value={text} onChange={setText} />
          </div>
          {sent && (
            <div className="sent-overlay sent-mark" role="status">
              <SentMark />
              <span>またね</span>
            </div>
          )}
        </div>
        {!sent && (
          <>
            <SendActions text={text} onSent={onSent} onCopyFailed={() => editor.current?.selectAll()} busy={busy} />
            <button type="button" className="btn btn-ghost btn-block" onClick={onDone}>
              送らない
            </button>
          </>
        )}
      </div>
    </Sheet>
  )
}
