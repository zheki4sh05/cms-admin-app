# CMS Admin Panel

Админ-панель для управления пользователями, рисковыми объектами, правилами и интеграциями в системе Trustflow.

Проект построен на `React + TypeScript + Vite`, использует `MUI` для UI и поддерживает два основных режима:
- локальная разработка с моками (`MSW`);
- работа с реальным backend API.

## Что умеет приложение

- аутентификация и авторизация с учётом прав доступа;
- dashboard и управление пользователями;
- работа с рисковыми объектами, правилами и категориями рисков;
- управление интеграциями и просмотр истории изменений;
- настройки профиля и системные настройки.

## Требования

- `Node.js` 20+ (рекомендуется LTS);
- `npm` 10+.

## Быстрый старт!

```bash
npm install
npm run dev
```

После запуска приложение откроется автоматически (Vite настроен с `open: true`).

## Демо-вход (режим с моками)

По умолчанию для разработки включён `MSW`, поэтому можно зайти без backend:

- `admin@trustflow.local` / `admin123`
- `manager@trustflow.local` / `manager123`
- `head@trustflow.local` / `head123`
- `top@trustflow.local` / `top123`

## Скрипты

- `npm run dev` — запуск в режиме `dev` (MSW включён).
- `npm run dev:test` — запуск в режиме `test` (MSW выключен, реальный API).
- `npm run build` — production-сборка (`tsc -b && vite build`).
- `npm run build:test` — test-сборка.
- `npm run preview` — локальный просмотр production-сборки в режиме `dev`.
- `npm run preview:test` — просмотр сборки в режиме `test`.
- `npm run lint` — проверка ESLint.

## Переменные окружения

Проект использует разные `.env`-файлы по режимам:

- `.env.dev`
- `.env.development`
- `.env.test`
- `.env.production`

Ключевые переменные:

- `VITE_USE_MSW` — включить/выключить моки (`true/false`);
- `VITE_API_BASE_URL` — базовый URL API (например `/api` или `http://localhost:3000/api`);
- `VITE_MAIN_APP_URL` — ссылка на основное приложение (кнопка на странице логина).

Пример запуска с реальным backend:

```bash
npm run dev:test
```

Перед этим проверьте значения в `.env.test`.

## Сборка и деплой

Собрать production-версию:

```bash
npm run build
```

Артефакты сборки появятся в директории `dist/`.

Проверить собранную версию локально:

```bash
npm run preview
```

## Полезно при разработке

- Если нужно сбросить текущую сессию, удалите токены в `localStorage` (`trustflow_access_token`, `trustflow_refresh_token`).
- При работе с backend убедитесь, что `VITE_API_BASE_URL` указывает на доступный API.
- Если интерфейс недоступен, проверьте консоль браузера и `npm run lint`.
