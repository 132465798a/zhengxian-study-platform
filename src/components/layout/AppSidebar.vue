<template>
  <aside class="rail">
    <div class="brand">
      <div class="seal">
        <img src="@/assets/logo.png" alt="正贤学习平台">
      </div>
      <div class="brand-text">
        <strong>{{ t.common.appName }}</strong>
        <small>{{ t.common.appSubtitle }}</small>
      </div>
    </div>

    <nav class="nav">
      <template v-for="group in groups" :key="group.key">
        <div class="group-label">{{ group.label }}</div>
        <RouterLink
          v-for="item in group.items"
          :key="item.key"
          :to="item.to"
          class="nav-item"
          :class="{ active: isActive(item.to) }"
        >
          <i :class="item.icon" />
          <span>{{ item.label }}</span>
          <em v-if="item.key === 'wrongbook' && wrongCount > 0" class="count">{{ wrongCount }}</em>
        </RouterLink>
      </template>
    </nav>

    <div class="rail-foot">
      <div class="user-card">
        <div class="avatar" :class="{ 'is-emoji': auth.currentUser?.avatar }">
          {{ auth.currentUser?.avatar || initial }}
        </div>
        <div class="user-meta">
          <strong>{{ auth.currentUser?.name ?? '—' }}</strong>
          <small>{{ gradeLabel }}</small>
        </div>
        <button class="switch" :title="t.auth.switchUser" @click="emit('switch-user')">
          <i class="pi pi-sign-out" />
        </button>
      </div>
      <p class="shortcut">{{ t.nav.hint }}</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { RouterLink } from 'vue-router'
import { wrongApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'

const emit = defineEmits<{ (event: 'switch-user'): void }>()

const route = useRoute()
const auth = useAuthStore()
const wrongCount = ref(0)

const groups = computed(() => [
  {
    key: 'study',
    label: t.nav.groupStudy,
    items: [
      { key: 'home', label: t.nav.home, icon: 'pi pi-home', to: '/home' },
      { key: 'offline', label: t.nav.offline, icon: 'pi pi-print', to: '/offline' },
      { key: 'practice', label: t.nav.practice, icon: 'pi pi-pencil', to: '/practice/setup' },
      { key: 'exam', label: t.nav.exam, icon: 'pi pi-clock', to: '/exam' },
      { key: 'wrongbook', label: t.nav.wrongbook, icon: 'pi pi-bookmark', to: '/wrongbook' },
      { key: 'stats', label: t.nav.stats, icon: 'pi pi-chart-line', to: '/stats' },
      { key: 'play', label: t.nav.play, icon: 'pi pi-play-circle', to: '/play' }
    ]
  },
  {
    key: 'manage',
    label: t.nav.groupManage,
    items: [{ key: 'admin', label: t.nav.admin, icon: 'pi pi-database', to: '/admin/questions' }]
  }
])

const initial = computed(() => auth.currentUser?.name?.slice(0, 1) ?? t.common.brandMark)
const gradeLabel = computed(() =>
  auth.currentUser ? t.common.gradeText(auth.currentUser.grade) : ''
)

function isActive(to: string): boolean {
  if (to === '/home') return route.path === '/home'
  return route.path.startsWith(to.split('/').slice(0, 2).join('/'))
}

async function refreshWrongCount(): Promise<void> {
  if (!auth.currentUser) return
  try {
    const summary = await wrongApi.summary(auth.currentUser.id)
    wrongCount.value = summary.unmastered
  } catch {
    wrongCount.value = 0
  }
}

onMounted(refreshWrongCount)
</script>

<style scoped>
.rail {
  width: var(--rail-width);
  flex-shrink: 0;
  background: var(--bg-sunken);
  color: var(--ink);
  display: flex;
  flex-direction: column;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 12px;
}

.seal {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: grid;
  place-items: center;
}

.seal img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.brand-text strong {
  font-size: 13.5px;
  letter-spacing: 0.02em;
}

.brand-text small {
  color: var(--ink-faint);
  font-size: 11px;
}

.nav {
  flex: 1;
  padding: 4px 8px;
  overflow-y: auto;
}

.group-label {
  margin: 10px 8px 4px;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--ink-faint);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  color: var(--ink-soft);
  text-decoration: none;
  font-size: 13px;
  transition: background 0.1s ease, color 0.1s ease;
}

.nav-item i {
  font-size: var(--icon-size);
  width: 15px;
  text-align: center;
  opacity: 0.85;
}

.nav-item:hover {
  background: var(--accent-soft);
  color: var(--ink);
}

.nav-item.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.nav-item.active i {
  opacity: 1;
}

.count {
  margin-left: auto;
  background: var(--danger);
  color: #ffffff;
  font-style: normal;
  font-size: 11px;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-family: var(--font-num);
}

.rail-foot {
  padding: 10px 12px 12px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-raised);
  border-radius: var(--radius-sm);
  padding: 8px;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-contrast);
  font-size: 13px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.avatar.is-emoji {
  font-size: 17px;
}

.user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  min-width: 0;
}

.user-meta strong {
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-meta small {
  font-size: 11px;
  color: var(--ink-faint);
}

.switch {
  margin-left: auto;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--ink-soft);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.1s ease;
}

.switch i {
  font-size: var(--icon-size);
}

.switch:hover {
  background: var(--accent-soft);
  color: var(--ink);
}

.shortcut {
  margin: 8px 4px 0;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--ink-faint);
}
</style>
