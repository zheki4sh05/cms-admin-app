export type IntegrationKind = 'pull' | 'push' | 'broker'

/** Правило сопоставления полей (как в итоговом JSON mapping_rules). */
export type IntegrationMappingRule = {
  from: string
  to: string
  transform?: string
}

export type RiskObjectModel = {
  id: string
  name: string
  /** Схема целевого объекта: ключи для поля «Преобразовать в». */
  definition?: Record<string, unknown>
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
