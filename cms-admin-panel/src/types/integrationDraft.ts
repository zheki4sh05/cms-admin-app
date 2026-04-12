export type IntegrationKind = 'pull' | 'push' | 'broker'

export type RiskObjectModel = {
  id: string
  name: string
}

export type IntegrationDraftPayload = {
  name: string
  integrationKind: IntegrationKind | ''
  endpointUrl: string
  riskObjectModelId: string
}

export type IntegrationDraftSaveResponse = {
  id: string
  updatedAt: string
}
