export type RiskCategory =
  | 'financial'
  | 'reputational'
  | 'operational'

export type RiskItem = {
  id: string
  category: RiskCategory
  name: string
  description: string
  riskObjectId: string
}

export type RiskCreatePayload = {
  category: RiskCategory
  name: string
  description: string
  riskObjectId?: string
}

export type RiskCreateResponse = {
  id: string
  savedAt: string
}

export type RuleCreatePayload = {
  name: string
  condition: string
  categoryId: string
  riskObjectId?: string
  priority: 'low' | 'medium' | 'high'
  responsibleUserId?: string
  actions: Array<'createIncident' | 'sendNotification'>
  enabled: boolean
  mechanismScriptName?: string
  mechanismScriptContent?: string
}

export type RuleCreateResponse = {
  id: string
  savedAt: string
}

export type RuleChangeHistoryEntry = {
  id: string
  ruleId?: string
  changedAt: string
  ruleName: string
  description: string
  authorName: string
}

export type RuleChangeHistoryPage = {
  items: RuleChangeHistoryEntry[]
  hasMore: boolean
}
