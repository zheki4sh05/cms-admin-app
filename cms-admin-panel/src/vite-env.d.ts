/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `true` — подключать MSW в браузере (профиль `dev`). */
  readonly VITE_USE_MSW?: string
  /** Базовый URL API без завершающего `/`, например `/api` или `http://localhost:4000/api` */
  readonly VITE_API_BASE_URL?: string
}
