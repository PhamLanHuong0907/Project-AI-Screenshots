import { z } from 'zod'
import { sanitizeCategoryPath, sanitizeFilename } from './fileUtils'

/**
 * Zod schema for validating the structured output returned by OpenAI Vision API (REQ02 & REQ03).
 */
export const AIAnalysisResponseSchema = z.object({
  suggestedName: z
    .string()
    .min(1, 'Suggested filename must not be empty')
    .transform((val) => sanitizeFilename(val)),
  category: z
    .string()
    .min(1, 'Category must not be empty')
    .transform((val) => sanitizeCategoryPath(val)),
  description: z.string().min(1, 'Description must not be empty').max(1000),
  tags: z
    .array(z.string().min(1).max(50))
    .min(1, 'At least one tag is required')
    .max(15)
    .transform((tags) => Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)))),
  confidence: z.number().min(0).max(1)
})

export type ValidatedAIAnalysis = z.infer<typeof AIAnalysisResponseSchema>

/**
 * Strict raw schema used with OpenAI Structured Outputs (`zodTextFormat`)
 * before post-processing transforms.
 */
export const OpenAIStructuredOutputSchema = z.object({
  suggestedName: z
    .string()
    .describe(
      'Short, meaningful filename in English ASCII following Category_Topic_Description format with underscores, max 60 chars, no extension.'
    ),
  category: z
    .string()
    .describe(
      'Category folder path such as Programming/React, Data-Analytics/Excel, Data-Analytics/PowerBI, Database/ERD, Big-Data/Hadoop, Design/UI-UX, Education/Lecture, Office/Documents, or Others.'
    ),
  description: z
    .string()
    .describe('Concise, accurate Vietnamese description of what is visible in the screenshot.'),
  tags: z
    .array(z.string())
    .describe('3 to 6 relevant keywords or technology tags describing the screenshot.'),
  confidence: z
    .number()
    .describe('Confidence score between 0.0 and 1.0 indicating certainty of the analysis.')
})

/**
 * IPC Payload Validation Schemas (Section 4.5 & Section 9 & Section 12).
 */
export const IpcIdSchema = z.string().min(1, 'Screenshot ID is required').max(128)

export const ConfirmScreenshotSchema = z.object({
  id: IpcIdSchema,
  finalName: z
    .string()
    .min(1, 'Filename cannot be empty')
    .max(100)
    .transform((val) => sanitizeFilename(val)),
  category: z
    .string()
    .min(1, 'Category cannot be empty')
    .max(120)
    .transform((val) => sanitizeCategoryPath(val)),
  description: z.string().max(2000).default(''),
  tags: z
    .array(z.string().max(50))
    .max(25)
    .default([])
    .transform((tags) => Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean))))
})

export const UpdateScreenshotSchema = z.object({
  id: IpcIdSchema,
  suggestedName: z
    .string()
    .min(1)
    .max(100)
    .transform((val) => sanitizeFilename(val))
    .optional(),
  category: z
    .string()
    .min(1)
    .max(120)
    .transform((val) => sanitizeCategoryPath(val))
    .optional(),
  description: z.string().max(2000).optional(),
  tags: z
    .array(z.string().max(50))
    .max(25)
    .transform((tags) => Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean))))
    .optional()
})

export const SearchScreenshotsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  category: z.string().max(120).optional(),
  tag: z.string().max(60).optional(),
  dateFrom: z.string().max(40).optional(),
  dateTo: z.string().max(40).optional(),
  status: z
    .enum(['pending', 'analyzing', 'review', 'approved', 'saved', 'rejected', 'failed', 'all'])
    .optional()
})

export const UpdateSettingsSchema = z.object({
  sourceFolder: z.string().min(1).max(500).optional(),
  destinationFolder: z.string().min(1).max(500).optional(),
  aiProvider: z.enum(['openai', 'gemini', 'claude', 'tesseract', 'ollama']).optional(),
  aiModel: z.string().min(1).max(100).optional(),
  ollamaBaseUrl: z.string().max(500).optional(),
  customCategories: z.array(z.string().min(1).max(120)).max(100).optional(),
  useDefaultCategories: z.boolean().optional(),
  useClaudeCodeCli: z.boolean().optional(),
  autoApplyRename: z.boolean().optional(),
  organizeMode: z.enum(['category_folders', 'rename_in_place']).optional(),
  deleteSourceOnConfirm: z.boolean().optional(),
  watchClipboard: z.boolean().optional(),
  openaiApiKey: z.string().max(500).optional(),
  geminiApiKey: z.string().max(500).optional(),
  claudeApiKey: z.string().max(500).optional(),
  clearApiKey: z.boolean().optional(),
  clearProviderKey: z.enum(['openai', 'gemini', 'claude', 'tesseract', 'ollama']).optional(),
  maxImageSizeMB: z.number().min(1).max(100).optional(),
  autoMonitorOnStartup: z.boolean().optional(),
  startMinimized: z.boolean().optional(),
  enableNotifications: z.boolean().optional(),
  maxConcurrency: z.number().int().min(1).max(10).optional(),
  theme: z.enum(['light', 'dark']).optional()
})
