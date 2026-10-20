<template>
  <span class="latex-text" v-html="html"></span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import katex from 'katex'

const props = defineProps<{ text: string }>()

const mathPattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
const fractionPattern = /(?<![\d/])(\d{1,4})\s*\/\s*(\d{1,4})(?![\d/])/g

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeSource(value: string): string {
  // 题库导入时可能出现 \\textasciitilde 这类双重转义，先还原成单反斜杠
  return value.replace(/\\\\([a-zA-Z]+)/g, '\\$1')
}

function renderPlain(value: string): string {
  return escapeHtml(normalizeSource(value))
    .replace(
      fractionPattern,
      '<span class="frac"><span class="frac-num">$1</span><span class="frac-den">$2</span></span>'
    )
    .replace(/\\textbf\{([^{}]*)\}/g, '<strong>$1</strong>')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_')
    .replace(/\\textsuperscript\{([^{}]*)\}/g, '<sup>$1</sup>')
    .replace(/\\uline\{([^{}]*)\}/g, '<span class="latex-underline">$1</span>')
    .replace(/\\ldots(?![a-zA-Z])/g, '…')
    .replace(/\\textless(?![a-zA-Z])/g, '&#60;')
    .replace(/\\textgreater(?![a-zA-Z])/g, '&#62;')
    .replace(/\\textasciitilde(?![a-zA-Z])/g, '&#126;')
    .replace(/\\textquotesingle(?![a-zA-Z])/g, '&#39;')
    .replace(/~/g, '&nbsp;')
    .replace(/([\u31c0-\u31e3])/g, '<span class="stroke-glyph-inline">$1</span>')
}

function renderMath(source: string, displayMode: boolean): string {
  // KaTeX 不支持 \textasciitilde / \textless 等文本命令，换成等价数学符号
  const normalized = normalizeSource(source)
    .replace(/\\textasciitilde/g, '\\sim')
    .replace(/\\textless/g, '\\lt')
    .replace(/\\textgreater/g, '\\gt')
    .replace(/\\textquotesingle/g, "'")
    .replace(/\\left\s*\{/g, '\\left\\{')
    .replace(/\\right\s*\}/g, '\\right\\}')
  try {
    return katex.renderToString(normalized, { displayMode, throwOnError: false })
  } catch {
    return escapeHtml(source)
  }
}

const html = computed<string>(() => {
  return props.text
    .split(mathPattern)
    .map((piece) => {
      if (piece.length >= 4 && piece.startsWith('$$') && piece.endsWith('$$')) {
        const source = piece.slice(2, -2)
        return renderMath(source, /\\begin\{/.test(source))
      }
      if (piece.length >= 2 && piece.startsWith('$') && piece.endsWith('$')) {
        return renderMath(piece.slice(1, -1), false)
      }
      return renderPlain(piece)
    })
    .join('')
})
</script>

<style scoped>
.latex-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.latex-text :deep(.stroke-glyph-inline) {
  font-size: 1.45em;
  line-height: 1;
  vertical-align: -0.06em;
}

.latex-text :deep(.latex-underline) {
  padding: 0 0.1em;
  border-bottom: 1px solid currentColor;
}

.latex-text :deep(.frac) {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  height: 2.3em;
  margin: 0 0.16em;
  font-size: 0.92em;
  line-height: 1;
  white-space: nowrap;
}

.latex-text :deep(.frac-num),
.latex-text :deep(.frac-den) {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.15em;
  padding: 0 0.18em;
  line-height: 1;
}

.latex-text :deep(.frac-num) {
  padding-bottom: 0.08em;
}

.latex-text :deep(.frac-den) {
  border-top: 1px solid currentColor;
  padding-top: 0.12em;
}
</style>
