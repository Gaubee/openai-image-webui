# 端到端走查报告 R1（2026-10-06，主会话实测）

## 走查环境

- 分支 `redesign/v1-world-class` @ c319bec，`pnpm dev`（vite 6.4.3，:5173）
- Mock Images API（`/tmp/webui-walkthrough/mock-images-api.mjs`，:8787）：真实 PNG 编码器，generations/edits/chat-completions 全覆盖，1.2s 人工延迟
- ZCode 内置浏览器：桌面 1440x900 + 移动 390x844，真实用户路径操作
- 截图存档：`/tmp/webui-walkthrough/0{1..8}-*.png`（7 张，均已通过尺寸/大小非平凡校验）

## 功能验证结果（全部通过真实浏览器操作取证）

| # | 路径 | 结果 | 证据 |
|---|------|------|------|
| 1 | 新 IA 渲染 | ✅ | prompt 居中主角、模式导航（生成/批量 + 识图/重命名/图片库抽屉）、结果内联呈现（记忆点成立） |
| 2 | 生成链路 | ✅ | prompt → POST /images/generations（mock 收到请求）→ blob → IDB 缓存（imageCached=true, 99.5KB）→ 内联渲染（1.3s elapsed 徽章、成本 $0.042） |
| 3 | 设置持久化 | ✅ | 刷新后从 IDB `openai-image-webui` settings store 读取；旧 localStorage 键已删除 |
| 4 | 任务历史持久化 | ✅ | 刷新后任务从 IDB 恢复、图片从 blob 缓存重建（imagesLoaded=1） |
| 5 | localStorage→IDB 迁移 | ✅ | 清库后植入旧格式 settings/tasks/batch-prompts → 重载 → 全部导入 IDB、旧键删除、`:migrated-to-idb` 标志写入 |
| 6 | 图片库 | ✅ | 缓存统计（1 images · 99.5 KB）、图片卡全套操作（Preview/Download/Copy prompt/Reuse params/Delete） |
| 7 | i18n zh/en | ✅ | 语言切换后 docLang=zh-CN、title/导航/表单/任务卡全量翻译 |
| 8 | 批量模式 | ✅ | prompt 列表解析（注释/空行跳过计数）、.txt/.md/.csv 导入、共享参考图 |
| 9 | 识图面板 | ✅ | 抽屉内上传区、本地化默认提示词、细节级别、高级 JSON、开始识图 |
| 10 | 移动端 | ✅ | 390px 无横向溢出，布局折行正常 |
| 11 | Drawer ESC | ✅ | Escape 关闭生效 |
| 12 | 无 API key 校验 | ✅ | Generate 按钮禁用态正确 |

## 发现的问题（修复清单输入）

- **P0 视觉：主题割裂**。TaskCard（03 图）、输入图片上传区（01/08 图）、图片库/识图抽屉（04/07 图）仍是旧版浅色主题（白底/浅灰底），坐在新深色表面上严重割裂；浅色底上的按钮（Preview/Reuse params）近乎不可见。
- **P1：动画不收敛**。按钮存在永不前进的 CSSTransition（currentTime 恒 0）+ motion spring 使自动化稳定性检查永不通过（Playwright click 全量超时，screenshot/cua 间歇超时）。真实用户影响待评估，但性能重绘与可测性受损。
- **P1：useFormPersistence 未接线**（kv 空，prompt 刷新即丢；hook 已存在）。
- **P2：i18n 死键**（workspace.tabs.*、header.clearTasks 等已无引用）。
- **P2：`any` 残留** ImageLibrary.tsx:748（i18n options 参数）。
- **P2：抽屉标题重复**（"Image Library"/"API Settings" 在抽屉头与面板各出现一次，a11y 噪音）。
- **P2：移动端导航按钮文字折行**（图 08，视觉紧凑度欠佳）。

## 环境备注

- 走查期间 vite 触发过一次 `motion/react` 依赖优化重载（一次性 dev 行为，非产品问题）。
- 常驻进程：mock API PID 85324、vite PID 85342，保持运行供修复轮复审用，收尾时统一回收。
