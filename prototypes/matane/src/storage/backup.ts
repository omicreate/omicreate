/**
 * 保存層の上の手順: 初期化、起動時の掃除、BackupPayload の書き出し、バックアップから戻す・戻す前に戻す、
 * サンプルの投入と削除。
 */
import {
  buildBackupPayload,
  createDefaultCounters,
  createDefaultMenus,
  createDefaultSettings,
  createDefaultTemplates,
  NOTICE_VERSION,
  todayLocal,
  type BackupPayload,
  type ISODate,
  type ISODateTime,
  type Settings,
} from '../domain'
import { buildDemoData } from '../data/demo'
import { PROD_DB, SAMPLE_DB, setActiveDbName } from './activeDb'
import { deleteDatabase, type AppData, type PurgeResult, type Repository } from './repository'

/**
 * 起動時の準備: 残った削除印つきのデータを完全に消し、メニュー・文面・カウンタがなければ初期値を入れる。
 * 設定（Settings）は S0 の［読みました］で作るので、ここでは作らない。
 */
export async function prepareOnStartup(
  repo: Repository,
  input: { today: ISODate; now: ISODateTime },
): Promise<{ data: AppData; purged: PurgeResult }> {
  const purged = await repo.purgeDeleted(input.today)
  let data = await repo.loadAll()
  if (data.menus.length === 0) await repo.putMenus(createDefaultMenus())
  if (data.templates.length === 0) await repo.putTemplates(createDefaultTemplates(input.now))
  if (!data.counters) await repo.putCounters(createDefaultCounters(input.today))
  if (data.menus.length === 0 || data.templates.length === 0 || !data.counters) data = await repo.loadAll()
  return { data, purged }
}

/** S0 の［読みました］: 確認した日時と文面の版を残した設定を作る（すでにあれば notice だけ更新） */
export async function acknowledgeNotice(repo: Repository, now: ISODateTime): Promise<Settings> {
  const cur = await repo.getSettings()
  const notice = { version: NOTICE_VERSION, ackedAt: now }
  const next: Settings = cur ? { ...cur, notice } : createDefaultSettings(notice)
  await repo.putSettings(next)
  return next
}

/** 今のデータの BackupPayload（削除印つきと PIN は含めない） */
export async function exportPayload(repo: Repository, today: ISODate = todayLocal()): Promise<BackupPayload> {
  const data = await repo.loadAll()
  return buildBackupPayload({
    customers: data.customers,
    visits: data.visits,
    menus: data.menus,
    contacts: data.contacts,
    templates: data.templates,
    settings: data.settings ?? createDefaultSettings({ version: NOTICE_VERSION, ackedAt: '' }),
    counters: data.counters ?? createDefaultCounters(today),
  })
}

/**
 * バックアップから戻す（7.4）: 今の状態を RestorePoint に1回分残してから置き換える。PIN は端末のものを残す。
 */
export async function restoreFromPayload(repo: Repository, payload: BackupPayload, now: ISODateTime): Promise<void> {
  const current = await exportPayload(repo)
  const lock = (await repo.getSettings())?.lock
  await repo.putRestorePoint({ createdAt: now, payload: current })
  await repo.replaceAll(payload, { keepLock: lock })
}

/** ［戻す前の状態に戻す］（直前の1回分だけ）。戻せたら true */
export async function undoRestore(repo: Repository): Promise<boolean> {
  const rp = await repo.getRestorePoint()
  if (!rp) return false
  const lock = (await repo.getSettings())?.lock
  await repo.replaceAll(rp.payload, { keepLock: lock })
  // 戻す前に設定がなかった（S0 の前だった）ときは、設定のない状態に戻す
  if (!rp.payload.settings.notice?.ackedAt && !lock) await repo.deleteSettings()
  await repo.clearRestorePoint()
  return true
}

/** バックアップを書き出した日時を残す */
export async function markBackedUp(repo: Repository, now: ISODateTime): Promise<void> {
  await repo.updateSettings((s) => ({ ...s, lastBackupAt: now }))
}

/** サンプル用データベースにサンプルを入れる（repo は 'matane-sample' を開いたもの） */
export async function loadSampleData(repo: Repository, today: ISODate, now: ISODateTime): Promise<void> {
  if (repo.dbName !== SAMPLE_DB) throw new Error('サンプルはサンプル用データベースにだけ入れます')
  await repo.replaceAll(buildDemoData(today, now))
}

/**
 * ［サンプルを消して自分のお客様で始める］: サンプル用データベースを丸ごと消し、本番用に切り替える。
 * 開いているサンプルの Repository は先に閉じる。
 */
export async function discardSample(sampleRepo: Repository | null, factory?: IDBFactory | null): Promise<void> {
  sampleRepo?.close()
  await deleteDatabase(SAMPLE_DB, factory)
  setActiveDbName(PROD_DB)
}

/**
 * ［すべて消す］・［PINを忘れた］: 開いているデータベースを丸ごと消す（メモリ保存なら空にする）。
 */
export async function wipeDatabase(repo: Repository, factory?: IDBFactory | null): Promise<void> {
  if (!repo.persistent) {
    await repo.clearAll()
    return
  }
  repo.close()
  await deleteDatabase(repo.dbName, factory)
}
