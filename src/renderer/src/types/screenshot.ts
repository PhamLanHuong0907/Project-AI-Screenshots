export type ScreenshotStatus =
  | 'pending'
  | 'analyzing'
  | 'review'
  | 'approved'
  | 'saved'
  | 'rejected'
  | 'failed'

export type AIProvider = 'openai' | 'gemini' | 'claude' | 'tesseract' | 'ollama'

export type OrganizeMode = 'category_folders' | 'rename_in_place'

export interface ModelOption {
  id: string
  label: string
  provider: AIProvider
  description: string
}

export const AI_PROVIDER_MODELS: Record<AIProvider, ModelOption[]> = {
  ollama: [
    {
      id: 'moondream',
      label: 'Moondream (moondream:latest) — Siêu nhẹ & Nhanh',
      provider: 'ollama',
      description: 'Model Vision siêu nhỏ gọn (~1.7B), chạy cực nhanh trên CPU và mọi GPU'
    },
    {
      id: 'minicpm-v',
      label: 'MiniCPM-V (minicpm-v:latest) — Đa phương thức xuất sắc',
      provider: 'ollama',
      description: 'Hiểu văn bản chi tiết, OCR bảng biểu, code và hình ảnh độ phân giải cao'
    },
    {
      id: 'llama3.2-vision',
      label: 'Llama 3.2 Vision (llama3.2-vision:latest) — Meta AI',
      provider: 'ollama',
      description: 'Model thị giác thế hệ mới nhất của Meta (11B), độ chính xác nhận diện rất cao'
    }
  ],
  tesseract: [
    {
      id: 'vie+eng',
      label: 'Tesseract OCR: Tiếng Việt + English (Khuyên dùng)',
      provider: 'tesseract',
      description: 'Nhận diện văn bản trên ảnh offline 100%, không cần API Key, tự động sinh tên và phân loại'
    },
    {
      id: 'eng',
      label: 'Tesseract OCR: English Only',
      provider: 'tesseract',
      description: 'Nhận diện nhanh tiếng Anh offline trên máy'
    },
    {
      id: 'vie',
      label: 'Tesseract OCR: Tiếng Việt',
      provider: 'tesseract',
      description: 'Nhận diện tiếng Việt có dấu offline trên máy'
    }
  ],
  gemini: [
    {
      id: 'gemini-4-argon',
      label: 'Gemini 4 Argon (Medium / High) — Antigravity Flagship',
      provider: 'gemini',
      description: 'Model Gemini thế hệ 4 mới nhất'
    },
    {
      id: 'gemini-4-hydrogen',
      label: 'Gemini 4 Hydrogen (Medium) — New',
      provider: 'gemini',
      description: 'Model Gemini 4 Hydrogen đa phương thức thế hệ mới'
    },
    {
      id: 'gemini-3.8-flash',
      label: 'Gemini 3.8 Flash (Low) — High Speed',
      provider: 'gemini',
      description: 'Tốc độ cực nhanh, phân tích hình ảnh & đổi tên tức thì'
    },
    {
      id: 'gemini-2.5-flash',
      label: 'Gemini 2.5 Flash (Google AI Studio Free Tier)',
      provider: 'gemini',
      description: 'Model chính thức hỗ trợ trên tất cả Google AI Studio API Key (Free & Pay-as-you-go)'
    },
    {
      id: 'gemini-2.5-pro',
      label: 'Gemini 2.5 Pro (Google AI Studio)',
      provider: 'gemini',
      description: 'Chuyên sâu bảng tính Excel, dashboard PowerBI, code phức tạp'
    },
    {
      id: 'gemini-2.5-flash-lite',
      label: 'Gemini 2.5 Flash-Lite (Google AI Studio)',
      provider: 'gemini',
      description: 'Độ trễ siêu thấp, tiết kiệm quota API Studio'
    }
  ],
  claude: [
    {
      id: 'claude-opus-5-5',
      label: 'Claude Opus 5.5 (Medium / High) — Newest Flagship',
      provider: 'claude',
      description: 'Model Claude Opus 5.5 tư duy & nhận diện hình ảnh đỉnh cao'
    },
    {
      id: 'claude-sonnet-5-5',
      label: 'Claude Sonnet 5.5 (Medium) — High Accuracy',
      provider: 'claude',
      description: 'Model Claude Sonnet 5.5 thế hệ mới chuyên sâu code & UI'
    },
    {
      id: 'sonnet',
      label: 'Claude Code CLI: Sonnet (claude.exe)',
      provider: 'claude',
      description: 'Chạy qua CLI Claude Code nội bộ trên máy không cần API key'
    },
    {
      id: 'claude-3-7-sonnet-latest',
      label: 'Claude 3.7 Sonnet (Anthropic API)',
      provider: 'claude',
      description: 'Model Anthropic API chính thức'
    }
  ],
  openai: [
    {
      id: 'gpt-4o-mini',
      label: 'GPT-4o Mini (Recommended)',
      provider: 'openai',
      description: 'Fast & cost-effective OpenAI Vision model'
    },
    {
      id: 'gpt-4o',
      label: 'GPT-4o',
      provider: 'openai',
      description: 'High-precision OpenAI multimodal flagship'
    },
    {
      id: 'gpt-4.1-mini',
      label: 'GPT-4.1 Mini',
      provider: 'openai',
      description: 'Latest fast multimodal GPT-4.1 Mini'
    },
    {
      id: 'gpt-4.1',
      label: 'GPT-4.1',
      provider: 'openai',
      description: 'Latest flagship multimodal GPT-4.1'
    }
  ]
}

