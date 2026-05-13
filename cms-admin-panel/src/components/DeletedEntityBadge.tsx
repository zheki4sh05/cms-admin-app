import { Chip, Tooltip } from '@mui/material'

const DEFAULT_TOOLTIP = 'Объект удалён и перенесён в историю изменений.'

type DeletedEntityBadgeProps = {
  /** Подсказка при наведении; по умолчанию — общее пояснение про историю. */
  tooltip?: string
}

export function DeletedEntityBadge({ tooltip = DEFAULT_TOOLTIP }: DeletedEntityBadgeProps) {
  return (
    <Tooltip title={tooltip}>
      <Chip
        component="span"
        label="Удалено"
        size="small"
        variant="outlined"
        color="default"
        sx={{
          height: 22,
          fontSize: '0.6875rem',
          '& .MuiChip-label': { px: 0.75 },
        }}
      />
    </Tooltip>
  )
}
