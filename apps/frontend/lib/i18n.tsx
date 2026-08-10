"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const en = {
  "nav.dashboard": "Dashboard",
  "nav.marketData": "Market Data",
  "nav.trades": "Trades",
  "nav.strategies": "Strategies",
  "nav.settings": "Settings",
  "language.label": "Language",
  "status.online": "Online environment",
  "status.checking": "Checking environment",
  "status.demo": "Demo environment",
  "status.feedOnline": "MT5 market feed online",
  "status.unavailable": "Connection status unavailable",
  "status.feedOffline": "MT5 feed offline · sample data",
  "status.sampleFeed": "Sample market feed",
  "backtest.badge": "Deterministic engine",
  "backtest.description": "Configure an advisor, replay historical candles sequentially and inspect every simulated fill.",
  "backtest.eyebrow": "Research workspace",
  "backtest.title": "Strategy backtesting",
  "backtest.emptyTitle": "Historical setup is incomplete",
  "backtest.emptyText": "Add an active instrument and strategy definition before starting a backtest.",
  "backtest.ready": "Ready for replay",
  "backtest.readyTitle": "Build a reproducible research baseline.",
  "backtest.readyText": "Signals are calculated after a candle closes and executed at the next candle open. Remaining positions are closed at the end of the dataset.",
  "form.eyebrow": "Test setup",
  "form.title": "Run configuration",
  "form.noFuture": "No future data",
  "form.strategy": "Strategy",
  "form.instrument": "Instrument",
  "form.timeframe": "Timeframe",
  "form.from": "From",
  "form.to": "To",
  "form.capital": "Starting capital",
  "form.advisor": "Advisor settings",
  "form.advisorHint": "Lot size, stop loss and take profit are supplied by the selected advisor.",
  "form.stress": "Stress factors",
  "form.stressHint": "Execution costs used to make the simulation more conservative.",
  "form.commission": "Commission / fill",
  "form.swap": "Swap / position / day",
  "form.slippageModel": "Slippage model",
  "form.slippagePrice": "Slippage / price",
  "form.slippageBps": "Slippage / bps",
  "form.fixed": "Fixed price",
  "form.relative": "Relative / bps",
  "strategy.maTitle": "Moving average crossover",
  "strategy.maDescription": "Demonstration advisor for infrastructure validation only; it is not presented as profitable.",
  "advisor.short_window": "Fast MA period",
  "advisor.long_window": "Slow MA period",
  "advisor.position_size": "Position size / units",
  "advisor.stop_loss_pct": "Stop loss / %",
  "advisor.take_profit_pct": "Take profit / %",
  "form.run": "Run backtesting",
  "form.running": "Backtest is running",
  "job.queued": "Preparing the test",
  "job.loading_data": "Loading historical candles",
  "job.simulating": "Running sequential simulation",
  "job.paused": "Simulation paused",
  "job.completed": "Simulation completed",
  "job.stopped": "Simulation stopped",
  "job.failed": "Simulation failed",
  "job.pause": "Pause",
  "job.resume": "Resume",
  "job.stop": "Stop",
  "runs.eyebrow": "Saved research",
  "runs.title": "Previous runs",
  "runs.count": "{count} runs",
  "runs.empty": "Your completed runs will appear here.",
  "runs.run": "Run",
  "runs.market": "Market",
  "runs.return": "Return",
  "runs.final": "Final",
  "runs.open": "Open history and trade chart",
  "runs.select": "Select research",
  "runs.delete": "Delete selected",
  "runs.deleting": "Deleting...",
  "result.completed": "Completed run",
  "result.instrument": "Instrument",
  "result.candles": "{count} candles",
  "result.range": "Data range",
  "result.to": "to",
  "metric.balance": "Final balance",
  "metric.start": "Start {value}",
  "metric.return": "Net return",
  "metric.drawdown": "Maximum drawdown",
  "metric.drawdownHint": "Equity peak to trough",
  "metric.winRate": "Win rate",
  "metric.trades": "{count} completed trades",
  "equity.eyebrow": "Portfolio path",
  "equity.title": "Equity curve",
  "equity.hint": "Balance + mark-to-market P&L",
  "equity.low": "Low {value}",
  "equity.high": "High {value}",
  "equity.operations": "{count} completed operations",
  "equity.empty": "No equity points were produced.",
  "replay.eyebrow": "Execution map",
  "replay.title": "Candles and trades",
  "replay.hint": "Entries and exits never precede their signal",
  "replay.show": "Show animated chart",
  "replay.speed": "Speed",
  "replay.play": "Play",
  "replay.pause": "Pause",
  "replay.stop": "Stop",
  "replay.progress": "Candle {current} of {total}",
  "replay.candles": "{count} sequential candles",
  "replay.markers": "Triangles: entry / circles: exit",
  "replay.empty": "No candles are available for this run.",
  "settings.position": "Position size",
  "settings.risk": "SL / TP",
  "settings.commission": "Commission",
  "settings.slippage": "Slippage",
  "settings.swap": "Swap",
  "settings.parameters": "Advisor parameters",
  "trades.eyebrow": "Virtual execution",
  "trades.title": "Trade ledger",
  "trades.count": "{count} trades",
  "trades.empty": "The strategy produced no completed trades.",
  "trades.side": "Side",
  "trades.opened": "Opened",
  "trades.closed": "Closed",
  "trades.entry": "Entry",
  "trades.exit": "Exit",
  "trades.reason": "Reason",
  "trades.costs": "Costs",
  "trades.pnl": "Net P&L",
} as const;

