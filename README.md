# 小红书自动投放系统（梳理版）

## 项目简介
- 基于 Next.js 15 的全栈应用，用于管理小红书广告投放、账号托管与 AI 创作。以 pnpm 作为包管理器，内置开发/构建/启动/lint 脚本便于运行。 

## 核心功能概览
- **仪表盘总览**：汇总账户余额、托管账号数以及活跃投放计划，并按卡片展示今日消耗、展现、点击、咨询等核心指标。活跃计划会以列表形式呈现预算与出价，便于快速掌握整体投放状态。【F:app/(dashboard)/page.tsx†L9-L155】
- **账号管理**：支持在添加账号前校验并预览小红书 Cookie，拒绝重复账号；持久化存储后可查询列表/详情，并保持敏感字段不回传客户端。【F:actions/account.ts†L22-L87】
- **账户入库与托管配置**：新建账号时记录日预算、默认出价和阈值，创建成功会触发页面重新验证。后续可通过开关切换自动托管状态，并更新 cookie、余额等同步字段。【F:actions/account.ts†L89-L120】
- **投放计划管理**：提供计划列表查询（支持按账号、作品、状态过滤）和单计划详情拉取，创建记录时会写入预算、出价、定向和批次信息并刷新投放列表。【F:actions/campaign.ts†L9-L54】【F:actions/campaign.ts†L56-L88】
- **AI 创作**：基于 Anthropic 客户端按用户输入组装 System/User Prompt，使用流式消息生成小红书笔记内容，并尝试解析 JSON；同时支持调用 Gemini API 按封面/正文需求生成图片并返回图片地址。【F:actions/creation.ts†L8-L70】【F:actions/creation.ts†L73-L109】

## 目录速览
- `/app`：Next.js 前端与路由，`(dashboard)` 下包含仪表盘、账号、投放、创作等业务页面。
- `/actions`：Server Actions，封装账号、计划、创作、素材等核心服务端逻辑。
- `/lib` 与 `/types`：封装通用工具、第三方客户端与类型定义。

## 运行方式
1. 安装依赖：`pnpm install`
2. 启动开发环境：`pnpm dev`
3. 生产构建与启动：`pnpm build && pnpm start`
4. 代码检查：`pnpm lint`
