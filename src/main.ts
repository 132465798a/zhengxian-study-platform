import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import 'primeicons/primeicons.css'
import 'katex/dist/katex.min.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/print.css'
import App from './App.vue'
import { router } from './router'
import { StudyPreset } from './theme/preset'
import { useThemeStore } from '@/stores/theme.store'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

useThemeStore()

app.use(PrimeVue, {
  theme: {
    preset: StudyPreset,
    options: {
      darkModeSelector: '[data-theme="dark"]',
      cssLayer: false
    }
  },
  ripple: false,
  locale: {
    startsWith: '以…开头',
    contains: '包含',
    notContains: '不包含',
    endsWith: '以…结尾',
    equals: '等于',
    notEquals: '不等于',
    noFilter: '无筛选',
    lt: '小于',
    lte: '小于等于',
    gt: '大于',
    gte: '大于等于',
    dateIs: '日期等于',
    dateIsNot: '日期不等于',
    dateBefore: '日期早于',
    dateAfter: '日期晚于',
    clear: '清除',
    apply: '应用',
    matchAll: '全部匹配',
    matchAny: '任一匹配',
    addRule: '添加规则',
    removeRule: '删除规则',
    accept: '确定',
    reject: '取消',
    choose: '选择',
    upload: '上传',
    cancel: '取消',
    completed: '已完成',
    pending: '待处理',
    fileSizeTypes: ['B', 'KB', 'MB', 'GB', 'TB'],
    dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    dayNamesShort: ['日', '一', '二', '三', '四', '五', '六'],
    dayNamesMin: ['日', '一', '二', '三', '四', '五', '六'],
    monthNames: [
      '一月',
      '二月',
      '三月',
      '四月',
      '五月',
      '六月',
      '七月',
      '八月',
      '九月',
      '十月',
      '十一月',
      '十二月'
    ],
    monthNamesShort: [
      '1月',
      '2月',
      '3月',
      '4月',
      '5月',
      '6月',
      '7月',
      '8月',
      '9月',
      '10月',
      '11月',
      '12月'
    ],
    today: '今天',
    weekHeader: '周',
    firstDayOfWeek: 1,
    dateFormat: 'yy-mm-dd',
    weak: '弱',
    medium: '中',
    strong: '强',
    passwordPrompt: '请输入密码',
    emptyFilterMessage: '无匹配结果',
    emptyMessage: '暂无数据',
    selectionMessage: '已选 {0} 项',
    emptySelectionMessage: '未选择任何项',
    emptySearchMessage: '无匹配结果',
    fileChosenMessage: '{0} 个文件',
    noFileChosenMessage: '未选择文件'
  }
})
app.use(ToastService)
app.use(ConfirmationService)

app.mount('#app')
