<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">PLAYGROUND</p>
        <h1 class="page-title">{{ t.play.hub.title }}</h1>
        <p class="page-desc">{{ t.play.hub.desc }}</p>
      </div>
    </header>

    <section class="play-grid">
      <button
        v-for="item in entries"
        :key="item.to"
        class="play-card"
        @click="router.push(item.to)"
      >
        <span class="play-icon"><i :class="item.icon" /></span>
        <span class="play-text">
          <strong>{{ item.title }}</strong>
          <small>{{ item.desc }}</small>
        </span>
        <i class="pi pi-arrow-up-right play-arrow" />
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { t } from '@/i18n'

const router = useRouter()

const entries = computed(() => [
  {
    to: '/play/goal',
    icon: 'pi pi-flag',
    title: t.play.hub.goal,
    desc: t.play.hub.goalDesc
  },
  {
    to: '/play/levels',
    icon: 'pi pi-map',
    title: t.play.hub.levels,
    desc: t.play.hub.levelsDesc
  },
  {
    to: '/play/challenge',
    icon: 'pi pi-bolt',
    title: t.play.hub.challenge,
    desc: t.play.hub.challengeDesc
  },
  {
    to: '/play/family',
    icon: 'pi pi-users',
    title: t.play.hub.family,
    desc: t.play.hub.familyDesc
  },
  {
    to: '/play/portfolio',
    icon: 'pi pi-folder-open',
    title: t.play.hub.portfolio,
    desc: t.play.hub.portfolioDesc
  },
  {
    to: '/play/relay',
    icon: 'pi pi-sync',
    title: t.play.hub.relay,
    desc: t.play.hub.relayDesc
  }
])
</script>

<style scoped>
.play-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.play-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px;
  text-align: left;
  background: var(--bg-raised);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}

.play-card:hover {
  border-color: var(--line-strong);
  background: var(--accent-soft);
}

.play-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  color: var(--accent);
  flex-shrink: 0;
}

.play-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.play-text strong {
  font-size: 14px;
  color: var(--ink);
}

.play-text small {
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--ink-soft);
}

.play-arrow {
  margin-left: auto;
  color: var(--ink-faint);
  font-size: 12px;
}

@media (max-width: 1000px) {
  .play-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
