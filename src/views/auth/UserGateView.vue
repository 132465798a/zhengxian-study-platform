<template>
  <div class="gate">
    <section class="panel">
      <header class="panel-head">
        <div class="brand">
          <div class="seal">
            <img src="@/assets/logo.png" alt="正贤学习平台">
          </div>
          <div class="brand-text">
            <strong>{{ t.common.appName }}</strong>
            <small>{{ t.common.appSubtitle }}</small>
          </div>
        </div>
        <Button
          :label="t.auth.newUser"
          icon="pi pi-plus"
          size="small"
          outlined
          @click="openCreate"
        />
      </header>

      <div v-if="auth.loading" class="loading">{{ t.common.status.loading }}</div>

      <div v-else-if="auth.users.length === 0" class="empty-state">
        <i class="pi pi-user-plus" />
        <div class="title">{{ t.auth.noUsers }}</div>
        <div class="hint">{{ t.auth.createHint }}</div>
      </div>

      <div v-else class="user-grid">
        <button
          v-for="item in auth.users"
          :key="item.id"
          class="user-tile"
          :class="{ current: item.id === auth.currentUser?.id }"
          @click="selectUser(item)"
        >
          <span class="avatar" :class="{ 'is-emoji': item.avatar }">
            {{ item.avatar || item.name.slice(0, 1) }}
          </span>
          <span class="info">
            <strong>{{ item.name }}</strong>
            <small>{{ t.common.gradeText(item.grade) }}</small>
          </span>
          <i v-if="item.hasPin" class="pi pi-lock lock" />
          <i v-else class="pi pi-arrow-right arrow" />
        </button>
      </div>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

      <footer class="panel-foot">
        <span>{{ t.auth.pinHint }}</span>
      </footer>
    </section>

    <Dialog
      v-model:visible="createVisible"
      modal
      :header="t.auth.createTitle"
      :style="{ width: '420px' }"
      :dismissable-mask="false"
      :draggable="false"
    >
      <div class="form">
        <label>
          <span>{{ t.auth.name }}</span>
          <InputText v-model="form.name" :placeholder="t.auth.namePlaceholder" maxlength="20" />
        </label>
        <label>
          <span>{{ t.auth.grade }}</span>
          <Select
            v-model="form.grade"
            :options="gradeOptions"
            option-label="label"
            option-value="value"
            :placeholder="t.auth.gradePlaceholder"
          />
        </label>
        <label>
          <span>{{ t.auth.pin }}</span>
          <InputText
            v-model="form.pin"
            :placeholder="t.auth.pinPlaceholder"
            maxlength="6"
            inputmode="numeric"
          />
          <small class="hint">{{ t.auth.pinHint }}</small>
        </label>
        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      </div>
      <template #footer>
        <Button :label="t.common.actions.cancel" text @click="createVisible = false" />
        <Button :label="t.common.actions.confirm" :loading="submitting" @click="createUser" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="pinVisible"
      modal
      :header="t.auth.pinTitle"
      :style="{ width: '360px' }"
      :dismissable-mask="false"
      :draggable="false"
    >
      <div class="form">
        <label>
          <span>{{ t.auth.pinPrompt }} {{ pendingUser?.name }} {{ t.auth.pin }}</span>
          <InputText
            v-model="pinInput"
            type="password"
            maxlength="6"
            inputmode="numeric"
            autofocus
            @keyup.enter="confirmPin"
          />
        </label>
        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      </div>
      <template #footer>
        <Button :label="t.common.actions.cancel" text @click="pinVisible = false" />
        <Button :label="t.auth.enter" :loading="submitting" @click="confirmPin" />
      </template>
    </Dialog>

    <Toast position="bottom-right" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Toast from 'primevue/toast'
import { useAuthStore } from '@/stores/auth.store'
import { t } from '@/i18n'
import type { User } from '@shared/types'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const createVisible = ref(false)
const pinVisible = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const pendingUser = ref<User | null>(null)
const pinInput = ref('')

