export const portfolio = {
  title: '试卷作品集',
  desc: '这里保存每次保存 PDF / 打印的卷子记录',
  eyebrow: '我的作品',
  loading: '正在读取作品记录…',
  errorTitle: '暂时读不出作品记录',
  retry: '重试',
  emptyTitle: '还没有卷子',
  emptyHint: '去「线下学习」生成并导出一份卷子，保存或打印后会自动收进这里。',
  emptyAction: '去线下学习',

  columnTitle: '标题',
  columnSubject: '学科',
  columnGrade: '年级',
  columnQuestionCount: '题量',
  columnPages: '页数',
  columnCreatedAt: '创建时间',
  columnActions: '操作',

  questionCount: (count: number): string => `${count} 题`,
  pageCount: (count: number): string => `${count} 页`,
  gradeText: (grade: number): string => `${grade} 年级`,
  unknown: '—',

  delete: '删除',
  confirmDelete: '确认删除',
  deleteFailed: '删除失败，请重试',

  pageInfo: (page: number, total: number): string => `第 ${page} 页 / 共 ${total} 条`,
  prevPage: '上一页',
  nextPage: '下一页'
}