type MessageKey = keyof typeof en;
type Messages = Record<MessageKey, string>;

const ru: Messages = {
  "nav.dashboard": "Дашборд", "nav.marketData": "Рынок", "nav.trades": "Сделки", "nav.strategies": "Стратегии", "nav.settings": "Настройки",
  "language.label": "Язык", "status.online": "Онлайн-среда", "status.checking": "Проверка соединения", "status.demo": "Демо-среда", "status.feedOnline": "Поток MT5 подключён", "status.unavailable": "Статус соединения недоступен", "status.feedOffline": "MT5 отключён · тестовые данные", "status.sampleFeed": "Тестовый поток рынка",
  "backtest.badge": "Детерминированный движок", "backtest.description": "Настройте советник, последовательно воспроизведите исторические свечи и проверьте каждое виртуальное исполнение.", "backtest.eyebrow": "Исследовательская среда", "backtest.title": "Бэктестинг стратегий", "backtest.emptyTitle": "Не хватает исторических данных", "backtest.emptyText": "Добавьте активный инструмент и определение стратегии перед запуском.", "backtest.ready": "Готово к воспроизведению", "backtest.readyTitle": "Создайте воспроизводимую исследовательскую базу.", "backtest.readyText": "Сигнал вычисляется после закрытия свечи и исполняется на открытии следующей. Оставшиеся позиции закрываются в конце данных.",
  "form.eyebrow": "Настройка теста", "form.title": "Конфигурация запуска", "form.noFuture": "Без будущих данных", "form.strategy": "Стратегия", "form.instrument": "Инструмент", "form.timeframe": "Таймфрейм", "form.from": "От", "form.to": "До", "form.capital": "Стартовый капитал", "form.advisor": "Настройки советника", "form.advisorHint": "Лотность, stop loss и take profit задаются выбранным советником.", "form.stress": "Утяжеляющие факторы", "form.stressHint": "Издержки исполнения для более консервативной симуляции.", "form.commission": "Комиссия / исполнение", "form.swap": "Swap / позиция / день", "form.slippageModel": "Модель проскальзывания", "form.slippagePrice": "Проскальзывание / цена", "form.slippageBps": "Проскальзывание / б.п.", "form.fixed": "Фиксированное", "form.relative": "Относительное / б.п.", "form.run": "Запустить бэктестинг", "form.running": "Бэктест выполняется",
  "strategy.maTitle": "Пересечение скользящих средних", "strategy.maDescription": "Демонстрационный советник только для проверки инфраструктуры; он не позиционируется как прибыльный.", "advisor.short_window": "Период быстрой MA", "advisor.long_window": "Период медленной MA", "advisor.position_size": "Размер позиции / единицы", "advisor.stop_loss_pct": "Stop loss / %", "advisor.take_profit_pct": "Take profit / %",
  "job.queued": "Подготовка теста", "job.loading_data": "Загрузка исторических свечей", "job.simulating": "Последовательная симуляция", "job.paused": "Симуляция приостановлена", "job.completed": "Симуляция завершена", "job.stopped": "Симуляция остановлена", "job.failed": "Ошибка симуляции", "job.pause": "Пауза", "job.resume": "Продолжить", "job.stop": "Стоп",
  "runs.eyebrow": "Сохранённые исследования", "runs.title": "Предыдущие запуски", "runs.count": "{count} запусков", "runs.empty": "Завершённые исследования появятся здесь.", "runs.run": "Запуск", "runs.market": "Рынок", "runs.return": "Доходность", "runs.final": "Итог", "runs.open": "Открыть историю и график сделок", "runs.select": "Выбрать исследование", "runs.delete": "Удалить выбранные", "runs.deleting": "Удаление...",
  "result.completed": "Завершённый запуск", "result.instrument": "Инструмент", "result.candles": "{count} свечей", "result.range": "Диапазон данных", "result.to": "до",
  "metric.balance": "Итоговый баланс", "metric.start": "Старт {value}", "metric.return": "Чистая доходность", "metric.drawdown": "Максимальная просадка", "metric.drawdownHint": "От пика equity до минимума", "metric.winRate": "Доля прибыльных", "metric.trades": "{count} завершённых операций",
  "equity.eyebrow": "Путь портфеля", "equity.title": "Кривая equity", "equity.hint": "Баланс + переоценка открытых позиций", "equity.low": "Минимум {value}", "equity.high": "Максимум {value}", "equity.operations": "{count} завершённых операций", "equity.empty": "Точки equity отсутствуют.",
  "replay.eyebrow": "Карта исполнения", "replay.title": "Свечи и сделки", "replay.hint": "Входы и выходы не опережают сигнал", "replay.show": "Показывать анимацию графика", "replay.speed": "Скорость", "replay.play": "Старт", "replay.pause": "Пауза", "replay.stop": "Стоп", "replay.progress": "Свеча {current} из {total}", "replay.candles": "{count} последовательных свечей", "replay.markers": "Треугольники: вход / круги: выход", "replay.empty": "Для запуска нет свечей.",
  "settings.position": "Размер позиции", "settings.risk": "SL / TP", "settings.commission": "Комиссия", "settings.slippage": "Проскальзывание", "settings.swap": "Swap", "settings.parameters": "Параметры советника",
  "trades.eyebrow": "Виртуальное исполнение", "trades.title": "Журнал сделок", "trades.count": "{count} сделок", "trades.empty": "Стратегия не создала завершённых сделок.", "trades.side": "Сторона", "trades.opened": "Открыта", "trades.closed": "Закрыта", "trades.entry": "Вход", "trades.exit": "Выход", "trades.reason": "Причина", "trades.costs": "Издержки", "trades.pnl": "Чистый P&L",
};

