import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from '@shared/constants'

export const common = {
  appName: '正贤学习平台',
  appSubtitle: '小学 · 语文 数学 英语',
  brandMark: '正',
  actions: {
    save: '保存',
    cancel: '取消',
    confirm: '确定',
    delete: '删除',
    edit: '编辑',
    back: '返回',
    retry: '重试',
    start: '开始',
    submit: '提交',
    close: '关闭',
    import: '导入',
    search: '搜索',
    reset: '重置',
    add: '新增',
    print: '打印',
    exportPdf: '导出 PDF'
  },
  status: {
    loading: '加载中…',
    empty: '暂无数据',
    error: '操作失败',
    success: '操作成功',
    saving: '保存中…'
  },
  speech: {
    engine: '朗读引擎',
    system: '系统语音',
    edge: 'Edge 语音'
  },
  units: {
    question: '题',
    minute: '分钟',
    second: '秒',
    score: '分',
    times: '次',
    day: '天'
  },
  difficulty: DIFFICULTY_LABELS,
  questionTypes: QUESTION_TYPE_LABELS,
  generated: '生成题',
  empty: {
    title: '这里还没有内容',
    hint: '完成一次练习后，数据会自动出现在这里。'
  },
  confirmDelete: '删除后不可恢复，确定继续吗？',
  formatDuration: (seconds: number): string => {
    const total = Math.max(0, Math.round(seconds))
    if (total < 60) return `${total} 秒`
    const minutes = Math.floor(total / 60)
    const rest = total % 60
    return rest === 0 ? `${minutes} 分钟` : `${minutes} 分 ${rest} 秒`
  },
  formatDateTime: (value: string | null): string => (value ? value.slice(0, 16) : '—'),
  gradeText: (grade: number): string => `${grade} 年级`,
  typeCountText: (count: number): string => `${count} 种`,
  correctCountText: (count: number): string => `${count} 题答对`,
  availableText: '可抽取',
  studentFallback: '同学',
  formatDate: (date: Date): string => {
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${weekday}`
  }
}
