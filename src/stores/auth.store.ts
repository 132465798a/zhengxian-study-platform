import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { userApi } from '@/api'
import { t } from '@/i18n'
import type { Stage, User } from '@shared/types'

const STORAGE_KEY = 'study.currentUserId'

export const useAuthStore = defineStore('auth', () => {
  const users = ref<User[]>([])
  const currentUser = ref<User | null>(null)
  const loading = ref(false)

  const isLoggedIn = computed(() => currentUser.value !== null)
  const currentGrade = computed(() => currentUser.value?.grade ?? 1)

  function restore(): void {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const id = Number(raw)
    currentUser.value = users.value.find((item) => item.id === id) ?? null
    if (!currentUser.value) localStorage.removeItem(STORAGE_KEY)
  }

  function persist(user: User | null): void {
    if (user) localStorage.setItem(STORAGE_KEY, String(user.id))
    else localStorage.removeItem(STORAGE_KEY)
  }

  async function loadUsers(): Promise<void> {
    loading.value = true
    try {
      users.value = await userApi.list()
      restore()
    } finally {
      loading.value = false
    }
  }

  async function login(id: number, pin = ''): Promise<void> {
    const target = users.value.find((item) => item.id === id)
    if (!target) throw new Error(t.auth.nameRequired)
    if (target.hasPin) {
      const result = await userApi.verifyPin(id, pin)
      if (!result.valid) throw new Error(t.auth.pinError)
    }
    currentUser.value = target
    persist(target)
  }

  async function create(input: {
    name: string
    grade: number
    stage?: Stage
    pin?: string | null
  }): Promise<User> {
    const created = await userApi.create(input)
    users.value = [...users.value, created]
    currentUser.value = created
    persist(created)
    return created
  }

  async function update(
    id: number,
    patch: { name?: string; grade?: number; stage?: Stage; pin?: string | null }
  ): Promise<void> {
    const updated = await userApi.update(id, patch)
    users.value = users.value.map((item) => (item.id === id ? updated : item))
    if (currentUser.value?.id === id) currentUser.value = updated
  }

  async function remove(id: number): Promise<void> {
    await userApi.remove(id)
    users.value = users.value.filter((item) => item.id !== id)
    if (currentUser.value?.id === id) logout()
  }

  function logout(): void {
    currentUser.value = null
    persist(null)
  }

  return {
    users,
    currentUser,
    loading,
    isLoggedIn,
    currentGrade,
    loadUsers,
    login,
    create,
    update,
    remove,
    logout
  }
})
