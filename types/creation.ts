// ============ 表单类型 ============

export type PromotionGoal = '笔记阅读量' | '点赞收藏量' | '私信咨询量' | '粉丝关注量' | '主页浏览量' | '直播观看量';

export type AudienceType = '智能推荐' | '自定义人群';

export type Gender = '不限' | '男' | '女';

export type AgeRange = '不限' | '18-23' | '24-30' | '31-40' | '41-50' | '大于50岁';

export type ContentScene = '产品种草' | '引流咨询' | '个人IP打造' | '知识干货' | '服务推广';

export type ContentLength = '短' | '中' | '长';

export interface CustomAudience {
  gender: Gender;
  ageRanges: AgeRange[];
  location?: string;
  interests?: string;
}

export interface GenerationOptions {
  cover: boolean;
  title: boolean;
  content: boolean;
  images: boolean;
  comments: boolean;
  topics: boolean;
  privateMessage: boolean;
}

export const DEFAULT_GENERATION_OPTIONS: GenerationOptions = {
  cover: true,
  title: true,
  content: true,
  images: true,
  comments: true,
  topics: true,
  privateMessage: false,
};

export interface CreationFormData {
  promotionGoal: PromotionGoal;
  topic: string;
  contentScene: ContentScene;
  contentLength?: ContentLength;  // 正文长度：短(200-300字)、中(400-600字)、长(800-1000字)
  additionalInfo?: string;
  audienceType: AudienceType;
  customAudience?: CustomAudience;
  generationOptions?: GenerationOptions;
}

// ============ 生成结果类型 ============

export type ImageFeedback = 'like' | 'dislike' | null;

// 统一的图片规划结构（封面和配图共用）
export interface ImagePlan {
  index: number;           // 图片序号（封面为1，配图从2开始）
  type: string;            // 图片类型
  content: string;         // 内容描述
  overlay?: string;        // 文字叠加（可选）
  colorScheme?: string;    // 配色方案（可选）
  tips?: string;           // 设计建议（可选）
  imageUrl?: string;
  imagePrompt?: string;
  feedback?: ImageFeedback;
  chuangkitDesignId?: string;  // 创客贴设计稿 ID
}

export interface GenerationResult {
  positioning: {
    contentType: string;
    targetAudience: string;
    tone: string;
    keywords: string[];
  };
  cover?: ImagePlan;       // 封面（index 固定为 1）
  title?: {
    text: string;
    highlight: string;
  };
  content?: {
    body: string;
    structure: string;
  };
  images?: ImagePlan[];    // 配图（index 从 2 开始）
  comments?: {
    pinnedComment: string;
    qaList: Array<{
      question: string;
      answer: string;
    }>;
  };
  topics?: {
    tags: string[];
    reason: string;
  };
  privateMessage?: {
    greeting: string;
    templates: Array<{
      scenario: string;
      message: string;
    }>;
  };
}

// ============ 学习数据类型 ============

export interface LearningExample {
  id: string;
  type: 'title' | 'content' | 'image' | 'full';
  content: string;
  feedback: 'like' | 'dislike';
  createdAt: string;
}

export interface Reference {
  id: string;
  type: 'text' | 'image';
  content: string;
  description?: string;
  createdAt: string;
}

export interface LearningData {
  goodExamples: LearningExample[];
  badExamples: LearningExample[];
  references: Reference[];
}

// ============ 创作历史类型 ============

export interface CreationHistory {
  _id: string;
  formData: CreationFormData;
  result: GenerationResult;
  title: string;  // 用于显示的标题（从 result.title.text 提取）
  createdAt: Date;
}
