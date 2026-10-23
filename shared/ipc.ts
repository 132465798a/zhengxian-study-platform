export const IPC = {
  userList: 'user:list',
  userCreate: 'user:create',
  userUpdate: 'user:update',
  userDelete: 'user:delete',
  userVerifyPin: 'user:verify-pin',

  subjectList: 'subject:list',
  knowledgeTree: 'knowledge:tree',

  questionPage: 'question:page',
  questionCreate: 'question:create',
  questionUpdate: 'question:update',
  questionDelete: 'question:delete',
  questionTypeStats: 'question:type-stats',

  practiceCreate: 'practice:create',
  practiceGet: 'practice:get',
  practiceList: 'practice:list',
  practiceDoing: 'practice:doing',
  practiceDiscardDoing: 'practice:discard-doing',
  practiceAnswer: 'practice:answer',
  practiceFinish: 'practice:finish',
  practiceGrade: 'practice:grade',
  practiceResult: 'practice:result',

  examTemplates: 'exam:templates',
  examStart: 'exam:start',
  examGet: 'exam:get',
  examAnswer: 'exam:answer',
  examSubmit: 'exam:submit',
  examRecords: 'exam:records',
  examResult: 'exam:result',

  wrongPage: 'wrong:page',
  wrongMaster: 'wrong:master',
  wrongRemove: 'wrong:remove',
  wrongSummary: 'wrong:summary',

  characterList: 'character:list',
  characterDetail: 'character:detail',
  characterStrokeData: 'character:stroke-data',
  characterExplain: 'character:explain',

  ttsSynthesize: 'tts:synthesize',

  englishWords: 'english:words',

  asrStatus: 'asr:status',
  asrTranscribe: 'asr:transcribe',

  printSave: 'print:save',
  printPreview: 'print:preview',
  printPreviewPdf: 'print:preview-pdf',
  printPayload: 'print:payload',
  printReady: 'print:ready',
  printSaveJob: 'print:save-job',
  printPrint: 'print:print',
  printBuild: 'print:build',
  printGenerate: 'print:generate',
  printTemplateList: 'print-template:list',
  printTemplateGet: 'print-template:get',
  printTemplateSave: 'print-template:save',
  printTemplateDelete: 'print-template:delete',
  printBatch: 'print:batch',

  statsOverview: 'stats:overview',
  statsSubjects: 'stats:subjects',
  statsTrend: 'stats:trend',

  incentiveOverview: 'incentive:overview',
  incentiveAchievements: 'incentive:achievements',
  incentiveDailyGet: 'incentive:daily-get',
  incentiveDailyAnswer: 'incentive:daily-answer',
  incentiveCalendar: 'incentive:calendar',
  incentiveGrowth: 'incentive:growth',

  goalGet: 'goal:get',
  goalSet: 'goal:set',

  levelList: 'level:list',
  levelStart: 'level:start',
  levelSubmit: 'level:submit',

  challengeStart: 'challenge:start',
  challengeSubmit: 'challenge:submit',

  familyList: 'family:list',
  familyCreate: 'family:create',
  familyGet: 'family:get',
  familySubmit: 'family:submit',

  portfolioList: 'portfolio:list',
  portfolioRemove: 'portfolio:remove',

  relayCreate: 'relay:create',
  relayGet: 'relay:get',
  relayAnswer: 'relay:answer',
  relayVoid: 'relay:void',
  relayHistory: 'relay:history',

  importPreview: 'import:preview',
  importCommit: 'import:commit'
} as const

export const IPC_CHANNELS = Object.values(IPC) as string[]
