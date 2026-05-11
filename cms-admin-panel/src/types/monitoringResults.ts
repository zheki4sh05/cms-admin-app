export type MonitoringResultStatisticsRow = {
  id: string
  riskObjectId: string
  riskObjectName: string
  processDate: string
}

export type MonitoringResultsStatistics = {
  results: MonitoringResultStatisticsRow[]
  retries: MonitoringResultStatisticsRow[]
}
