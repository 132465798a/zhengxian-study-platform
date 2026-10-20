<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/banner.png" alt="正贤学习平台" width="100%" />
</p>

<h1 align="center">正贤学习平台</h1>

<p align="center">
  面向小学 1-6 年级的本地桌面学习平台<br />
  语文 · 数学 · 英语　|　练习 · 考试 · 错题本 · 线下组卷
</p>

<p align="center">
  Windows 10/11 · Electron 44 · Vue 3.5 · TypeScript · MIT
</p>

## 项目简介

正贤学习平台是一款完全离线运行的小学学习桌面软件。题库、练习记录、错题本和打印数据都保存在本机，不依赖账号体系，也不会上传任何学习数据。

主要面向家庭场景：一台电脑可以创建多个孩子账号，各自拥有独立的练习、考试、错题与统计；同时提供线下打印组卷，方便生成纸质练习卷、口算题卡、字帖和英语书写纸。

## 界面截图

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/19-two-column-pdf.png" alt="双栏试卷 PDF 预览" width="100%" />
</p>

<p align="center"><sub>双栏试卷 PDF 预览 · 真实分页与打印效果</sub></p>

> 如果图片未显示，可直接浏览 [截图目录](https://github.com/132465798a/zhengxian-study-platform/tree/main/docs/images/screens)。

## 下载安装

Windows 安装包见 [Releases](https://github.com/132465798a/zhengxian-study-platform/releases/latest)。

- 支持系统：Windows 10 / 11 x64
- 安装包已内置题库、英语发音库与本地识别模型
- 首次启动为空白账号列表，请点击「新建账号」创建使用者
- 默认主题：浅色 + 墨黑，可在右上角切换深浅色与强调色

## 功能特性

- **日常练习**：按学科、年级、题型、难度、知识点抽题，支持随机、错题优先、按知识点三种组卷方式。
- **模拟考试**：内置 1-6 年级语文、数学、英语基础检测卷，限时作答、自动判分、逐题回顾。
- **错题本**：答错自动收录，支持按学科/年级/掌握状态筛选、查看解析、标记已掌握、错题专练。
- **线下组卷**：生成可打印试卷，支持 A4/A3/B4/8K、单双栏、答案页、答题卡、得分表、密封线、页码、卷首说明、作文格、竖式区、作图区、附加题、答案评分标准等版式。
- **手动组卷**：空白卷编辑器，可从题库挑题或调用生成器，实时预览并直接打印/导出 PDF。
- **文字练习**：生成田字格、米字格、回宫格和拼音田字格字帖，支持范字、描红与空格练习。
- **口算题卡**：按年级、题量、数值范围和加减乘除运算生成整页口算题。
- **英语书写**：生成单词、句子、整句抄写与听写纸，支持四线三格排版。
- **汉字学习**：拼音、部首、笔画数、结构、笔顺动画、组词与成语。
- **英语听力**：听音选词、听音辨义、听写填空、句子听力、跟读评分。
- **学习统计**：答题量、正确率、学习时长、学科分布、近 14 天趋势、练习与考试记录。
- **题库管理**：本地题库检索、新增、编辑、删除，支持 CSV/JSON 批量导入。

## 界面预览

### 核心流程

| 账号选择 | 首页 |
|---|---|
| ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/01-user-gate.png) | ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/02-home.png) |

| 练习设置 | 练习答题 |
|---|---|
| ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/04-practice-setup.png) | ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/05-practice.png) |

| 练习结果 | 错题本 |
|---|---|
| ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/06-practice-result.png) | ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/10-wrongbook.png) |

| 模拟考试 | 考试答题 |
|---|---|
| ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/07-exam-list.png) | ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/08-exam.png) |

| 考试结果 | 学习统计 |
|---|---|
| ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/09-exam-result.png) | ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/11-stats.png) |

### 线下学习

| 自由组卷 | 打印设置 |
|---|---|
| ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/03-offline.png) | ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/17-print-settings.png) |

| 试卷预览 | 手动组卷 |
|---|---|
| ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/18-print-preview.png) | ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/16-paper-editor.png) |