const uk: Messages = {
  ...ru,
  "nav.dashboard": "Дашборд", "nav.marketData": "Ринок", "nav.trades": "Угоди", "nav.strategies": "Стратегії", "nav.settings": "Налаштування",
  "language.label": "Мова", "status.online": "Онлайн-середовище", "status.checking": "Перевірка з'єднання", "status.demo": "Демо-середовище", "status.feedOnline": "Потік MT5 підключено", "status.unavailable": "Статус з'єднання недоступний", "status.feedOffline": "MT5 відключено · тестові дані", "status.sampleFeed": "Тестовий потік ринку",
  "backtest.description": "Налаштуйте радник, послідовно відтворіть історичні свічки та перевірте кожне віртуальне виконання.", "backtest.eyebrow": "Дослідницьке середовище", "backtest.title": "Бектестинг стратегій",
  "backtest.badge": "Детермінований рушій", "backtest.emptyTitle": "Бракує історичних даних", "backtest.emptyText": "Додайте активний інструмент і визначення стратегії перед запуском.", "backtest.ready": "Готово до відтворення", "backtest.readyTitle": "Створіть відтворювану дослідницьку базу.", "backtest.readyText": "Сигнал обчислюється після закриття свічки та виконується на відкритті наступної. Решта позицій закривається наприкінці даних.",
  "form.eyebrow": "Налаштування тесту", "form.title": "Конфігурація запуску", "form.strategy": "Стратегія", "form.instrument": "Інструмент", "form.from": "Від", "form.to": "До", "form.capital": "Стартовий капітал", "form.advisor": "Налаштування радника", "form.advisorHint": "Лотність, stop loss і take profit задаються обраним радником.", "form.stress": "Обтяжувальні фактори", "form.stressHint": "Витрати виконання для консервативнішої симуляції.", "form.run": "Запустити бектестинг",
  "form.noFuture": "Без майбутніх даних", "form.timeframe": "Таймфрейм", "form.commission": "Комісія / виконання", "form.swap": "Swap / позиція / день", "form.slippageModel": "Модель прослизання", "form.slippagePrice": "Прослизання / ціна", "form.slippageBps": "Прослизання / б.п.", "form.fixed": "Фіксоване", "form.relative": "Відносне / б.п.", "form.running": "Бектест виконується",
  "strategy.maTitle": "Перетин ковзних середніх", "strategy.maDescription": "Демонстраційний радник лише для перевірки інфраструктури; він не позиціонується як прибутковий.", "advisor.short_window": "Період швидкої MA", "advisor.long_window": "Період повільної MA", "advisor.position_size": "Розмір позиції / одиниці", "advisor.stop_loss_pct": "Stop loss / %", "advisor.take_profit_pct": "Take profit / %",
  "job.queued": "Підготовка тесту", "job.loading_data": "Завантаження історичних свічок", "job.simulating": "Послідовна симуляція", "job.paused": "Симуляцію призупинено", "job.completed": "Симуляцію завершено", "job.stopped": "Симуляцію зупинено", "job.failed": "Помилка симуляції", "job.pause": "Пауза", "job.resume": "Продовжити", "job.stop": "Стоп",
  "runs.eyebrow": "Збережені дослідження", "runs.title": "Попередні запуски", "runs.empty": "Завершені дослідження з'являться тут.", "runs.open": "Відкрити історію та графік угод", "runs.select": "Обрати дослідження", "runs.delete": "Видалити обрані", "runs.deleting": "Видалення...",
  "runs.count": "{count} запусків", "runs.run": "Запуск", "runs.market": "Ринок", "runs.return": "Дохідність", "runs.final": "Підсумок",
  "result.completed": "Завершений запуск", "result.instrument": "Інструмент", "result.candles": "{count} свічок", "result.range": "Діапазон даних", "result.to": "до",
  "metric.balance": "Підсумковий баланс", "metric.start": "Старт {value}", "metric.return": "Чиста дохідність", "metric.drawdown": "Максимальна просадка", "metric.drawdownHint": "Від піка equity до мінімуму", "metric.winRate": "Частка прибуткових", "metric.trades": "{count} завершених операцій",
  "equity.eyebrow": "Шлях портфеля", "equity.title": "Крива equity", "equity.operations": "{count} завершених операцій",
  "equity.hint": "Баланс + переоцінка відкритих позицій", "equity.low": "Мінімум {value}", "equity.high": "Максимум {value}", "equity.empty": "Точки equity відсутні.",
  "replay.eyebrow": "Мапа виконання", "replay.title": "Свічки та угоди", "replay.show": "Показувати анімацію графіка", "replay.speed": "Швидкість", "replay.play": "Старт", "replay.pause": "Пауза", "replay.stop": "Стоп", "replay.progress": "Свічка {current} з {total}",
  "replay.hint": "Входи та виходи не випереджають сигнал", "replay.candles": "{count} послідовних свічок", "replay.markers": "Трикутники: вхід / кола: вихід", "replay.empty": "Для запуску немає свічок.",
  "settings.position": "Розмір позиції", "settings.risk": "SL / TP", "settings.commission": "Комісія", "settings.slippage": "Прослизання", "settings.swap": "Swap", "settings.parameters": "Параметри радника",
  "trades.title": "Журнал угод", "trades.count": "{count} угод", "trades.empty": "Стратегія не створила завершених угод.",
  "trades.eyebrow": "Віртуальне виконання", "trades.side": "Сторона", "trades.opened": "Відкрита", "trades.closed": "Закрита", "trades.entry": "Вхід", "trades.exit": "Вихід", "trades.reason": "Причина", "trades.costs": "Витрати", "trades.pnl": "Чистий P&L",
};

