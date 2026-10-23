export const incentive = {
  entry: '成长激励',
  entryHint: '成长值、每日一题与成就',
  growth: '成长值',
  level: '等级',
  streak: '连续学习',
  weekGrowth: '本周成长',
  todayAnswered: '今日答题',
  todayAccuracy: '今日正确率',
  nextLevel: (value: number) => `距下一级还差 ${value}`,
  maxLevel: '已达最高等级',
  points: '分',
  days: '天',

  comboTitle: '连击',
  comboHint: '连续答对得分翻倍',

  dailyTitle: '每日一题',
  dailyDesc: '每天一道，答对 +5 成长值',
  dailyStart: '开始作答',
  dailyDone: '今天已完成',
  dailySubmit: '提交答案',
  dailyCorrect: '答对了，成长值 +5',
  dailyWrong: '答错了，看看解析',
  dailyAnswered: '本题已作答',
  dailyAnswer: '正确答案',
  dailySolution: '解析',
  dailyEmpty: '题库里还没有适合这个年级的题目',

  achievementsTitle: '成就',
  achievementsDesc: '达成条件自动解锁',
  achievementsUnlocked: '已解锁',
  achievementsLocked: '未解锁',
  achievementsProgress: '已解锁 {done} / {total}',

  calendarTitle: '学习日历',
  calendarDesc: '颜色越深，当天答题越多',
  calendarEmpty: '这个月还没有学习记录',
  calendarDay: (answered: number, correct: number) => `答题 ${answered} 道，答对 ${correct} 道`,

  growthTitle: '成长曲线',
  growthDesc: '最近 14 天的成长值增量',
  growthEmpty: '还没有成长值记录',

  practiceCombo: (streak: number, multiplier: number) => `连击 ${streak} ×${multiplier}`
}
