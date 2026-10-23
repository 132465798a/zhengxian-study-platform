export const play = {
  hub: {
    title: '玩法中心',
    desc: '把每天的学习变成可以坚持的小游戏',
    goal: '目标设定',
    goalDesc: '给自己定一个本周小目标',
    levels: '闯关地图',
    levelsDesc: '按知识点一关一关往上打',
    challenge: '限时挑战',
    challengeDesc: '60 秒内能答对几道题',
    family: '家庭挑战赛',
    familyDesc: '同一份卷子，全家比排名',
    portfolio: '试卷作品集',
    portfolioDesc: '回看自己出过的卷子',
    relay: '接力答题',
    relayDesc: '两个人轮流答，一人一题'
  },
  quizRunner: {
    answered: (count: number): string => `已答 ${count} 题`
  }
}
