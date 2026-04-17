import type { RiskCategory, RiskItem } from '../types/risks'

export type RulePriority = 'low' | 'medium' | 'high'
export type RuleAction = 'createIncident' | 'sendNotification'

export type RuleEditorDraft = {
  riskObjectId: string
  mechanismScriptName: string
  mechanismScriptContent: string
  categoryId: string
  priority: RulePriority
  responsibleUserId: string
  actions: RuleAction[]
  enabled: boolean
}

export type RuleOverrides = Partial<RuleEditorDraft>
export type RuleOverridesMap = Record<string, RuleOverrides>

export type RuleTableRow = {
  id: string
  name: string
  condition: string
  action: string
  categoryId: string
  categoryLabel: string
  priority: RulePriority
  enabled: boolean
  riskObjectId: string
}

export type RiskCategoryOption = {
  id: string
  name: string
}

const priorityPattern: RulePriority[] = ['high', 'medium', 'low']

export const priorityLabels: Record<RulePriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
}

const actionByCategory: Record<RiskCategory, string> = {
  financial: 'Отправить объект на расширенную финансовую проверку',
  reputational: 'Добавить объект в мониторинг новостного фона',
  operational: 'Создать задачу комплаенс-аналитику',
}

export const actionLabels: Record<RuleAction, string> = {
  createIncident: 'Создать инцидент',
  sendNotification: 'Отправить уведомление',
}

export function buildRuleRows(
  risks: RiskItem[],
  overrides: RuleOverridesMap,
  categories: RiskCategoryOption[],
): RuleTableRow[] {
  const categoryNameById = new Map<string, string>(categories.map((item) => [item.id, item.name]))
  return risks.map((risk, index) => {
    const override = overrides[risk.id]
    const categoryId = (override?.categoryId ?? risk.category) as string
    const actionBySelectedCategory = actionByCategory[categoryId as RiskCategory] ?? actionByCategory.operational
    const priority = (override?.priority ?? priorityPattern[index % priorityPattern.length]) as RulePriority
    return {
      id: risk.id,
      name: risk.name,
      condition: risk.description,
      action:
        (override?.actions ?? []).length > 0
          ? (override?.actions ?? []).map((item) => actionLabels[item]).join(', ')
          : actionBySelectedCategory,
      categoryId,
      categoryLabel: categoryNameById.get(categoryId) ?? categoryId,
      priority,
      enabled: override?.enabled ?? index % 5 !== 4,
      riskObjectId: override?.riskObjectId ?? risk.riskObjectId,
    }
  })
}
