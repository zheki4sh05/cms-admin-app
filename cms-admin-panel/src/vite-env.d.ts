/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `true` — подключать MSW в браузере (профиль `dev`). */
  readonly VITE_USE_MSW?: string
  /** Базовый URL API без завершающего `/`, например `/api` или `http://localhost:4000/api` */
  readonly VITE_API_BASE_URL?: string
  /** Базовый URL WS-сервиса Socket.IO, например `http://localhost:8082`. */
  readonly VITE_WS_BASE_URL?: string
  /** Принудительный тип клиента для WS: `employee` или `admin`. */
  readonly VITE_WS_CLIENT_TYPE?: string
  /** URL основного приложения для ссылки на экране входа. */
  readonly VITE_MAIN_APP_URL?: string
}