const be: Messages = {
  ...ru,
  "nav.dashboard": "Панэль",
  "nav.marketData": "Рынак",
  "nav.trades": "Здзелкі",
  "nav.strategies": "Стратэгіі",
  "nav.settings": "Налады",
  "language.label": "Мова",
  "status.online": "Анлайн-асяроддзе",
  "status.checking": "Праверка злучэння",
  "status.demo": "Дэма-асяроддзе",
  "status.feedOnline": "Паток MT5 падключаны",
  "status.unavailable": "Статус злучэння недаступны",
  "status.feedOffline": "MT5 адключаны · тэставыя даныя",
  "status.sampleFeed": "Тэставы паток рынку",
  "backtest.badge": "Дэтэрмінаваны рухавік",
  "backtest.description": "Наладзьце дарадцу, паслядоўна прайграйце гістарычныя свечкі і праверце кожнае віртуальнае выкананне.",
  "backtest.eyebrow": "Даследчая прастора",
  "backtest.title": "Бэктэставанне стратэгій",
  "backtest.emptyTitle": "Не хапае гістарычных даных",
  "backtest.emptyText": "Дадайце актыўны інструмент і вызначэнне стратэгіі перад запускам.",
  "backtest.ready": "Гатова да прайгравання",
  "backtest.readyTitle": "Стварыце ўзнаўляльную даследчую базу.",
  "backtest.readyText": "Сігнал разлічваецца пасля закрыцця свечкі і выконваецца на адкрыцці наступнай. Астатнія пазіцыі закрываюцца ў канцы даных.",
  "form.eyebrow": "Налады тэсту",
  "form.title": "Канфігурацыя запуску",
  "form.noFuture": "Без будучых даных",
  "form.strategy": "Стратэгія",
  "form.instrument": "Інструмент",
  "form.timeframe": "Таймфрэйм",
  "form.from": "Ад",
  "form.to": "Да",
  "form.capital": "Стартавы капітал",
  "form.advisor": "Налады дарадцы",
  "form.advisorHint": "Лотнасць, stop loss і take profit задаюцца выбраным дарадцам.",
  "form.stress": "Абцяжарвальныя фактары",
  "form.stressHint": "Выдаткі на выкананне для больш кансерватыўнай сімуляцыі.",
  "form.commission": "Камісія / выкананне",
  "form.swap": "Swap / пазіцыя / дзень",
  "form.slippageModel": "Мадэль праслізгвання",
  "form.slippagePrice": "Праслізгванне / цана",
  "form.slippageBps": "Праслізгванне / б.п.",
  "form.fixed": "Фіксаванае",
  "form.relative": "Адноснае / б.п.",
  "form.run": "Запусціць бэктэставанне",
  "form.running": "Бэктэст выконваецца",
  "strategy.maTitle": "Перасячэнне слізгальных сярэдніх",
  "strategy.maDescription": "Дэманстрацыйны дарадца толькі для праверкі інфраструктуры; ён не пазіцыянуецца як прыбытковы.",
  "advisor.short_window": "Перыяд хуткай MA",
  "advisor.long_window": "Перыяд павольнай MA",
  "advisor.position_size": "Памер пазіцыі / адзінкі",
  "advisor.stop_loss_pct": "Stop loss / %",
  "advisor.take_profit_pct": "Take profit / %",
  "job.queued": "Падрыхтоўка тэсту",
  "job.loading_data": "Загрузка гістарычных свечак",
  "job.simulating": "Паслядоўная сімуляцыя",
  "job.paused": "Сімуляцыя прыпынена",
  "job.completed": "Сімуляцыя завершана",
  "job.stopped": "Сімуляцыя спынена",
  "job.failed": "Памылка сімуляцыі",
  "job.pause": "Паўза",
  "job.resume": "Працягнуць",
  "job.stop": "Стоп",
  "runs.eyebrow": "Захаваныя даследаванні",
  "runs.title": "Папярэднія запускі",
  "runs.count": "{count} запускаў",
  "runs.empty": "Завершаныя даследаванні з'явяцца тут.",
  "runs.run": "Запуск",
  "runs.market": "Рынак",
  "runs.return": "Даходнасць",
  "runs.final": "Вынік",
  "runs.open": "Адкрыць гісторыю і графік здзелак",
  "runs.select": "Выбраць даследаванне",
  "runs.delete": "Выдаліць выбраныя",
  "runs.deleting": "Выдаленне...",
  "result.completed": "Завершаны запуск",
  "result.instrument": "Інструмент",
  "result.candles": "{count} свечак",
  "result.range": "Дыяпазон даных",
  "result.to": "да",
  "metric.balance": "Выніковы баланс",
  "metric.start": "Старт {value}",
  "metric.return": "Чыстая даходнасць",
  "metric.drawdown": "Максімальная прасадка",
  "metric.drawdownHint": "Ад піка equity да мінімуму",
  "metric.winRate": "Доля прыбытковых",
  "metric.trades": "{count} завершаных аперацый",
  "equity.eyebrow": "Шлях партфеля",
  "equity.title": "Крывая equity",
  "equity.hint": "Баланс + пераацэнка адкрытых пазіцый",
  "equity.low": "Мінімум {value}",
  "equity.high": "Максімум {value}",
  "equity.operations": "{count} завершаных аперацый",
  "equity.empty": "Кропкі equity адсутнічаюць.",
  "replay.eyebrow": "Карта выканання",
  "replay.title": "Свечкі і здзелкі",
  "replay.hint": "Уваходы і выхады не апярэджваюць сігнал",
  "replay.show": "Паказваць анімацыю графіка",
  "replay.speed": "Хуткасць",
  "replay.play": "Старт",
  "replay.pause": "Паўза",
  "replay.stop": "Стоп",
  "replay.progress": "Свечка {current} з {total}",
  "replay.candles": "{count} паслядоўных свечак",
  "replay.markers": "Трохкутнікі: уваход / кругі: выхад",
  "replay.empty": "Для запуску няма свечак.",
  "settings.position": "Памер пазіцыі",
  "settings.risk": "SL / TP",
  "settings.commission": "Камісія",
  "settings.slippage": "Праслізгванне",
  "settings.swap": "Swap",
  "settings.parameters": "Параметры дарадцы",
  "trades.eyebrow": "Віртуальнае выкананне",
  "trades.title": "Журнал здзелак",
  "trades.count": "{count} здзелак",
  "trades.empty": "Стратэгія не стварыла завершаных здзелак.",
  "trades.side": "Бок",
  "trades.opened": "Адкрыта",
  "trades.closed": "Закрыта",
  "trades.entry": "Уваход",
  "trades.exit": "Выхад",
  "trades.reason": "Прычына",
  "trades.costs": "Выдаткі",
  "trades.pnl": "Чысты P&L",
};

