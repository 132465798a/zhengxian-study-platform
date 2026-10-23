import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, dialog } from 'electron'
import { buildPrintDocument } from './document'
import { defaultPrintOptions, PAPER_SIZES } from '../../shared/print'
import type { PrintDocument, PrintOptions, PrintRequest } from '../../shared/print'
import { ValidationError } from '../errors'
import { runtimeConfig } from '../config'
import { recordPrint } from '../db/repositories/portfolio.repo'

interface PrintJob {
  token: string
  userId: number
  document: PrintDocument
  createdAt: number
  window: BrowserWindow | null
  ready: boolean
  preview: boolean
  pdf: Buffer | null
  recorded: boolean
  waiters: Array<() => void>
}

const jobs = new Map<string, PrintJob>()
const TTL = 10 * 60 * 1000
const READY_TIMEOUT = 20000

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function normalizeOptions(input: unknown): PrintOptions {
  const base = defaultPrintOptions()
  if (input === null || typeof input !== 'object') return base
  const raw = input as Record<string, unknown>
  const headerRaw =
    raw.header !== null && typeof raw.header === 'object'
      ? (raw.header as Record<string, unknown>)
      : {}
  const size = String(raw.size ?? 'A4')
  const parts = Array.isArray(raw.parts)
    ? (raw.parts as unknown[]).filter(
        (item): item is PrintOptions['parts'][number] =>
          item === 'student' || item === 'answer' || item === 'answerSheet'
      )
    : base.parts
  const answerLines =
    raw.answerLines === 'compact' || raw.answerLines === 'normal' || raw.answerLines === 'loose'
      ? raw.answerLines
      : base.answerLines
  return {
    ...base,
    size: (size in PAPER_SIZES ? size : 'A4') as PrintOptions['size'],
    orientation: raw.orientation === 'landscape' ? 'landscape' : 'portrait',
    columns: raw.columns === 2 ? 2 : 1,
    template:
      raw.template === 'homework' || raw.template === 'worksheet' || raw.template === 'copybook'
        ? raw.template
        : 'exam',
    fontScale: clamp(raw.fontScale, 0.8, 1.3, base.fontScale),
    parts: parts.length > 0 ? parts : base.parts,
    showScore: raw.showScore !== false,
    showDifficulty: raw.showDifficulty === true,
    judgeStyle: raw.judgeStyle === 'options' ? 'options' : 'bracket',
    scratch: raw.scratch === 'below' || raw.scratch === 'page' ? raw.scratch : 'none',
    blankScale: clamp(raw.blankScale, 0.7, 1.6, base.blankScale),
    answerLines,
    showSolution: raw.showSolution !== false,
    pageNumber: raw.pageNumber !== false,
    showScoreTable: raw.showScoreTable !== false,
    scoreTableReviewer: raw.scoreTableReviewer === true,
    oralColumns: clamp(raw.oralColumns, 2, 6, base.oralColumns),
    verticalColumns: clamp(raw.verticalColumns, 2, 6, base.verticalColumns),
    scoreScheme: raw.scoreScheme === 'standard' ? 'standard' : 'source',
    sectionScoreBox: raw.sectionScoreBox === true,
    sectionNaming:
      raw.sectionNaming === 'standard' || raw.sectionNaming === 'primary'
        ? raw.sectionNaming
        : 'auto',
    handwritingScore: [0, 3, 5, 10].includes(Number(raw.handwritingScore))
      ? Number(raw.handwritingScore)
      : 0,
    sealLine: raw.sealLine === true,
    graphPaper:
      raw.graphPaper === 'grid' || raw.graphPaper === 'dot' ? raw.graphPaper : 'none',
    graphPaperHeight: clamp(raw.graphPaperHeight, 30, 160, base.graphPaperHeight),
    bonusScore: [0, 5, 10, 20].includes(Number(raw.bonusScore)) ? Number(raw.bonusScore) : 0,
    essayColumns: raw.essayColumns === 15 ? 15 : 20,
    essayCellMm: clamp(raw.essayCellMm, 7, 12, base.essayCellMm),
    essayMark: raw.essayMark === true,
    answerStandard: raw.answerStandard === true,
    paperKind:
      raw.paperKind === 'unit' ||
      raw.paperKind === 'midterm' ||
      raw.paperKind === 'final' ||
      raw.paperKind === 'monthly' ||
      raw.paperKind === 'practice'
        ? raw.paperKind
        : 'custom',
    printRuler: raw.printRuler !== false,
    choiceColumns:
      raw.choiceColumns === 1 || raw.choiceColumns === 2 || raw.choiceColumns === 4
        ? raw.choiceColumns
        : 'auto',
    header: {
      school: typeof headerRaw.school === 'string' ? headerRaw.school : '',
      title: typeof headerRaw.title === 'string' ? headerRaw.title : '',
      duration:
        Number.isFinite(Number(headerRaw.duration)) && Number(headerRaw.duration) > 0
          ? Number(headerRaw.duration)
          : null,
      totalScore:
        Number.isFinite(Number(headerRaw.totalScore)) && Number(headerRaw.totalScore) > 0
          ? Number(headerRaw.totalScore)
          : null,
      infoLine: headerRaw.infoLine !== false,
      infoLayout: headerRaw.infoLayout === 'left' ? 'left' : 'top',
      notice: typeof headerRaw.notice === 'string' ? headerRaw.notice : ''
    }
  }
}

