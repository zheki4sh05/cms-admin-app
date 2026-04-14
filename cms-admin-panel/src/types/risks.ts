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
