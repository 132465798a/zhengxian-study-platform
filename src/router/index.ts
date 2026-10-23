import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { t } from '@/i18n'
import { useAuthStore } from '@/stores/auth.store'
import AppLayout from '@/components/layout/AppLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'gate',
    component: () => import('@/views/auth/UserGateView.vue'),
    meta: { public: true, title: t.auth.title }
  },
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: 'home',
        name: 'home',
        component: () => import('@/views/home/HomeView.vue'),
        meta: { title: t.nav.home, subtitle: t.nav.homeDesc }
      },
      {
        path: 'character',
        name: 'character-learn',
        component: () => import('@/views/character/CharacterLearnView.vue'),
        meta: { title: t.character.title, subtitle: t.character.desc }
      },
      {
        path: 'english/listening',
        name: 'english-listening',
        component: () => import('@/views/english/EnglishListeningView.vue'),
        meta: { title: t.english.title, subtitle: t.english.desc }
      },
      {
        path: 'offline',
        name: 'offline-learning',
        component: () => import('@/views/offline/OfflineLearningView.vue'),
        meta: { title: t.nav.offline, subtitle: t.nav.offlineDesc }
      },
      {
        path: 'practice/setup',
        name: 'practice-setup',
        component: () => import('@/views/practice/PracticeSetupView.vue'),
        meta: { title: t.practice.title, subtitle: t.nav.practiceDesc }
      },
      {
        path: 'practice/:recordId',
        name: 'practice-do',
        component: () => import('@/views/practice/PracticeDoView.vue'),
        meta: { title: t.practice.doTitle, subtitle: t.nav.practiceDesc }
      },
      {
        path: 'practice/:recordId/result',
        name: 'practice-result',
        component: () => import('@/views/practice/PracticeResultView.vue'),
        meta: { title: t.practice.resultTitle, subtitle: t.nav.practiceDesc }
      },
      {
        path: 'exam',
        name: 'exam-list',
        component: () => import('@/views/exam/ExamListView.vue'),
        meta: { title: t.exam.title, subtitle: t.nav.examDesc }
      },
      {
        path: 'exam/:recordId',
        name: 'exam-do',
        component: () => import('@/views/exam/ExamDoView.vue'),
        meta: { title: t.exam.doTitle, subtitle: t.nav.examDesc }
      },
      {
        path: 'exam/:recordId/result',
        name: 'exam-result',
        component: () => import('@/views/exam/ExamResultView.vue'),
        meta: { title: t.exam.resultTitle, subtitle: t.nav.examDesc }
      },
      {
        path: 'wrongbook',
        name: 'wrongbook',
        component: () => import('@/views/wrongbook/WrongBookView.vue'),
        meta: { title: t.wrongbook.title, subtitle: t.nav.wrongbookDesc }
      },
      {
        path: 'stats',
        name: 'stats',
        component: () => import('@/views/stats/StatsView.vue'),
        meta: { title: t.stats.title, subtitle: t.nav.statsDesc }
      },
      {
        path: 'incentive/daily',
        name: 'incentive-daily',
        component: () => import('@/views/incentive/DailyChallengeView.vue'),
        meta: { title: t.incentive.dailyTitle, subtitle: t.incentive.dailyDesc }
      },
      {
        path: 'incentive/achievements',
        name: 'incentive-achievements',
        component: () => import('@/views/incentive/AchievementsView.vue'),
        meta: { title: t.incentive.achievementsTitle, subtitle: t.incentive.achievementsDesc }
      },
      {
        path: 'play',
        name: 'play',
        component: () => import('@/views/play/PlaygroundView.vue'),
        meta: { title: t.nav.play, subtitle: t.nav.playDesc }
      },
      {
        path: 'play/goal',
        name: 'play-goal',
        component: () => import('@/views/play/GoalView.vue'),
        meta: { title: t.goal.title, subtitle: t.goal.desc }
      },
      {
        path: 'play/levels',
        name: 'play-levels',
        component: () => import('@/views/play/LevelsView.vue'),
        meta: { title: t.levels.title, subtitle: t.levels.desc }
      },
      {
        path: 'play/challenge',
        name: 'play-challenge',
        component: () => import('@/views/play/ChallengeView.vue'),
        meta: { title: t.challenge.title, subtitle: t.challenge.desc }
      },
      {
        path: 'play/family',
        name: 'play-family',
        component: () => import('@/views/play/FamilyView.vue'),
        meta: { title: t.family.title, subtitle: t.family.desc }
      },
      {
        path: 'play/portfolio',
        name: 'play-portfolio',
        component: () => import('@/views/play/PortfolioView.vue'),
        meta: { title: t.portfolio.title, subtitle: t.portfolio.desc }
      },
      {
        path: 'play/relay',
        name: 'play-relay',
        component: () => import('@/views/play/RelayView.vue'),
        meta: { title: t.relay.title, subtitle: t.relay.desc }
      },
      {
        path: 'admin/questions',
        name: 'admin-questions',
        component: () => import('@/views/admin/QuestionManageView.vue'),
        meta: { title: t.admin.title, subtitle: t.nav.adminDesc }
      },
      {
        path: 'admin/import',
        name: 'admin-import',
        component: () => import('@/views/admin/ImportView.vue'),
        meta: { title: t.admin.importTitle, subtitle: t.nav.adminDesc }
      }
    ]
  },
  {
    path: '/paper-editor',
    name: 'paper-editor',
    component: () => import('@/views/print/PaperEditorView.vue'),
    meta: { title: '手动组卷' }
  },
  {
    path: '/print',
    name: 'print',
    component: () => import('@/views/print/PrintView.vue'),
    meta: { public: true, title: '打印' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/home' }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  if (to.meta.public) return true
  const auth = useAuthStore()
  if (!auth.isLoggedIn) return { path: '/', query: { redirect: to.fullPath } }
  return true
})
