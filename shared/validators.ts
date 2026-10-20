import { z } from 'zod'

// 统一中文错误提示，避免 zod 默认英文直接透传到界面
z.config(z.locales.zhCN())

export const questionTypeSchema = z.enum([
  'single',
  'multiple',
  'judge',
  'fill',
  'short_answer',
  'cloze',
  'matching',
  'sorting',
  'calculation',
  'pinyin_word'
])

export const stageSchema = z.enum(['primary', 'junior', 'senior'])

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, '请填写姓名').max(20, '姓名不能超过 20 个字'),
  grade: z.number().int().min(1).max(12),
  stage: stageSchema.optional(),
  pin: z
    .string()
    .regex(/^\d{4,6}$/, 'PIN 码应为 4-6 位数字')
    .nullable()
    .optional(),
  role: z.enum(['student', 'parent', 'teacher']).optional()
})

export const userUpdateSchema = z.object({
  id: z.number().int().positive(),
  patch: z.object({
    name: z.string().trim().min(1).max(20).optional(),
    grade: z.number().int().min(1).max(12).optional(),
    stage: stageSchema.optional(),
    pin: z
      .string()
      .regex(/^\d{4,6}$/, 'PIN 码应为 4-6 位数字')
      .nullable()
      .optional(),
    avatar: z.string().nullable().optional()
  })
})

export const verifyPinSchema = z.object({
  id: z.number().int().positive(),
  pin: z.string().max(10)
})

export const practiceConfigSchema = z.object({
  userId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  grade: z.number().int().min(1).max(12),
  types: z.array(questionTypeSchema).min(1, '至少选择一种题型'),
  difficulties: z.array(z.number().int().min(1).max(3)),
  count: z.number().int().min(1).max(100),
  knowledgeIds: z.array(z.number().int().positive()).optional(),
  mode: z.enum(['random', 'wrong', 'knowledge']),
  custom: z
    .object({
      type: questionTypeSchema,
      params: z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean()])
      )
    })
    .optional()
})

export const practiceDoingSchema = z.object({
  userId: z.number().int().positive(),
  limit: z.number().int().min(1).max(50).optional()
})

export const practiceDiscardDoingSchema = z.object({
  userId: z.number().int().positive()
})

export const answerSchema = z.object({
  userId: z.number().int().positive(),
  recordId: z.number().int().positive(),
  questionId: z.number().int().positive(),
  answer: z.unknown()
})

export const finishSchema = z.object({
  userId: z.number().int().positive(),
  recordId: z.number().int().positive(),
  durationSec: z.number().min(0).max(60 * 60 * 12)
})

export const gradeSchema = z.object({
  userId: z.number().int().positive(),
  answerRecordId: z.number().int().positive(),
  isCorrect: z.boolean()
})

export const examStartSchema = z.object({
  userId: z.number().int().positive(),
  paperId: z.number().int().positive()
})

export const questionFilterSchema = z.object({
  subjectId: z.number().int().positive().optional(),
  grade: z.number().int().min(1).max(12).optional(),
  stage: stageSchema.optional(),
  types: z.array(questionTypeSchema).optional(),
  difficulties: z.array(z.number().int().min(1).max(3)).optional(),
  knowledgeIds: z.array(z.number().int().positive()).optional(),
  keyword: z.string().max(100).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional()
})

export const questionInputSchema = z.object({
  subjectId: z.number().int().positive(),
  grade: z.number().int().min(1).max(12),
  knowledgeId: z.number().int().positive().nullable().optional(),
  type: questionTypeSchema,
  difficulty: z.number().int().min(1).max(3),
  stem: z.string().trim().min(1, '题干不能为空'),
  options: z.unknown().optional(),
  answer: z.unknown(),
  solution: z.string().nullable().optional(),
  score: z.number().min(0).max(100).optional(),
  source: z.string().nullable().optional()
})

