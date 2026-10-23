<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="page-eyebrow">{{ t.goal.eyebrow }}</p>
        <h1 class="page-title">{{ t.goal.title }}</h1>
        <p class="page-desc">{{ t.goal.desc }}</p>
      </div>
    </header>

    <div v-if="loading" class="paper-card panel">
      <div class="empty-state compact">
        <i class="pi pi-spin pi-spinner" />
        <div class="title">{{ t.common.status.loading }}</div>
      </div>
    </div>

    <section v-else-if="goal" class="paper-card goal-card">
      <div class="goal-hero">
        <div>
          <p class="goal-label">{{ t.goal.currentTitle }}</p>
          <p class="goal-value">
            <span class="num">{{ goal.current }}</span>
            <template v-if="goal.target > 0">
              <span class="goal-sep num">/</span>
              <span class="goal-target num">{{ goal.target }}</span>
            </template>
            <span class="goal-unit">{{ unitText }}</span>
          </p>
          <p class="goal-meta">{{ metaText }}</p>
        </div>
        <span v-if="goal.target > 0" class="badge" :class="goal.achieved ? 'on' : 'off'">
          {{ goal.achieved ? t.goal.achieved : t.goal.inProgress }}
        </span>
      </div>

      <div class="goal-bar">
        <span class="goal-fill" :style="{ width: progressWidth }" />
      </div>

      <p v-if="goal.target === 0" class="goal-hint">{{ t.goal.emptyHint }}</p>
      <p v-if="error" class="goal-error">{{ error }}</p>

      <div class="goal-form">
        <div class="field">
          <span class="field-label">{{ t.goal.kindLabel }}</span>
          <SelectButton
            :model-value="kind"
            :options="kindOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            @update:model-value="selectKind"
          />
        </div>

        <div class="field">
          <span class="field-label">{{ t.goal.targetLabel }}</span>
          <div class="preset-row">
            <button
              v-for="value in presets"
              :key="value"
              type="button"
              class="preset num"
              :class="{ active: target === value }"
              @click="target = value"
            >
              {{ value }}<span class="preset-unit">{{ unitText }}</span>
            </button>
          </div>
        </div>

        <div class="actions">
          <Button :label="t.goal.save" icon="pi pi-flag" :loading="saving" @click="save" />
        </div>
      </div>
    </section>

    <div v-else class="paper-card panel">
      <div class="empty-state compact">
        <i class="pi pi-exclamation-circle" />
        <div class="title">{{ t.common.status.error }}</div>
        <div class="hint">{{ error }}</div>
      </div>
    </div>

    <div class="page-foot">
      <Button
        :label="t.goal.back"
        icon="pi pi-arrow-left"
        severity="secondary"
        text
        @click="router.push('/play')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { useToast } from 'primevue/usetoast'
import { goalApi } from '@/api'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import type { GoalKind, WeeklyGoal } from '@shared/types'

const PRESETS: Record<GoalKind, number[]> = {
  count: [50, 100, 200],
  accuracy: [80, 90, 95]
}

const router = useRouter()
const toast = useToast()
const auth = useAuthStore()

const goal = ref<WeeklyGoal | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const kind = ref<GoalKind>('count')
const target = ref<number>(PRESETS.count[0])

const kindOptions: { label: string; value: GoalKind }[] = [
  { label: t.goal.kindCount, value: 'count' },
  { label: t.goal.kindAccuracy, value: 'accuracy' }
]

const presets = computed<number[]>(() => PRESETS[kind.value])
const unitText = computed<string>(() => (kind.value === 'accuracy' ? '%' : t.goal.unitCount))

const progressWidth = computed<string>(() => {
  if (!goal.value || goal.value.target <= 0) return '0%'
  return `${Math.min(100, Math.round((goal.value.current / goal.value.target) * 100))}%`
})

const metaText = computed<string>(() => {
  if (!goal.value) return ''
  const kindLabel = goal.value.kind === 'accuracy' ? t.goal.kindAccuracy : t.goal.kindCount
  return `${kindLabel} · ${t.goal.weekStart} ${goal.value.weekStart}`
})

function selectKind(value: unknown): void {
  if (value !== 'count' && value !== 'accuracy') return
  kind.value = value
  if (!PRESETS[value].includes(target.value)) target.value = PRESETS[value][0]
}

function apply(result: WeeklyGoal): void {
  goal.value = result
  kind.value = result.kind
  target.value = result.target > 0 ? result.target : PRESETS[result.kind][0]
}

async function load(): Promise<void> {
  const user = auth.currentUser
  if (!user) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    apply(await goalApi.get(user.id))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : ''
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  const user = auth.currentUser
  if (!user || saving.value) return
  saving.value = true
  error.value = ''
  try {
    apply(await goalApi.set(user.id, kind.value, target.value))
    toast.add({ severity: 'success', summary: t.goal.saved, life: 2200 })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : ''
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page {
  font-size: 13.5px;
}

.panel {
  padding: 14px 20px;
}

.goal-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px 24px;
}

.goal-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.goal-label {
  margin: 0;
  color: var(--ink-faint);
  font-size: 12px;
  letter-spacing: 0.08em;
}

.goal-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 6px 0 0;
  color: var(--ink);
  font-size: 34px;
  line-height: 1.1;
}

.goal-sep {
  color: var(--ink-faint);
  font-size: 22px;
}

.goal-target {
  color: var(--ink-soft);
  font-size: 22px;
}

.goal-unit {
  color: var(--ink-faint);
  font-size: 13px;
}

.goal-meta {
  margin: 8px 0 0;
  color: var(--ink-soft);
  font-size: 12.5px;
}

.badge {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  letter-spacing: 0.04em;
}

.badge.on {
  color: var(--success);
  background: var(--success-soft);
}

.badge.off {
  color: var(--accent);
  background: var(--accent-soft);
}

.goal-bar {
  height: 8px;
  border-radius: 999px;
  background: var(--line);
  overflow: hidden;
}

.goal-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.3s ease;
}

.goal-hint {
  margin: 0;
  color: var(--ink-soft);
  font-size: 12.5px;
  line-height: 1.7;
}

.goal-error {
  margin: 0;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  color: var(--danger);
  background: var(--danger-soft);
  font-size: 12.5px;
}

.goal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--line);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  color: var(--ink-soft);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset {
  min-width: 78px;
  padding: 8px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg-raised);
  color: var(--ink-soft);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
}

.preset:hover {
  border-color: var(--line-strong);
}

.preset.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.preset-unit {
  margin-left: 2px;
  font-size: 11.5px;
  opacity: 0.7;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-foot {
  display: flex;
  justify-content: flex-start;
  margin-top: 16px;
}
</style>
