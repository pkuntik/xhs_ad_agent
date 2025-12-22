# GitHub Actions 自动化工作流（使用 Claude Code）

## ⚠️ 重要说明

这些工作流使用 **Claude Code 官方 GitHub Action** (`anthropics/claude-code-action@v1`)。

与之前版本的主要区别：
- ✅ 使用官方 Action，更安全、更可靠
- ✅ 支持自然语言 prompt，可以直接调用 Skills
- ✅ 自动处理评论发布和权限管理
- ✅ 内置安全防护（Prompt Injection 防护等）

## 工作流文件

### 1. claude-code-pr-review.yml - PR 代码审查

**触发方式**：
- 创建、更新 PR 时自动运行
- 在 PR 评论中 `@claude` 也可以触发

**功能**：
- 调用 `/code-audit` skill 审查代码
- 自动发布审查结果到 PR 评论
- 检测 Next.js 最佳实践、代码重复、组件一致性等

**所需 Secret**：
- `ANTHROPIC_API_KEY`：你的 Claude API Key

### 2. claude-code-issue-triage.yml - Issue 自动分诊

**触发方式**：
- Issue 创建或重新打开时自动运行

**功能**：
- 分析 issue 类型（bug / enhancement / documentation）
- 评估优先级
- 识别涉及的模块
- 检查复现信息完整性
- **建议**标签（不会自动添加，需要维护者确认）

**所需 Secret**：
- `ANTHROPIC_API_KEY`

### 3. claude-code-auto-fix.yml - 安全自动修复

**触发方式**：
- Issue 被添加标签时检查
- **必须同时有** `auto-fix-approved` 和 `ai-safe` 标签才会执行

**功能**：
- 🔒 双重锁定机制（需要维护者手动批准）
- 仅修复简单、低风险的问题（console.log、import 排序等）
- 创建**草稿 PR**，需要人工 review
- 运行类型检查验证修复

**所需 Secret**：
- `ANTHROPIC_API_KEY`

## 安全设计

### 防止 Prompt Injection

1. **标签锁定**：自动修复需要维护者手动添加两个标签
2. **草稿 PR**：自动修复的 PR 默认是草稿状态
3. **限制范围**：在 prompt 中明确限制不能修改的内容
4. **最小权限**：每个工作流只申请必需的权限

### 推荐的额外安全措施

1. **配置 CODEOWNERS**：
   ```
   # .github/CODEOWNERS
   * @your-team
   ```

2. **启用 Branch Protection**：
   - 要求 PR review
   - 要求 CI 通过
   - 不允许直接推送到 main

3. **使用 GitHub App Token**（可选）：
   如果想让自动创建的 PR 触发 CI，需要用 GitHub App token 替换 `GITHUB_TOKEN`

## 安装步骤

### 1. 设置 API Key

在 GitHub 仓库设置中添加 Secret：

```
Settings → Secrets and variables → Actions → New repository secret
```

名称：`ANTHROPIC_API_KEY`
值：你的 Claude API Key

### 2. 复制工作流文件

将以下文件复制到 `.github/workflows/`：

```bash
mkdir -p .github/workflows
cp .claude/skills/issue-manager/workflows/claude-code-*.yml .github/workflows/
```

### 3. 启用工作流

提交并推送：

```bash
git add .github/workflows/
git commit -m "feat: 添加 Claude Code 自动化工作流"
git push
```

### 4. 测试

- **测试 PR 审查**：创建一个测试 PR，观察 Claude 的评论
- **测试 Issue 分诊**：创建一个测试 issue，查看分类建议
- **测试自动修复**：
  1. 创建一个 issue 描述简单问题（如"清理 console.log"）
  2. 维护者添加 `auto-fix-approved` 和 `ai-safe` 标签
  3. 等待 Claude 创建草稿 PR
  4. Review 并合并（或关闭）

## 使用指南

### PR 审查

创建 PR 后，Claude 会自动审查并评论。你也可以：

```
在 PR 评论中：@claude 请重点检查性能问题
```

### Issue 分诊

Issue 创建后，Claude 会自动分析并评论建议。维护者根据建议手动添加标签。

### 安全自动修复流程

1. 用户创建 issue 描述简单问题
2. 维护者审核：
   - ✅ 确认问题简单、低风险
   - ✅ 添加 `auto-fix-approved` 标签
   - ✅ 添加 `ai-safe` 标签
3. Claude 自动修复并创建草稿 PR
4. 维护者 review 草稿 PR
5. 合并或关闭 PR

## 与之前版本的对比

| 特性 | 之前的版本（纯 bash） | 现在的版本（Claude Code） |
|------|---------------------|------------------------|
| 使用方式 | 硬编码 bash 脚本 | 自然语言 prompt + Skills |
| 灵活性 | 低（需要改 bash） | 高（改 prompt 即可） |
| 安全性 | 需要手动实现 | 官方内置防护 |
| 审查质量 | 基础检查 | 深度 AI 分析 |
| 维护成本 | 高 | 低 |

## 故障排查

### 工作流没有运行

- 检查 `.github/workflows/` 下是否有 yml 文件
- 检查权限设置是否正确
- 查看 Actions 标签页的错误日志

### Claude 没有评论

- 确认 `ANTHROPIC_API_KEY` 已正确设置
- 检查 API Key 是否有效、有额度
- 查看工作流日志

### 自动修复没有触发

- 确认同时添加了 `auto-fix-approved` 和 `ai-safe` 两个标签
- 检查工作流的 `if` 条件

## 相关资源

- [Claude Code GitHub Actions 官方文档](https://code.claude.com/docs/en/github-actions)
- [Claude Code Skills 文档](https://code.claude.com/docs/en/skills)
- [GitHub Actions 安全最佳实践](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
