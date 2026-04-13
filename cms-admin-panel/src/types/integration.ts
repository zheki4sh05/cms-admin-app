export type IntegrationConfigStatus = 'active' | 'inactive'

export type IntegrationConfig = {
  id: string
  number: number
  name: string
  updatedAt: string
  status: IntegrationConfigStatus
  authorName: string
}

export type IntegrationConfigListPage = {
  items: IntegrationConfig[]
  hasMore: boolean
}

export type IntegrationChangeHistoryEntry = {
  id: string
  integrationId?: string
  changedAt: string
  configName: string
  description: string
  authorName: string
}

export type IntegrationChangeHistoryPage = {
  items: IntegrationChangeHistoryEntry[]
  hasMore: boolean
}

export type IntegrationMappingRule = {
  from: string
  to: string
  transform?: string
}

export type IntegrationDetails = {
  id: string
  number: number
  name: string
  integrationKind: 'pull' | 'push' | 'broker'
  endpointUrl: string
  riskObjectModelId: string
  mapping_rules: IntegrationMappingRule[]
  status: IntegrationConfigStatus
  authorName: string
  updatedAt: string
}

export type IntegrationUpdatePayload = {
  name: string
  integrationKind: 'pull' | 'push' | 'broker'
  endpointUrl: string
  riskObjectModelId: string
  mapping_rules: IntegrationMappingRule[]
}

export type IntegrationUpdateResponse = {
  id: string
  savedAt: string
}

export type IntegrationStatusUpdatePayload = {
  status: IntegrationConfigStatus
}
