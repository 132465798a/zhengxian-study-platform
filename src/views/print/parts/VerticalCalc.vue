<template>
  <div v-if="!division" class="vertical-calc">
    <div v-for="(operand, index) in aligned" :key="index" class="vc-row">
      <span class="vc-op">{{ index === 0 ? '' : operators[index - 1] }}</span>
      <span class="vc-num">{{ operand }}</span>
    </div>
    <div class="vc-rule" />
    <div class="vc-answer" />
    <div v-if="scratch" class="vertical-scratch" />
  </div>

  <div v-else class="long-div">
    <div class="ld-quotient" />
    <div class="ld-body">
      <span class="ld-divisor">{{ operands[1] }}</span>
      <div class="ld-bracket">
        <span>{{ operands[0] }}</span>
      </div>
    </div>
    <div v-if="scratch" class="vertical-scratch" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  operands: string[]
  operators: string[]
  division: boolean
  scratch: boolean
}>()

/** 小数点对齐：整数部分补前导空格，小数部分补尾随空格 */
const aligned = computed<string[]>(() => {
  if (props.division) return props.operands
  const parts = props.operands.map((item) => item.split('.'))
  const maxInt = Math.max(...parts.map((part) => part[0].length))
  const maxFrac = Math.max(...parts.map((part) => part[1]?.length ?? 0))
  return parts.map(([int, frac]) => {
    const left = ' '.repeat(Math.max(0, maxInt - int.length)) + int
    if (maxFrac === 0) return left
    return `${left}.${(frac ?? '').padEnd(maxFrac, ' ')}`
  })
})
</script>
