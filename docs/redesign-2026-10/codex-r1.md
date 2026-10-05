# Codex 复核 R1 回执（2026-10-06，Remix 工作流）

- 复核者：Codex CLI（herdr workspace zcode-openai-image-webui-v1-redesign，gpt-6.1-sol + xhigh，--yolo）
- 输入：redesign/v1-world-class @ 144725a 前的真实工作区 + diff main..HEAD（46 files，+5708/−4462）+ docs/ 评审轨迹
- 耗时 21m58s；独立运行了 pnpm build / tsc --noEmit / git show 对照 / 真实页面探针（自行起停开发实例，未触碰他人进程）
- **综合 5.7/10，结论：需返工**（IA 7.0 / IDB 4.0 / 零回退 6.0）

## P1 清单（全部有 file:line）

1. 迁移后批量提示词无法恢复（migration 写 kv 后 App 仍只读 localStorage 且回写旧键）
2. 迁移与 IDB hooks 并发启动竞态（首屏可能读到默认设置与空任务）
3. 批量模式无任务详情列表（面板文案声称有卡片，实际 App 分支未渲染）
4. 图片库框选自动滚动在 Drawer 失效（window.scrollBy 未跟随滚动容器）
5. i18n key 缺失（zh header.status、settings.migrationFailed 双语、Drawer 硬编码 Close）
6. storageNew 的 StorageSchema 未 extends DBSchema，idb 类型退回隐式 any

## 质量项

App 职责过载（migrationStatus/settingsLoaded 未使用）、clearTasks 未清 IDB、kv 无类型映射、
部分文件缺意图注释、git diff --check 大量尾随空格、无自动化测试脚本。

## 修复（commit 144725a）

六条 P1 全部处理 + 质量项：迁移改 main.tsx bootstrap（先迁移后渲染，竞态根除）、批量提示词从 kv
种子化且 App 与 localStorage 批量键解耦、批量分支渲染按 currentBatchId 过滤的 ResultGallery、框选
滚动改抽屉容器、i18n 补齐（252=252 parity）、Schema extends DBSchema + 类型化 kv 映射、clearTasks
清 IDB、意图注释补齐。回归实测：批量提示词从 IDB 恢复、Header 中文「已连接」。

## 待二轮复核

Codex 已收到 ReAct 闭环指令：逐条判定 closed/not-closed + 重评分 + 可交付结论。
