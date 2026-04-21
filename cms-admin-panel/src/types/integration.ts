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

export type PullPollingPreset = 'hour' | 'day' | 'month' | 'minutes'

export type PullRequestQueryParam = {
  key: string
  value: string
}

export type PullIntegrationConfig = {
  pollingPreset: PullPollingPreset
  pollingMinutes?: number
  authType: 'basic'
  authBasicLogin?: string
  authBasicPassword?: string
  requestUri?: string
  requestQueryParams?: PullRequestQueryParam[]
  pagedPollingEnabled?: boolean
  pagingOffsetParamKey?: string
  pagingLimitParamKey?: string
  pageSize?: number
  sinceStartDateEnabled?: boolean
}

export type IntegrationDetails = {
  id: string
  number: number
  name: string
  integrationKind: 'pull' | 'push' | 'broker'
  endpointUrl: string
  riskObjectModelId: string
  mapping_rules: IntegrationMappingRule[]
  pullConfig?: PullIntegrationConfig
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
  pullConfig?: PullIntegrationConfig
}

export type IntegrationUpdateResponse = {
  id: string
  savedAt: string
}

export type IntegrationDeleteResponse = {
  id: string
  deletedAt: string
}

export type IntegrationStatusUpdatePayload = {
  status: IntegrationConfigStatus
}
