# GitHub Actions 工作流

本目录包含 Claude Code 自动化工作流的文档和模板。

## 已部署的工作流

以下工作流已部署到 `.github/workflows/`：

### 1. PR 代码审查 (`claude-code-pr-review.yml`)

**触发时机**:
- PR 打开、更新或重新打开时
- PR 评论中包含 `@claude` 时

**功能**:
- 使用 `/code-audit` skill 审查 PR 改动
- 检查 Next.js 最佳实践、代码重复、组件一致性等
- 在 PR 评论中发布审查报告

**使用方式**:
```bash
# 自动触发：创建或更新 PR
# 手动触发：在 PR 评论中 @claude
```

---

### 2. Issue 自动分诊 (`claude-code-issue-triage.yml`)

**触发时机**:
- Issue 打开或重新打开时

**功能**:
- 自动分析 issue 类型、优先级、涉及模块
- 提供复现信息检查
- 建议合适的标签（仅建议，不自动添加）

**输出示例**:
```markdown
**分类**: bug
**优先级**: priority-high
**模块**: ui-consistency
**建议标签**: bug, priority-high, ui-consistency
```

---

### 3. 安全自动修复 (`claude-code-auto-fix.yml`)

**🔒 两阶段确认机制**

这个工作流采用两阶段确认机制，确保 AI 修复的安全性和可控性。

#### 阶段 1: 提出修复方案

**触发条件**:
- Issue 有 `auto-fix-approved` 标签（维护者添加）
- Issue 有 `ai-safe` 标签（表示简单安全的问题）
- Issue **没有** `fix-confirmed` 标签

**工作流程**:
1. Claude 分析 issue
2. 制定详细的修复方案
3. 在 issue 评论区发布方案，包括：
   - 问题分析
   - 具体修复步骤
   - 影响范围
   - 预期效果
   - 风险评估
4. 等待用户确认

**示例输出**:
```markdown
## 🤖 AI 修复方案

**问题**: 大量重复的投放状态检查逻辑

**方案**: 抽离到统一的工具函数

**具体步骤**:
1. 创建 `lib/utils/delivery-status.ts`
2. 实现统一的 `validateDeliveryStatus` 函数
3. 重构 3 个文件使用新函数

**预期效果**:
- ✅ 删除约 45 行重复代码
- ✅ 提高代码可维护性

**风险评估**: 低

---

**是否同意此修复方案？**

如果同意，请添加标签 `fix-confirmed`，我将自动开始修复。
如果不同意，请移除 `auto-fix-approved` 标签并说明调整要求。
```

#### 阶段 2: 执行修复

**触发条件**:
- Issue 有 `auto-fix-approved` 标签
- Issue 有 `ai-safe` 标签
- Issue 有 `fix-confirmed` 标签（用户确认）

**工作流程**:
1. 创建修复分支 `auto-fix/issue-{number}`
2. 按照评论中的方案执行修复
3. 运行 `pnpm tsc --noEmit` 验证
4. 提交更改
5. 推送分支
6. 创建草稿 PR
7. 在 issue 中评论 PR 链接

**安全限制**:
- ✅ 只能修复 import 排序、代码格式化等简单问题
- ❌ 不得修改业务逻辑
- ❌ 不得修改配置文件（.env, package.json）
- ❌ 不得删除超过 50 行代码
- ❌ 不得删除 console.log

---

## 使用指南

### 如何使用自动修复

1. **创建或发现一个简单的代码质量问题**
   ```bash
   # 例如：导入顺序混乱、代码格式不一致等
   ```

2. **添加标签触发阶段 1**
   ```bash
   # 在 issue 上添加两个标签：
   - auto-fix-approved（维护者权限）
   - ai-safe（表示这是简单安全的修复）
   ```

3. **查看 AI 提出的修复方案**
   - GitHub Actions 会在几分钟内运行
   - 在 issue 评论中查看详细的修复方案
   - 评估方案是否合理

4. **确认或拒绝方案**
   - ✅ **确认**：添加 `fix-confirmed` 标签 → 触发阶段 2 自动修复
   - ❌ **拒绝**：移除 `auto-fix-approved` 标签，在评论中说明调整要求

5. **Review 自动创建的 PR**
   - PR 默认为草稿状态
   - 仔细检查改动
   - 确认无误后标记为 Ready for review 并合并

### 标签说明

| 标签 | 添加者 | 含义 | 阶段 |
|------|--------|------|------|
| `auto-fix-approved` | 维护者 | 批准自动修复 | 必需 |
| `ai-safe` | 维护者 | 简单安全的问题 | 必需 |
| `fix-confirmed` | 用户 | 确认修复方案 | 阶段2 |

### 最佳实践

1. **仅对简单问题使用自动修复**
   - ✅ 代码格式、import 排序、简单重构
   - ❌ 复杂业务逻辑、架构调整

2. **始终 Review AI 提出的方案**
   - 不要盲目确认
   - 确保理解修复的影响范围

3. **始终 Review 自动创建的 PR**
   - 自动修复的 PR 仍需人工审查
   - 验证没有引入新问题

4. **逐步推进**
   - 先用于简单问题积累信任
   - 根据效果逐步扩大使用范围

---

## 配置要求

### GitHub Secrets

在仓库设置中添加以下 Secrets：

```bash
ANTHROPIC_API_KEY    # Anthropic API 密钥
ANTHROPIC_BASE_URL   # 自定义 API 地址（可选，如 https://co.yes.vg）
```

### 权限

工作流需要以下权限（已在 yml 中配置）：

```yaml
permissions:
  contents: write        # 创建分支、提交代码
  pull-requests: write   # 创建 PR、评论
  issues: write          # 评论 issue
```

---

## 故障排查

### 工作流没有触发

**检查项**:
1. 标签是否正确（区分大小写）
2. 是否配置了 GitHub Secrets
3. 查看 Actions 标签页的日志

### 修复失败

**可能原因**:
1. 问题过于复杂，超出 AI 能力范围
2. 代码依赖缺失或构建失败
3. 权限不足

**解决方案**:
- 查看 Actions 日志了解详情
- 对于复杂问题，改用手动修复
- 确保仓库配置正确

### PR 未创建

**检查项**:
1. 是否有代码改动（无改动不会创建 PR）
2. 分支是否成功推送到远程
3. GitHub token 是否有 PR 创建权限

---

## 工作流文件位置

所有工作流文件位于：
```
.github/workflows/
├── claude-code-pr-review.yml        # PR 审查
├── claude-code-issue-triage.yml     # Issue 分诊
└── claude-code-auto-fix.yml         # 两阶段自动修复
```

## 相关文档

- [Claude Code 官方文档](https://docs.anthropic.com/claude/docs/claude-code)
- [claude-code-action](https://github.com/anthropics/claude-code-action)
- [issue-manager Skill](../SKILL.md)
- [code-audit Skill](../../code-audit/SKILL.md)