export const wrongFilterSchema = z.object({
  userId: z.number().int().positive(),
  subjectId: z.number().int().positive().optional(),
  grade: z.number().int().min(1).max(12).optional(),
  mastered: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional()
})

export const importPreviewSchema = z.object({
  raw: z.string().min(1, '文件内容为空'),
  fileName: z.string().min(1)
})

export const importCommitSchema = z.object({
  raw: z.string().min(1, '文件内容为空'),
  fileName: z.string().min(1)
})

const printPartSchema = z.enum(['student', 'answer', 'answerSheet'])
const paperSizeSchema = z.enum(['A4', 'A3', 'B4', '8K', '16K', 'B5'])
const paperKindSchema = z.enum(['custom', 'unit', 'midterm', 'final', 'monthly', 'practice'])

export const printSourceQuestionSchema = z.object({
  id: z.number().int(),
  subjectId: z.number().int().positive(),
  subjectName: z.string().max(20),
  grade: z.number().int().min(1).max(6),
  type: questionTypeSchema,
  stem: z.string().min(1).max(5000),
  options: z.unknown().optional(),
  answer: z.unknown(),
  solution: z.string().max(5000).nullable().optional(),
  score: z.number().min(0).max(100),
  difficulty: z.number().int().min(1).max(3),
  knowledgeName: z.string().max(50).nullable().optional(),
  source: z.string().max(100).nullable().optional()
})

const printOptionsSchema = z
  .object({
    size: paperSizeSchema.optional(),
    orientation: z.enum(['portrait', 'landscape']).optional(),
    columns: z.union([z.literal(1), z.literal(2)]).optional(),
    template: z.enum(['exam', 'homework', 'worksheet', 'copybook']).optional(),
    fontScale: z.number().min(0.8).max(1.3).optional(),
    parts: z.array(printPartSchema).min(1).optional(),
    showScore: z.boolean().optional(),
    showDifficulty: z.boolean().optional(),
    judgeStyle: z.enum(['bracket', 'options']).optional(),
    scratch: z.enum(['none', 'below', 'page']).optional(),
    blankScale: z.number().min(0.7).max(1.6).optional(),
    answerLines: z.enum(['compact', 'normal', 'loose']).optional(),
    showSolution: z.boolean().optional(),
    pageNumber: z.boolean().optional(),
    showScoreTable: z.boolean().optional(),
    scoreTableReviewer: z.boolean().optional(),
    oralColumns: z.number().int().min(2).max(6).optional(),
    verticalColumns: z.number().int().min(2).max(6).optional(),
    scoreScheme: z.enum(['source', 'standard']).optional(),
    sectionScoreBox: z.boolean().optional(),
    sectionNaming: z.enum(['auto', 'standard', 'primary']).optional(),
    handwritingScore: z.number().int().min(0).max(10).optional(),
    sealLine: z.boolean().optional(),
    graphPaper: z.enum(['none', 'grid', 'dot']).optional(),
    graphPaperHeight: z.number().min(30).max(160).optional(),
    bonusScore: z.number().int().min(0).max(20).optional(),
    essayColumns: z.union([z.literal(15), z.literal(20)]).optional(),
    essayCellMm: z.number().min(7).max(12).optional(),
    essayMark: z.boolean().optional(),
    answerStandard: z.boolean().optional(),
    paperKind: paperKindSchema.optional(),
    printRuler: z.boolean().optional(),
    choiceColumns: z.union([z.literal('auto'), z.literal(1), z.literal(2), z.literal(4)]).optional(),
    header: z
      .object({
        school: z.string().max(60).optional(),
        title: z.string().max(120).optional(),
        duration: z.number().int().min(0).max(300).nullable().optional(),
        totalScore: z.number().int().min(0).max(300).nullable().optional(),
        infoLine: z.boolean().optional(),
        infoLayout: z.enum(['top', 'left']).optional(),
        notice: z.string().max(2000).optional()
      })
      .loose()
      .optional()
  })
  .loose()

const printSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('practice'), recordId: z.number().int().positive() }),
  z.object({ kind: z.literal('exam'), recordId: z.number().int().positive() }),
  z.object({ kind: z.literal('paper'), paperId: z.number().int().positive() }),
  z
    .object({
      kind: z.literal('wrongbook'),
      subjectId: z.number().int().positive().optional(),
      grade: z.number().int().min(1).max(6).optional(),
      mastered: z.boolean().optional()
    })
    .loose(),
  z.object({ kind: z.literal('bank'), filter: questionFilterSchema, limit: z.number().int().min(1).max(500) }),
  z.object({
    kind: z.literal('manual'),
    subjectId: z.number().int().positive(),
    grade: z.number().int().min(1).max(6),
    questions: z.array(printSourceQuestionSchema).max(300)
  }),
  z.object({
    kind: z.literal('custom'),
    subjectId: z.number().int().positive(),
    grade: z.number().int().min(1).max(6),
    types: z.array(questionTypeSchema).min(1, '至少选择一种题型').max(12),
    params: z.record(z.string(), z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))).optional(),
    count: z.number().int().min(1, '题量至少 1 题').max(200, '题量最多 200 题'),
    knowledgeIds: z.array(z.number().int().positive()).optional(),
    difficulties: z.array(z.number().int().min(1).max(3)).optional()
  }),
  z.object({
    kind: z.literal('hanzi'),
    grade: z.number().int().min(1).max(6),
    grid: z.enum(['tian', 'mi', 'huigong', 'pinyin-tian']),
    limit: z.number().int().min(1).max(100),
    charsPerRow: z.number().int().min(1).max(20).optional(),
    cellsPerChar: z.number().int().min(1).max(6).optional()
  }),
  z.object({
    kind: z.literal('english'),
    grade: z.number().int().min(1).max(6),
    mode: z.enum(['word', 'sentence', 'dictation']),
    limit: z.number().int().min(1).max(100)
  }),
  z.object({
    kind: z.literal('oral-card'),
    grade: z.number().int().min(1).max(6),
    count: z.number().int().min(1).max(100),
    maxValue: z.number().int().min(1).max(100),
    operations: z.enum(['add', 'sub', 'mul', 'div', 'mixed', 'all'])
  }),
  z.object({
    kind: z.literal('pinyin-word'),
    grade: z.number().int().min(1).max(6),
    count: z.number().int().min(1).max(60)
  })
])

export const printRequestSchema = z.object({
  userId: z.number().int().positive(),
  source: printSourceSchema,
  options: printOptionsSchema
})

export const printGenerateSchema = z.object({
  subjectId: z.number().int().positive(),
  grade: z.number().int().min(1).max(6),
  types: z.array(questionTypeSchema).min(1, '至少选择一种题型').max(12),
  params: z.record(z.string(), z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))).optional(),
  count: z.number().int().min(1, '题量至少 1 题').max(200, '题量最多 200 题'),
  knowledgeIds: z.array(z.number().int().positive()).optional(),
  difficulties: z.array(z.number().int().min(1).max(3)).optional()
})

export const printTokenSchema = z.object({
  token: z.string().min(1, '打印任务无效')
})

export const printTemplateIdSchema = z.object({
  userId: z.number().int().positive(),
  id: z.number().int().positive()
})

export const printTemplateSaveSchema = z.object({
  userId: z.number().int().positive(),
  name: z.string().trim().min(1, '请填写模板名称').max(60, '模板名称不能超过 60 个字'),
  subjectId: z.number().int().positive(),
  grade: z.number().int().min(1).max(6),
  payload: z.string().min(1, '模板内容为空').max(512 * 1024, '模板内容过大，请减少题目数量')
})

export const printTemplateListSchema = z.object({
  userId: z.number().int().positive()
})

export const printBatchSchema = z.object({
  userId: z.number().int().positive(),
  requests: z
    .array(
      z.object({
        source: printSourceSchema,
        options: printOptionsSchema
      })
    )
    .min(1)
    .max(50)
})
