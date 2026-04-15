export type PageViewPermission =
  | 'view_dashboard_page'
  | 'view_users_page'
  | 'view_risk_objects_page'
  | 'view_integrations_page'
  | 'view_rules_and_risks_page'
  | 'view_settings_page'
  | 'view_profile_page'

export type ManagementPermission =
  | 'edit_users'
  | 'manage_risk_objects'
  | 'manage_integrations'
  | 'manage_rules_and_risks'

export type AccessPermission = 'view_all_pages' | PageViewPermission | ManagementPermission

export const PAGE_VIEW_OPTIONS: Array<{ value: PageViewPermission; label: string }> = [
  { value: 'view_dashboard_page', label: 'Рабочий стол' },
  { value: 'view_users_page', label: 'Пользователи' },
  { value: 'view_risk_objects_page', label: 'Рисковые объекты' },
  { value: 'view_integrations_page', label: 'Интеграции' },
  { value: 'view_rules_and_risks_page', label: 'Правила и риски' },
  { value: 'view_settings_page', label: 'Настройки' },
  { value: 'view_profile_page', label: 'Личный кабинет' },
]

export const MANAGEMENT_ACCESS_OPTIONS: Array<{ value: ManagementPermission; label: string }> = [
  { value: 'edit_users', label: 'Редактировать пользователей' },
  { value: 'manage_risk_objects', label: 'Управлять рисковыми объектами' },
  { value: 'manage_integrations', label: 'Управлять интеграциями' },
  { value: 'manage_rules_and_risks', label: 'Управлять Правилами и рисками' },
]

export function canViewPage(
  permissions: readonly AccessPermission[],
  permission: PageViewPermission,
): boolean {
  return permissions.includes('view_all_pages') || permissions.includes(permission)
}