export type Locale = "en" | "ru" | "uk" | "be";
export const supportedLocales = [
  { code: "en" as const, flag: "🇬🇧", name: "English", intl: "en-US" },
  { code: "ru" as const, flag: "🇷🇺", name: "Русский", intl: "ru-RU" },
  { code: "uk" as const, flag: "🇺🇦", name: "Українська", intl: "uk-UA" },
  { code: "be" as const, flag: "🇧🇾", name: "Беларуская", intl: "be-BY" },
];

const catalogs: Record<Locale, Messages> = { en, ru, uk, be };
const STORAGE_KEY = "montecarlo.locale.v1";

interface I18nValue {
  locale: Locale;
  intlLocale: string;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue>({
  locale: "en",
  intlLocale: "en-US",
  setLocale: () => undefined,
  t: (key, values) => interpolate(en[key], values),
});

function interpolate(
  message: string,
  values: Record<string, string | number> = {},
): string {
  return message.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function isLocale(value: string | null): value is Locale {
  return supportedLocales.some(({ code }) => code === value);
}

export function I18nProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) setLocaleState(stored);
  }, []);

  const setLocale = useCallback((nextLocale: Locale): void => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nValue>(() => {
    const intlLocale = supportedLocales.find((item) => item.code === locale)?.intl ?? "en-US";
    return {
      locale,
      intlLocale,
      setLocale,
      t: (key, values) => interpolate(catalogs[locale][key] ?? en[key], values),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
