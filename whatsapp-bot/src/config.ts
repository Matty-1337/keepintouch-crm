import dotenv from 'dotenv'
import path from 'path'
import type { BotConfig } from './types'

dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

export function loadConfig(): BotConfig {
  return {
    scanIntervalMinutes: parseInt(process.env.SCAN_INTERVAL_MINUTES || '30', 10),
    scanLookbackHours: parseInt(process.env.SCAN_LOOKBACK_HOURS || '24', 10),
    monitoredChats: (process.env.MONITORED_CHATS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    haleyWhatsAppJid: process.env.HALEY_WHATSAPP_JID || '',
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openrouterDefaultModel: process.env.OPENROUTER_DEFAULT_MODEL || 'glm-4.7',
    openrouterFallbackModel: process.env.OPENROUTER_FALLBACK_MODEL || 'deepseek/deepseek-chat-v3.2',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
    projectOpsApiUrl: process.env.PROJECT_OPS_API_URL || 'https://project-ops-mcp-production.up.railway.app',
    projectOpsApiKey: process.env.PROJECT_OPS_API_KEY || '',
    crmApiUrl: process.env.CRM_API_URL || '',
    crmApiKey: process.env.CRM_API_KEY || '',
    logLevel: process.env.LOG_LEVEL || 'info',
  }
}

export function updateMonitoredChats(jids: string[]): void {
  // Update the in-memory config; for persistence, write to .env
  process.env.MONITORED_CHATS = jids.join(',')
}
