import { readFileSync } from 'fs';
import path from 'path';
import type { CreationFormData, LearningData } from '@/types/creation';

// 读取小红书生成器提示词
const XHS_PROMPT = readFileSync(
  path.join(process.cwd(), 'prompts', '小红书图文内容生成器.md'),
  'utf-8'
);

function buildLearningContext(learningData?: LearningData): string {
  if (!learningData) return '';

  const parts: string[] = [];

  // 添加喜欢的案例
  if (learningData.goodExamples.length > 0) {
    const examples = learningData.goodExamples.slice(-5).map((ex, i) => {
      const typeLabel = ex.type === 'title' ? '标题' :
                        ex.type === 'content' ? '正文' :
                        ex.type === 'image' ? '配图' : '完整内容';
      return `  ${i + 1}. [${typeLabel}] ${ex.content.substring(0, 300)}${ex.content.length > 300 ? '...' : ''}`;
    }).join('\n');
    parts.push(`【我喜欢的风格示例】\n${examples}`);
  }

  // 添加不喜欢的案例
  if (learningData.badExamples.length > 0) {
    const examples = learningData.badExamples.slice(-3).map((ex, i) => {
      const typeLabel = ex.type === 'title' ? '标题' :
                        ex.type === 'content' ? '正文' :
                        ex.type === 'image' ? '配图' : '完整内容';
      return `  ${i + 1}. [${typeLabel}] ${ex.content.substring(0, 200)}${ex.content.length > 200 ? '...' : ''}`;
    }).join('\n');
    parts.push(`【我不喜欢的风格，请避免】\n${examples}`);
  }

  // 添加参考素材
  if (learningData.references.length > 0) {
    const refs = learningData.references.slice(-5).map((ref, i) => {
      const desc = ref.description ? `[${ref.description}] ` : '';
      return `  ${i + 1}. ${desc}${ref.content.substring(0, 500)}${ref.content.length > 500 ? '...' : ''}`;
    }).join('\n');
    parts.push(`【我的参考素材】\n${refs}`);
  }

  if (parts.length === 0) return '';

  return '\n\n---\n## 我的偏好和参考素材\n\n' + parts.join('\n\n');
}

/**
 * 构建系统提示词
 */
export function buildSystemPrompt() {
  return [
    {
      type: "text" as const,
      text: "You are Claude Code, Anthropic's official CLI for Claude.",
      cache_control: { type: "ephemeral" as const }
    },
    {
      type: "text" as const,
      text: XHS_PROMPT,
      cache_control: { type: "ephemeral" as const }
    }
  ];
}

/**
 * 构建用户消息
 */
export function buildUserMessage(formData: CreationFormData, learningData?: LearningData): string {
  const userInfoLines = [
    `- 我想提升: ${formData.promotionGoal}`,
    `- 选题方向/关键词: ${formData.topic}`,
    `- 内容场景: ${formData.contentScene}`,
    `- 推广给谁: ${formData.audienceType}`,
  ];

  if (formData.additionalInfo?.trim()) {
    userInfoLines.push(`- 补充说明: ${formData.additionalInfo}`);
  }

  if (formData.audienceType === '自定义人群' && formData.customAudience) {
    userInfoLines.push(`  - 性别: ${formData.customAudience.gender}`);

    if (formData.customAudience.ageRanges.length > 0) {
      userInfoLines.push(`  - 年龄: ${formData.customAudience.ageRanges.join('、')}`);
    }

    if (formData.customAudience.location) {
      userInfoLines.push(`  - 特定地域: ${formData.customAudience.location}`);
    }
    if (formData.customAudience.interests) {
      userInfoLines.push(`  - 特定兴趣偏好: ${formData.customAudience.interests}`);
    }
  }

  const userInfo = userInfoLines.join('\n');
  const learningContext = buildLearningContext(learningData);

  // 构建生成选项说明
  let generationOptionsText = '';
  if (formData.generationOptions) {
    const options = formData.generationOptions;
    const enabledOptions: string[] = [];
    const disabledOptions: string[] = [];

    if (options.cover) enabledOptions.push('封面(cover)');
    else disabledOptions.push('封面(cover)');

    if (options.title) enabledOptions.push('标题(title)');
    else disabledOptions.push('标题(title)');

    if (options.content) enabledOptions.push('正文(content)');
    else disabledOptions.push('正文(content)');

    if (options.images) enabledOptions.push('配图(images)');
    else disabledOptions.push('配图(images)');

    if (options.comments) enabledOptions.push('评论区(comments)');
    else disabledOptions.push('评论区(comments)');

    if (options.topics) enabledOptions.push('话题(topics)');
    else disabledOptions.push('话题(topics)');

    if (options.privateMessage) enabledOptions.push('私信(privateMessage)');
    else disabledOptions.push('私信(privateMessage)');

    if (disabledOptions.length > 0) {
      generationOptionsText = `\n\n【生成选项】\n请只生成以下内容：${enabledOptions.join('、')}\n不需要生成：${disabledOptions.join('、')}`;
    }
  }

  return `请根据我的需求生成小红书图文内容方案：

${userInfo}${learningContext}${generationOptionsText}

重要要求：严格按照 JSON 格式输出`;
}
