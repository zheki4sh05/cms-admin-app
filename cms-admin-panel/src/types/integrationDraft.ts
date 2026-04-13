export type IntegrationKind = 'pull' | 'push' | 'broker'

/** Правило сопоставления полей (как в итоговом JSON mapping_rules). */
export type IntegrationMappingRule = {
  from: string
  to: string
  transform?: string
}

/** Элемент каталога моделей (ответ GET /api/risk-object-models). */
export type RiskObjectModelListItem = { id: string; name: string }

/** Полная модель с полем definition (ответ GET /api/risk-object-models/:id). */
export type RiskObjectModel = {
  id: string
  name: string
  definition: Record<string, unknown>
}

export type IntegrationDraftPayload = {
  name: string
  integrationKind: IntegrationKind | ''
  endpointUrl: string
  riskObjectModelId: string
  mapping_rules: IntegrationMappingRule[]
}

export type IntegrationDraftSaveResponse = {
  id: string
  updatedAt: string
}