| 文字练习 | 口算题卡 |
|---|---|
| ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/20-text-practice.png) | ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/21-oral-card.png) |

| 英语书写 | 英语书写纸预览 |
|---|---|
| ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/22-english-writing.png) | ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/23-english-writing-preview.png) |

| 字帖预览 | 双栏试卷 |
|---|---|
| ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/24-text-practice-preview.png) | ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/19-two-column-pdf.png) |

### 学习工具

| 汉字学习 | 英语听力 |
|---|---|
| ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/12-character.png) | ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/13-english.png) |

| 题库管理 | 批量导入 |
|---|---|
| ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/14-question-admin.png) | ![](https://cdn.jsdelivr.net/gh/132465798a/zhengxian-study-platform@main/docs/images/screens/15-import.png) |

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面容器 | Electron 44 |
| 前端 | Vue 3.5、TypeScript、Pinia、Vue Router |
| UI | PrimeVue 4、PrimeIcons、KaTeX |
| 构建 | electron-vite、Vite 6、electron-builder |
| 数据 | better-sqlite3（题库库 + 用户库分离） |
| 语音 | sherpa-onnx（本地英语识别）、Edge TTS / 系统语音 |
| 打印 | Electron `printToPDF` + 自定义 HTML 排版 |

## 快速开始

### 环境要求

- Windows 10 / 11
- Node.js 22 及以上（开发环境使用 Node 24 / npm 11 验证）
- npm 10 及以上

### 克隆与启动

```powershell
git clone https://github.com/132465798a/zhengxian-study-platform.git
cd zhengxian-study-platform
npm install
npm run dev
```

首次启动会创建本地用户库。应用不预置账号，请点击「新建账号」创建第一个使用者。

### 构建

```powershell
# 编译主进程、preload 与渲染进程
npm run build

# 生成 Windows 安装包，输出到 dist/
npm run dist
```

`npm run dist` 会确保题库、英语发音库和本地识别模型齐全，再执行 electron-builder 打包。

### 常用脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | 开发模式启动 |
| `npm run dev:debug` | 开发模式并开放 9222 调试端口 |
| `npm run build` | 生产构建 |
| `npm run dist` | 打包 Windows NSIS 安装包 |
| `npm run typecheck` | 前端 + 主进程类型检查 |
| `npm run lint` | ESLint 检查 |
| `npm test` | 题库与词库健康检查 |
| `npm run audio:build` | 重新生成英语词表发音库 |
| `npm run asr:fetch` | 下载本地英语识别模型 |

## 数据与资源

- `build/bank.db`：随仓库提供的题库，约 74,000 题，覆盖 1-6 年级语文、数学、英语。
- `build/audio/`：英语词表发音库，供离线听力使用。
- `build/asr/`：本地英语识别模型，不在仓库中；首次运行 `npm run dev` 时自动下载（约 45MB）。
- 用户数据保存在 `%APPDATA%\正贤学习平台`，包括用户、练习、考试、错题、模板与设置。仓库不包含任何用户数据。

## 目录结构

```text
正贤学习平台/
├─ electron/           # 主进程、数据库、生成器、打印服务
│  ├─ db/              # schema、仓储、导入器、题目生成器
│  └─ print/           # 组卷、排版、答案、PDF 输出
├─ shared/             # 主进程与渲染进程共享的类型、常量、校验
├─ src/                # Vue 渲染进程
│  ├─ views/           # 首页、练习、考试、错题、统计、打印、管理
│  ├─ components/      # 布局、题目渲染、打印组件
│  ├─ stores/          # Pinia 状态
│  └─ i18n/            # 中文文案
├─ scripts/            # 题库构建、ASR 下载、检查脚本
├─ build/              # 题库、音频、图标等构建资产
└─ docs/images/        # README 图片
```

## 隐私说明

- 全部数据存储在本机 SQLite，不包含云同步、埋点或遥测。
- 应用不会上传用户、练习、考试或错题数据。
- 字源解释与语音识别模型可能访问外部资源，仅用于功能补充。

## 许可证

本项目采用 [MIT License](LICENSE)。

> 题库内容来自公开数据集与内置生成器，仅供学习交流使用；相关内容的版权归原作者所有。
