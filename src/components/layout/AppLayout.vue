<template>
  <div class="shell">
    <AppSidebar @switch-user="switchUser" />
    <div class="main">
      <AppTitleBar />
      <main class="content">
        <router-view v-slot="{ Component }">
          <div :key="route.fullPath" class="view-host">
            <component :is="Component" />
          </div>
        </router-view>
      </main>
    </div>
    <PrintDialog />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import AppTitleBar from './AppTitleBar.vue'
import PrintDialog from '@/components/print/PrintDialog.vue'
import { useAuthStore } from '@/stores/auth.store'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

function switchUser(): void {
  auth.logout()
  router.push('/')
}

function onKeydown(event: KeyboardEvent): void {
  if (!event.altKey) return
  const map: Record<string, string> = {
    '1': '/home',
    '2': '/practice/setup',
    '3': '/exam',
    '4': '/wrongbook'
  }
  const target = map[event.key]
  if (target) {
    event.preventDefault()
    router.push(target)
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
}

.view-host {
  min-height: 100%;
  box-sizing: border-box;
  animation: view-in 0.1s ease both;
}

@keyframes view-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