const form = reactive({ name: '', grade: null as number | null, pin: '' })

const gradeOptions = computed(() =>
  Array.from({ length: 6 }, (_, index) => ({
    label: t.common.gradeText(index + 1),
    value: index + 1
  }))
)

function goNext(): void {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/home'
  router.replace(redirect)
}

async function load(): Promise<void> {
  await auth.loadUsers()
  if (auth.isLoggedIn) goNext()
}

function openCreate(): void {
  errorMessage.value = ''
  form.name = ''
  form.grade = auth.currentUser?.grade ?? 1
  form.pin = ''
  createVisible.value = true
}

async function createUser(): Promise<void> {
  errorMessage.value = ''
  if (!form.name.trim()) {
    errorMessage.value = t.auth.nameRequired
    return
  }
  if (!form.grade) {
    errorMessage.value = t.auth.gradeRequired
    return
  }
  if (form.pin && !/^\d{4,6}$/.test(form.pin)) {
    errorMessage.value = t.auth.pinHint
    return
  }
  submitting.value = true
  try {
    await auth.create({
      name: form.name.trim(),
      grade: form.grade,
      pin: form.pin || null
    })
    createVisible.value = false
    goNext()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t.common.status.error
  } finally {
    submitting.value = false
  }
}

async function selectUser(item: User): Promise<void> {
  errorMessage.value = ''
  if (item.hasPin) {
    pendingUser.value = item
    pinInput.value = ''
    pinVisible.value = true
    return
  }
  submitting.value = true
  try {
    await auth.login(item.id)
    goNext()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t.common.status.error
  } finally {
    submitting.value = false
  }
}

async function confirmPin(): Promise<void> {
  if (!pendingUser.value) return
  if (!pinInput.value) {
    errorMessage.value = t.auth.pinRequired
    return
  }
  submitting.value = true
  errorMessage.value = ''
  try {
    await auth.login(pendingUser.value.id, pinInput.value)
    pinVisible.value = false
    goNext()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t.auth.pinError
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.gate {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-sunken);
  padding: 24px;
  overflow: hidden;
}

.panel {
  width: 100%;
  max-width: 460px;
  max-height: 100%;
  background: var(--bg-raised);
  border-radius: var(--radius);
  padding: 32px 36px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.seal {
  width: 40px;
  height: 40px;
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
  line-height: 1.25;
}

.brand-text strong {
  font-size: 16px;
  letter-spacing: 0.02em;
}

.brand-text small {
  font-size: 11px;
  color: var(--ink-faint);
}

.user-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.user-tile {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s ease, border-color 0.1s ease;
}

.user-tile:hover {
  background: var(--accent-soft);
  border-color: var(--line-strong);
}

.user-tile.current {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-contrast);
  font-size: 17px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.avatar.is-emoji {
  font-size: 22px;
}

.info {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
  min-width: 0;
}

.info strong {
  font-size: 14px;
}

.info small {
  font-size: 11.5px;
  color: var(--ink-faint);
}

.lock,
.arrow {
  margin-left: auto;
  font-size: 12px;
  color: var(--ink-faint);
}

.loading {
  padding: 40px 0;
  text-align: center;
  color: var(--ink-faint);
  font-size: 13px;
}

.panel-foot {
  margin-top: auto;
  padding-top: 20px;
  font-size: 11.5px;
  color: var(--ink-faint);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form label {
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 12.5px;
  color: var(--ink-soft);
}

.form .hint {
  color: var(--ink-faint);
  font-size: 11.5px;
  line-height: 1.6;
}

.error {
  color: var(--danger);
  font-size: 12.5px;
  margin: 4px 0 0;
}

@media (max-width: 520px) {
  .panel {
    padding: 24px 20px;
  }
  .user-grid {
    grid-template-columns: 1fr;
  }
}
</style>
