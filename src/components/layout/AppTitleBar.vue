<template>
  <header class="titlebar drag-region">
    <div class="drag-area" />

    <div class="controls no-drag">
      <div class="accents">
        <button
          v-for="option in ACCENT_OPTIONS"
          :key="option.key"
          class="accent-dot"
          :class="{ active: option.key === theme.accentKey }"
          :style="{ background: option.color }"
          :title="option.label"
          :aria-label="option.label"
          @click="theme.setAccent(option.color)"
        />
      </div>
      <button class="icon" :title="theme.isDark ? '切换浅色' : '切换深色'" @click="theme.toggleMode">
        <i :class="theme.isDark ? 'pi pi-sun' : 'pi pi-moon'" />
      </button>
      <div class="window-controls">
        <button class="icon" title="最小化" @click="onMinimize">
          <i class="pi pi-window-minimize" />
        </button>
        <button class="icon" :title="isMaximized ? '还原' : '最大化'" @click="onToggleMaximize">
          <i :class="isMaximized ? 'pi pi-window-maximize' : 'pi pi-stop'" />
        </button>
        <button class="icon close" title="关闭" @click="onClose">
          <i class="pi pi-times" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useThemeStore, ACCENT_OPTIONS } from '@/stores/theme.store'

const theme = useThemeStore()
const isMaximized = ref(false)

let unsubMaximize: (() => void) | null = null

onMounted(() => {
  const api = window.studyAPI?.window
  if (api) {
    unsubMaximize = api.onMaximizeChange((maximized) => {
      isMaximized.value = maximized
    })
  }
})

onBeforeUnmount(() => {
  unsubMaximize?.()
})

function onMinimize(): void {
  window.studyAPI?.window.minimize()
}

function onToggleMaximize(): void {
  window.studyAPI?.window.toggleMaximize()
}

function onClose(): void {
  window.studyAPI?.window.close()
}
</script>

<style scoped>
.titlebar {
  height: var(--titlebar-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  background: var(--bg);
  color: var(--ink);
  user-select: none;
}

.drag-area {
  flex: 1;
  height: 100%;
}

.controls {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
}

.accents {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px 0 4px;
}

.accent-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s ease;
}

.accent-dot:hover {
  transform: scale(1.15);
}

.accent-dot.active {
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--ink);
}

.icon {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--ink-soft);
  cursor: pointer;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  transition: background 0.1s ease, color 0.1s ease;
}

.icon i {
  font-size: var(--icon-size);
}

.icon:hover {
  background: var(--accent-soft);
  color: var(--ink);
}

.window-controls {
  display: flex;
  align-items: center;
  margin-left: 4px;
}

.window-controls .icon {
  width: 34px;
  border-radius: 0;
}

.icon.close:hover {
  background: var(--danger);
  color: #ffffff;
}
</style>