export interface ScreenshotRecord {
  id: string
  original_name: string
  original_path: string
  file_hash: string
  suggested_name: string
  final_name: string
  category: string
  description: string
  tags: string[]
  confidence: number
  status: ScreenshotStatus
  final_path: string
  error_message?: string
  file_size?: number
  width?: number
  height?: number
  is_duplicate?: boolean
  duplicate_of_id?: string | null
  created_at: string
  updated_at: string
}

export interface AIAnalysisResult {
  suggestedName: string
  category: string
  description: string
  tags: string[]
  confidence: number
}

export interface DashboardStats {
  total: number
  pendingReview: number
  analyzing: number
  saved: number
  failed: number
  rejected: number
  recentScreenshots: ScreenshotRecord[]
  categoryDistribution: Array<{
    category: string
    count: number
  }>
}

export interface ProviderKeyInfo {
  hasKey: boolean
  source: 'safeStorage' | 'env' | 'local' | 'cli' | 'none'
}

export interface AppSettings {
  sourceFolder: string
  destinationFolder: string
  aiProvider: AIProvider
  aiModel: string
  ollamaBaseUrl?: string
  customCategories?: string[]
  useDefaultCategories: boolean
  useClaudeCodeCli: boolean
  claudeCliAvailable: boolean
  claudeCliPath: string
  autoApplyRename: boolean
  organizeMode: OrganizeMode
  deleteSourceOnConfirm: boolean
  watchClipboard: boolean
  maxImageSizeMB: number
  autoMonitorOnStartup: boolean
  startMinimized: boolean
  enableNotifications: boolean
  maxConcurrency: number
  theme: 'light' | 'dark'
  hasApiKey: boolean
  apiKeySource: 'safeStorage' | 'env' | 'local' | 'cli' | 'none'
  providerKeys: Record<AIProvider, ProviderKeyInfo>
  isMonitoring: boolean
}

export interface UpdateSettingsPayload {
  sourceFolder?: string
  destinationFolder?: string
  aiProvider?: AIProvider
  aiModel?: string
  ollamaBaseUrl?: string
  customCategories?: string[]
  useDefaultCategories?: boolean
  useClaudeCodeCli?: boolean
  autoApplyRename?: boolean
  organizeMode?: OrganizeMode
  deleteSourceOnConfirm?: boolean
  watchClipboard?: boolean
  openaiApiKey?: string
  geminiApiKey?: string
  claudeApiKey?: string
  clearApiKey?: boolean
  clearProviderKey?: AIProvider
  maxImageSizeMB?: number
  autoMonitorOnStartup?: boolean
  startMinimized?: boolean
  enableNotifications?: boolean
  maxConcurrency?: number
  theme?: 'light' | 'dark'
}

export interface ConfirmScreenshotPayload {
  id: string
  finalName: string
  category: string
  description: string
  tags: string[]
}

export interface UpdateScreenshotPayload {
  id: string
  suggestedName?: string
  category?: string
  description?: string
  tags?: string[]
}

export interface SearchScreenshotsQuery {
  search?: string
  category?: string
  tag?: string
  dateFrom?: string
  dateTo?: string
  status?: ScreenshotStatus | 'all'
}

export interface ValidationResult {
  valid: boolean
  message: string
  model?: string
  provider?: AIProvider
}

export interface WatcherStatusEvent {
  isMonitoring: boolean
  sourceFolder: string
  error?: string
}

export const DEFAULT_CATEGORIES = [
  'Programming/React',
  'Programming/Java',
  'Programming/Python',
  'Programming/TypeScript',
  'Programming/Web-Development',
  'Data-Analytics/Excel',
  'Data-Analytics/PowerBI',
  'Data-Analytics/Tableau',
  'Data-Analytics/SQL',
  'Database/ERD',
  'Database/SQL',
  'Database/Database-Design',
  'Big-Data/Hadoop',
  'Big-Data/Spark',
  'Big-Data/Hive',
  'Big-Data/Sqoop',
  'Design/UI-UX',
  'Design/Architecture',
  'Design/Diagram',
  'Education/Lecture',
  'Education/Assignment',
  'Education/Research',
  'Office/Documents',
  'Office/Reports',
  'Others'
] as const
