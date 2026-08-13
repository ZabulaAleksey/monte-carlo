# Учебный журнал

## 2026-08-13 — Независимый от пути standalone-деплой Next.js

### Что и зачем изменено

- В `apps/frontend/next.config.ts` tracing root закреплён за каталогом frontend.
- Это гарантирует наличие `.next/standalone/server.js`, которое соответствует `CMD ["node", "server.js"]` в Dockerfile.

### Ключевой поток управления

- `next build` трассирует runtime-зависимости относительно frontend → создаёт корневой standalone-артефакт → Docker копирует его в `/app` → Node запускает `/app/server.js`.

### Команды и проверки

```text
cd apps/frontend
npm ci
npm run lint
npm test
npm run build
docker build --tag montecarlo-frontend:deploy-path-fix .
```

### Решения и trade-offs

- Корень ограничен frontend-приложением. Если появятся runtime-зависимости вне `apps/frontend`, их нужно будет явно включить в tracing-конфигурацию.

### Проблемы и способы исправления

- PowerShell может блокировать `npm.ps1`; на Windows эквивалентные команды можно запускать через `npm.cmd`.
- Для `next/font/google` production build требует сетевой доступ.

### Как повторить самостоятельно

1. Очистить старый `.next` или выполнить новый production build.
2. Убедиться, что `.next/standalone/server.js` существует в корне.
3. Проверить, что в `.next/standalone` нет каталога со старым именем проекта.
4. Собрать Docker-образ и проверить успешное завершение шага `RUN npm run build`.