function normalizeRequest(payload: unknown): PrintRequest {
  if (payload === null || typeof payload !== 'object') throw new ValidationError('打印参数不合法')
  const raw = payload as Record<string, unknown>
  const userId = Number(raw.userId)
  if (!Number.isInteger(userId) || userId <= 0) throw new ValidationError('打印参数不合法')
  const source = raw.source
  if (source === null || typeof source !== 'object') throw new ValidationError('打印来源不合法')
  const kind = String((source as Record<string, unknown>).kind ?? '')
  const allowed = [
    'practice',
    'exam',
    'paper',
    'wrongbook',
    'bank',
    'custom',
    'manual',
    'hanzi',
    'english',
    'oral-card',
    'pinyin-word'
  ]
  if (!allowed.includes(kind)) throw new ValidationError('打印来源不合法')
  return {
    userId,
    source: source as PrintRequest['source'],
    options: normalizeOptions(raw.options)
  }
}

/** 手动组卷编辑器：只构建文档用于实时预览，不创建打印任务 */
export function buildDocument(payload: unknown): PrintDocument {
  return buildPrintDocument(normalizeRequest(payload))
}

function createJob(request: PrintRequest, preview = false): PrintJob {
  const document = buildPrintDocument(request)
  const job: PrintJob = {
    token: randomUUID(),
    userId: request.userId,
    document,
    createdAt: Date.now(),
    window: null,
    ready: false,
    preview,
    pdf: null,
    recorded: false,
    waiters: []
  }
  jobs.set(job.token, job)
  return job
}

