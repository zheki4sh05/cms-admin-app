export type IntegrationConfigStatus = 'active' | 'inactive'

export type IntegrationConfig = {
  id: string
  number: number
  name: string
  updatedAt: string
  status: IntegrationConfigStatus
  authorName: string
}

export type IntegrationChangeHistoryEntry = {
  id: string
  changedAt: string
  configName: string
  description: string
  authorName: string
}

export type IntegrationChangeHistoryPage = {
  items: IntegrationChangeHistoryEntry[]
  hasMore: boolean
}
