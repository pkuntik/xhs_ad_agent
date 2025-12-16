// ============ 表单类型 ============

export type PromotionGoal = '笔记阅读量' | '点赞收藏量' | '私信咨询量' | '粉丝关注量' | '主页浏览量' | '直播观看量';

export type AudienceType = '智能推荐' | '自定义人群';

export type Gender = '不限' | '男' | '女';

export type AgeRange = '不限' | '18-23' | '24-30' | '31-40' | '41-50' | '大于50岁';

export type ContentScene = '产品种草' | '引流咨询' | '个人IP打造' | '知识干货' | '服务推广';

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
  additionalInfo?: string;
  audienceType: AudienceType;
  customAudience?: CustomAudience;
  generationOptions?: GenerationOptions;
}

// ============ 生成结果类型 ============

export type ImageFeedback = 'like' | 'dislike' | null;

export interface ImagePlan {
  index: number;
  type: string;
  content: string;
  overlay: string;
  tips: string;
  imageUrl?: string;
  imagePrompt?: string;
  feedback?: ImageFeedback;
  chuangkitDesignId?: string;  // 创客贴设计稿 ID，用于保留图层信息
}

export interface GenerationResult {
  positioning: {
    contentType: string;
    targetAudience: string;
    tone: string;
    keywords: string[];
  };
  cover?: {
    type: string;
    mainVisual: string;
    copywriting: string;
    textPosition: string;
    colorScheme: string;
    designTips: string;
    imageUrl?: string;
    imagePrompt?: string;
    feedback?: ImageFeedback;
    chuangkitDesignId?: string;  // 创客贴设计稿 ID，用于保留图层信息
  };
  title?: {
    text: string;
    highlight: string;
  };
  content?: {
    body: string;
    wordCount: number;
    structure: string;
  };
  images?: ImagePlan[];
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