function openWindow(job: PrintJob, visible: boolean): BrowserWindow {
  const win = new BrowserWindow({
    show: visible,
    width: 980,
    height: 1240,
    minWidth: 720,
    minHeight: 600,
    frame: false,
    title: '打印预览',
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  })
  win.setMenuBarVisibility(false)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  const hash = `/print?token=${job.token}${visible ? '&preview=1' : ''}`
  const devUrl = runtimeConfig.rendererUrl
  if (devUrl) {
    void win.loadURL(`${devUrl}#${hash}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }

  win.on('closed', () => {
    job.window = null
  })
  job.window = win

  return win
}

function waitReady(job: PrintJob): Promise<void> {
  if (job.ready) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('打印页面渲染超时'))
    }, READY_TIMEOUT)
    job.waiters.push(() => {
      clearTimeout(timer)
      resolve()
    })
  })
}

/** 批量导出多套平行卷到同一文件夹 */
export async function saveBatch(
  payload: unknown
): Promise<{ canceled: boolean; dir?: string; count?: number }> {
  if (payload === null || typeof payload !== 'object') throw new ValidationError('打印参数不合法')
  const raw = payload as Record<string, unknown>
  const userId = Number(raw.userId)
  const requests = Array.isArray(raw.requests) ? raw.requests : []
  if (!Number.isInteger(userId) || userId <= 0 || requests.length === 0) {
    throw new ValidationError('打印参数不合法')
  }
  const result = await dialog.showOpenDialog({
    title: '选择保存文件夹',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || !result.filePaths[0]) return { canceled: true }
  const dir = result.filePaths[0]
  let count = 0
  for (let index = 0; index < requests.length; index += 1) {
    const item = requests[index] as Record<string, unknown>
    const request = normalizeRequest({ userId, source: item.source, options: item.options })
    const job = createJob(request)
    try {
      const pdf = await renderPdf(job, true)
      const file = join(
        dir,
        defaultFileName(job.document).replace(/\.pdf$/, `_第${index + 1}套.pdf`)
      )
      writeFileSync(file, pdf)
      count += 1
    } finally {
      jobs.delete(job.token)
    }
  }
  return { canceled: false, dir, count }
}

export function markReady(token: string): void {
  const job = jobs.get(token)
  if (!job) return
  job.ready = true
  const waiters = job.waiters.splice(0)
  waiters.forEach((resolve) => resolve())
}

export function getPayload(token: string): PrintDocument {
  const job = jobs.get(token)
  if (!job) throw new ValidationError('打印任务已过期，请重新导出')
  return job.document
}

function pdfOptions(job: PrintJob): Electron.PrintToPDFOptions {
  const document = job.document
  const pageNumber = document.options.pageNumber
  return {
    pageSize: 'A4',
    landscape: document.options.orientation === 'landscape',
    printBackground: true,
    preferCSSPageSize: true,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    scale: 1,
    displayHeaderFooter: pageNumber,
    headerTemplate: '<span></span>',
    footerTemplate: pageNumber
      ? '<div style="width:100%;text-align:center;font-size:9px;color:#333;font-family:\'Microsoft YaHei\',sans-serif;">第 <span class="pageNumber"></span> 页 共 <span class="totalPages"></span> 页</div>'
      : '<span></span>'
  }
}

async function renderPdf(job: PrintJob, destroy: boolean): Promise<Buffer> {
  const win = job.window ?? openWindow(job, false)
  try {
    await waitReady(job)
    return await win.webContents.printToPDF(pdfOptions(job))
  } finally {
    if (destroy && job.window === win) {
      job.window = null
      if (!win.isDestroyed()) win.destroy()
    }
  }
}

function defaultFileName(document: PrintDocument): string {
  const stamp = new Date().toISOString().slice(0, 10)
  const safe = `${document.meta.grade}年级${document.meta.subject}_${document.title}_${stamp}`
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 80)
  return `${safe}.pdf`
}

function pdfPageCount(pdf: Buffer): number {
  const text = pdf.toString('latin1')
  const matches = text.match(/\/Type\s*\/Page[^s]/g)
  return matches ? matches.length : 0
}

/** 保存或打印成功后写入试卷作品集，失败不影响主流程 */
function recordJob(job: PrintJob, pdf: Buffer | null): void {
  if (job.recorded) return
  job.recorded = true
  try {
    recordPrint({
      userId: job.userId,
      title: job.document.title,
      subjectName: job.document.meta.subject,
      grade: job.document.meta.grade,
      questionCount: job.document.meta.questionCount,
      pages: pdf ? pdfPageCount(pdf) : 0
    })
  } catch (error) {
    console.error('[print] 记录试卷作品集失败：', error)
  }
}

/** 保存 PDF；PRINT_TEST_OUTPUT 指向目录时跳过系统对话框，便于端到端测试 */
async function savePdfFile(
  job: PrintJob,
  pdf: Buffer
): Promise<{ canceled: boolean; path?: string }> {
  const testDir = runtimeConfig.printTestOutput
  if (testDir) {
    mkdirSync(testDir, { recursive: true })
    const file = join(testDir, defaultFileName(job.document))
    writeFileSync(file, pdf)
    recordJob(job, pdf)
    return { canceled: false, path: file }
  }
  const result = await dialog.showSaveDialog({
    title: '保存 PDF',
    defaultPath: join(app.getPath('downloads'), defaultFileName(job.document)),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  writeFileSync(result.filePath, pdf)
  recordJob(job, pdf)
  return { canceled: false, path: result.filePath }
}

export async function saveRequest(payload: unknown): Promise<{ canceled: boolean; path?: string }> {
  const request = normalizeRequest(payload)
  const job = createJob(request)
  try {
    const pdf = await renderPdf(job, true)
    return await savePdfFile(job, pdf)
  } finally {
    jobs.delete(job.token)
  }
}

export async function previewRequest(payload: unknown): Promise<{ token: string }> {
  const request = normalizeRequest(payload)
  const job = createJob(request, true)
  openWindow(job, true)
  return { token: job.token }
}

export async function saveJob(token: string): Promise<{ canceled: boolean; path?: string }> {
  const job = jobs.get(token)
  if (!job) throw new ValidationError('打印任务已过期，请重新导出')
  const pdf = job.pdf ?? (await renderPdf(job, false))
  job.pdf = pdf
  return savePdfFile(job, pdf)
}

/** 预览页请求真实 PDF，用于在界面中显示分页边界 */
export async function previewPdf(token: string): Promise<{ pdf: string }> {
  const job = jobs.get(token)
  if (!job) throw new ValidationError('打印任务已过期，请重新预览')
  if (!job.pdf) job.pdf = await renderPdf(job, false)
  return { pdf: job.pdf.toString('base64') }
}

function systemPageSize(document: PrintDocument): { width: number; height: number } {
  const size = PAPER_SIZES[document.options.size] ?? PAPER_SIZES.A4
  const landscape = document.options.orientation === 'landscape'
  return {
    width: Math.round((landscape ? size.height : size.width) * 1000),
    height: Math.round((landscape ? size.width : size.height) * 1000)
  }
}

export async function printRequest(payload: unknown): Promise<{ ok: boolean }> {
  const request = normalizeRequest(payload)
  const job = createJob(request)
  try {
    const win = job.window ?? openWindow(job, false)
    await waitReady(job)
    const ok = await new Promise<boolean>((resolve) => {
      win.webContents.print(
        {
          silent: false,
          printBackground: true,
          pageSize: systemPageSize(job.document),
          margins: { marginType: 'default' }
        },
        (success) => resolve(success)
      )
    })
    if (ok) recordJob(job, null)
    return { ok }
  } finally {
    if (job.window && !job.window.isDestroyed()) job.window.destroy()
    jobs.delete(job.token)
  }
}

/** 定期清理过期任务，避免窗口与 PDF 缓存长时间占用内存 */
export function startPrintJanitor(): void {
  setInterval(() => {
    const now = Date.now()
    for (const [token, job] of jobs) {
      if (now - job.createdAt < TTL) continue
      if (job.preview && job.window) continue
      if (job.window && !job.window.isDestroyed()) job.window.destroy()
      jobs.delete(token)
    }
  }, 60_000)
}

