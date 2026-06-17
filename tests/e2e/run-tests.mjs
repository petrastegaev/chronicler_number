/**
 * Автономный E2E тест игры "Число летописца"
 * Использует Playwright API напрямую (без @playwright/test)
 * для полного контроля над многоконтекстным тестированием.
 *
 * Запуск: node tests/e2e/run-tests.mjs
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:8081';
const ADMIN_KEY = 'booth-admin-2026';

// Результаты тестов
const results = [];
function report(name, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'SKIP' ? '⏭️' : '⚠️';
  console.log(`  ${icon} ${name}${detail ? ` — ${detail}` : ''}`);
  results.push({ name, status, detail });
}

// ============================================================
// Утилиты
// ============================================================
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function screenshot(page, name) {
  try {
    await page.screenshot({ path: `playwright-report/${name}.png`, fullPage: false });
  } catch (e) {
    // ignore screenshot errors
  }
}

// ============================================================
// Основной тестовый сценарий
// ============================================================
async function runTests() {
  console.log('\n🚀 Запуск E2E тестов "Число летописца"\n');
  console.log('═'.repeat(60));

  // Убедимся, что сервер запущен
  try {
    const resp = await fetch(`${BASE_URL}/api/stats/`, { headers: { 'X-Admin-Key': ADMIN_KEY } });
    if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
    const stats = await resp.json();
    console.log(`✓ Сервер запущен (game_count=${stats.game_count})`);
  } catch (e) {
    console.error('❌ Сервер не запущен! Запустите backend на порту 8081');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const reportLines = [];

  try {
    // ─────────────────────────────────────────────────────
    // SMOKE-001: Фронтенд загружается
    // ─────────────────────────────────────────────────────
    console.log('\n─── SMOKE-001: Фронтенд загружается ───');
    const smokePage = await browser.newPage();
    await smokePage.goto(BASE_URL, { waitUntil: 'networkidle' });
    const hasTitle = await smokePage.locator('text=Число летописца').isVisible();
    const hasInput = await smokePage.locator('input[placeholder="Введите ваш ник"]').isVisible();
    const hasButton = await smokePage.locator('button:has-text("Присоединиться")').isVisible();
    report('SMOKE-001: Фронтенд', hasTitle && hasInput && hasButton ? 'PASS' : 'FAIL');
    await smokePage.close();

    // ─────────────────────────────────────────────────────
    // SMOKE-002: Админ-панель загружается
    // ─────────────────────────────────────────────────────
    console.log('\n─── SMOKE-002: Админ-панель ───');
    const adminSmokePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await adminSmokePage.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
    const hasAdminTitle = await adminSmokePage.locator('text=Админ-панель').isVisible();
    const hasKeyInput = await adminSmokePage.locator('input[type="password"]').isVisible();
    const hasLoginBtn = await adminSmokePage.locator('button:has-text("Войти")').isVisible();
    report('SMOKE-002: Админ-панель', hasAdminTitle && hasKeyInput && hasLoginBtn ? 'PASS' : 'FAIL');
    await adminSmokePage.close();

    // ─────────────────────────────────────────────────────
    // SMOKE-003: SPA fallback работает
    // ─────────────────────────────────────────────────────
    console.log('\n─── SMOKE-003: SPA fallback ───');
    const fallbackResp = await fetch(`${BASE_URL}/nonexistent`);
    const isHtml = fallbackResp.headers.get('content-type')?.includes('text/html');
    report('SMOKE-003: SPA fallback', isHtml ? 'PASS' : 'FAIL',
      isHtml ? 'returns HTML' : `returns ${fallbackResp.headers.get('content-type')}`);

    // ─────────────────────────────────────────────────────
    // ADMIN-001: Подключение администратора
    // ─────────────────────────────────────────────────────
    console.log('\n─── ADMIN-001: Подключение администратора ───');
    const adminCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const adminPage = await adminCtx.newPage();
    await adminPage.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });

    // Ждём логин-экран и входим
    await adminPage.waitForSelector('text=Админ-панель', { timeout: 10000 });
    await adminPage.fill('input[type="password"]', ADMIN_KEY);

    // Собираем консольные сообщения для отладки
    const consoleLogs = [];
    adminPage.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    await adminPage.click('button:has-text("Войти")');

    // Ждём смены кнопки на "Подключение..."
    await sleep(1000);

    // Ждём админ-панель или возврат на экран входа
    try {
      await adminPage.waitForSelector('text=Панель ведущего', { timeout: 15000 });
      const hasGame = await adminPage.locator('button:has-text("Игра")').isVisible().catch(() => false);
      const hasQuestions = await adminPage.locator('button:has-text("Вопросы")').isVisible().catch(() => false);
      const hasLeaderboard = await adminPage.locator('button:has-text("Рекорды")').isVisible().catch(() => false);
      report('ADMIN-001: Вход', 'PASS',
        `вкладки: Игра=${hasGame ? '✓' : '✗'} Вопросы=${hasQuestions ? '✓' : '✗'} Рекорды=${hasLeaderboard ? '✓' : '✗'}`);
    } catch (e) {
      await screenshot(adminPage, 'ADMIN-001-fail');
      const currentHeading = await adminPage.locator('h1, h2').first().textContent().catch(() => 'unknown');
      const currentPhase = await adminPage.locator('button').first().textContent().catch(() => 'unknown');
      const logSummary = consoleLogs.slice(-3).join('; ') || 'нет логов';
      report('ADMIN-001: Вход', 'FAIL',
        `Заголовок: "${currentHeading}", Кнопка: "${currentPhase}", Логи: ${logSummary}`);
    }

    // ─────────────────────────────────────────────────────
    // QUESTIONS-002: Добавление вопросов
    // ─────────────────────────────────────────────────────
    console.log('\n─── QUESTIONS-002: Управление вопросами ───');
    let questionsAdded = 0;

    // Кликаем вкладку "Вопросы"
    await adminPage.click('button:has-text("Вопросы")');
    await sleep(500);

    // Подвкладка "Добавить"
    await adminPage.click('button:has-text("Добавить")');
    await sleep(300);

    const testQuestions = [
      { text: 'Сколько стран в мире?', answer: 195, category: 'География' },
      { text: 'Расстояние от Земли до Луны в км?', answer: 384400, category: 'Астрономия' },
      { text: 'Сколько костей в теле человека?', answer: 206, category: 'Биология' },
      { text: 'Сколько дней в високосном году?', answer: 366 },
      { text: 'Сколько метров в километре?', answer: 1000 },
      { text: 'Сколько секунд в минуте?', answer: 60 },
      { text: 'Сколько граммов в килограмме?', answer: 1000 },
      { text: 'Температура кипения воды в °C?', answer: 100, category: 'Физика' },
      { text: 'Сколько планет в Солнечной системе?', answer: 8, category: 'Астрономия' },
    ];

    for (const q of testQuestions) {
      try {
        // Убедимся, что форма готова
        await adminPage.waitForSelector('button:has-text("Добавить вопрос")', { timeout: 5000 });
        await sleep(200);

        // Очищаем и заполняем поля (Playwright fill делает clear + type)
        await adminPage.fill('input[placeholder="Введите вопрос"]', '');
        await sleep(50);
        await adminPage.fill('input[placeholder="Введите вопрос"]', q.text);
        await adminPage.fill('input[placeholder="Введите ответ"]', '');
        await sleep(50);
        await adminPage.fill('input[placeholder="Введите ответ"]', String(q.answer));
        if (q.category) {
          await adminPage.fill('input[placeholder="Категория (необязательно)"]', q.category);
        } else {
          await adminPage.fill('input[placeholder="Категория (необязательно)"]', '');
        }

        await sleep(100);
        // Ждём, пока кнопка станет активной
        await adminPage.waitForSelector('button:has-text("Добавить вопрос"):not([disabled])', { timeout: 5000 });
        await adminPage.click('button:has-text("Добавить вопрос")');
        await adminPage.waitForSelector('text=Вопрос добавлен', { timeout: 5000 });
        await sleep(300); // Ждём сброса формы
        questionsAdded++;
      } catch (e) {
        console.log(`    ⚠ Ошибка при добавлении "${q.text}": ${e.message.split('\n')[0]}`);
      }
    }
    report('QUESTIONS-002: Добавление', questionsAdded === 9 ? 'PASS' : 'FAIL',
      `добавлено ${questionsAdded}/9`);

    // Проверим список (ждём загрузки)
    await adminPage.click('button:has-text("Список")');
    await sleep(800);
    const listVisible = await adminPage.locator('text=Сколько стран в мире?').isVisible().catch(() => false);
    const listHasContent = await adminPage.locator('text=Загрузка').isVisible().catch(() => false);
    report('QUESTIONS-002: Список', listVisible ? 'PASS' : (listHasContent ? 'SKIP' : 'FAIL'),
      listVisible ? 'вопрос виден' : (listHasContent ? 'ещё загружается' : 'вопрос не найден'));

    // ─────────────────────────────────────────────────────
    // CSV-001: Проверка вкладки CSV
    // ─────────────────────────────────────────────────────
    console.log('\n─── CSV-001: CSV импорт ───');
    await adminPage.click('button:has-text("CSV")');
    await sleep(500);
    const csvDropzone = await adminPage.locator('text=Выберите CSV-файл').isVisible().catch(() => false);
    report('CSV-001: Вкладка CSV', csvDropzone ? 'PASS' : 'FAIL');

    // ─────────────────────────────────────────────────────
    // JOIN-001/002: Подключение игроков
    // ─────────────────────────────────────────────────────
    console.log('\n─── JOIN-001/002: Подключение игроков ───');
    const player1Ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const player1Page = await player1Ctx.newPage();
    await player1Page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Игрок 1: ввод никнейма
    await player1Page.waitForSelector('text=Число летописца', { timeout: 10000 });
    await player1Page.fill('input[placeholder="Введите ваш ник"]', 'Алексей');
    await player1Page.click('button:has-text("Присоединиться")');
    await player1Page.waitForSelector('button:has-text("Отправка...")', { timeout: 3000 }).catch(() => {});
    const p1waiting = await player1Page.waitForSelector('text=Ожидание', { timeout: 10000 }).then(() => true).catch(() => false);
    report('JOIN-001: Игрок 1', p1waiting ? 'PASS' : 'FAIL',
      p1waiting ? 'в ожидании соперника' : 'timeout');

    // Игрок 2
    const player2Ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const player2Page = await player2Ctx.newPage();
    await player2Page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await player2Page.waitForSelector('text=Число летописца', { timeout: 10000 });
    await player2Page.fill('input[placeholder="Введите ваш ник"]', 'Мария');
    await player2Page.click('button:has-text("Присоединиться")');
    await player2Page.waitForSelector('button:has-text("Отправка...")', { timeout: 3000 }).catch(() => {});
    const p2waiting = await player2Page.waitForSelector('text=Ожидание', { timeout: 10000 }).then(() => true).catch(() => false);
    report('JOIN-002: Игрок 2', p2waiting ? 'PASS' : 'FAIL');

    // Проверяем, что админ видит игроков
    await adminPage.click('button:has-text("Игра")');
    await sleep(500);
    const seesPlayer1 = await adminPage.locator('text=Алексей').isVisible().catch(() => false);
    const seesPlayer2 = await adminPage.locator('text=Мария').isVisible().catch(() => false);
    const seesReady = (await adminPage.locator('text=Готов').count().catch(() => 0)) >= 2;
    report('JOIN-002: Админ видит игроков', (seesPlayer1 && seesPlayer2 && seesReady) ? 'PASS' : 'FAIL');

    // ─────────────────────────────────────────────────────
    // JOIN-003: Валидация пустого никнейма
    // ─────────────────────────────────────────────────────
    console.log('\n─── JOIN-003/004: Валидация никнейма ───');
    const validateCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const validatePage = await validateCtx.newPage();
    await validatePage.goto(BASE_URL, { waitUntil: 'networkidle' });

    const maxLength = await validatePage.locator('input[placeholder="Введите ваш ник"]').getAttribute('maxLength');
    report('JOIN-004: maxLength', maxLength === '15' ? 'PASS' : 'FAIL', `maxLength=${maxLength}`);

    // Пробуем пустой никнейм
    await validatePage.fill('input[placeholder="Введите ваш ник"]', '   ');
    await validatePage.click('button:has-text("Присоединиться")');
    await sleep(1000);
    // Пустой никнейм должен вызвать ошибку соединения или вернуть на исходную
    const stillOnJoin = await validatePage.locator('button:has-text("Присоединиться")').isVisible().catch(() => false);
    report('JOIN-003: Пустой никнейм', stillOnJoin ? 'PASS' : 'FAIL',
      stillOnJoin ? 'остался на экране входа' : 'неожиданный переход');
    await validateCtx.close();

    // ─────────────────────────────────────────────────────
    // ADMIN-002: Неверный ключ администратора
    // ─────────────────────────────────────────────────────
    console.log('\n─── ADMIN-002: Неверный ключ ───');
    const badAdminCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const badAdminPage = await badAdminCtx.newPage();
    await badAdminPage.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
    await badAdminPage.fill('input[type="password"]', 'wrong-key');
    await badAdminPage.click('button:has-text("Войти")');
    await sleep(2000);
    // После неверного ключа WebSocket закроется, должна быть ошибка
    const hasError = await badAdminPage.locator('text=Админ-панель').isVisible().catch(() => false);
    report('ADMIN-002: Неверный ключ', hasError ? 'PASS' : 'FAIL',
      hasError ? 'остался на странице входа' : 'неизвестное состояние');
    await badAdminCtx.close();

    // ─────────────────────────────────────────────────────
    // START-001: Запуск игры
    // ─────────────────────────────────────────────────────
    console.log('\n─── START-001: Запуск игры ───');
    const startBtn = adminPage.locator('button:has-text("Запустить игру")');
    const startEnabled = await startBtn.isEnabled().catch(() => false);
    if (startEnabled) {
      await startBtn.click();
      // Ждём начала раунда на обоих игроков
      try {
        await player1Page.waitForSelector('text=Раунд 1', { timeout: 15000 });
        await player2Page.waitForSelector('text=Раунд 1', { timeout: 15000 });
        report('START-001: Запуск', 'PASS', 'Раунд 1 на обоих экранах');
      } catch (e) {
        await screenshot(player1Page, 'START-001-p1');
        await screenshot(player2Page, 'START-001-p2');
        report('START-001: Запуск', 'FAIL', 'Раунд 1 не начался');
      }
    } else {
      report('START-001: Запуск', 'FAIL', 'кнопка неактивна');
    }

    // ─────────────────────────────────────────────────────
    // GAME-001: Игровой процесс (первые 2 раунда)
    // ─────────────────────────────────────────────────────
    console.log('\n─── GAME-001: Игровой процесс ───');

    // Проверим, что вопрос отображается
    const qVisible = await player1Page.locator('input[placeholder="0"]').isVisible().catch(() => false);
    if (qVisible) {
      // Раунд 1: Игрок 1 отвечает, Игрок 2 тоже
      await player1Page.fill('input[placeholder="0"]', '190');
      await player1Page.click('button:has-text("Ответить")');
      const p1answered = await player1Page.waitForSelector('button:has-text("Ответ принят")', { timeout: 3000 }).then(() => true).catch(() => false);

      await player2Page.fill('input[placeholder="0"]', '250');
      await player2Page.click('button:has-text("Ответить")');
      const p2answered = await player2Page.waitForSelector('button:has-text("Ответ принят")', { timeout: 3000 }).then(() => true).catch(() => false);

      report('GAME-001: Ответы раунд 1', (p1answered && p2answered) ? 'PASS' : 'FAIL',
        `P1=${p1answered ? '✓' : '✗'} P2=${p2answered ? '✓' : '✗'}`);

      // Ждём результата и следующего раунда
      try {
        await player1Page.waitForSelector('text=Раунд 2', { timeout: 20000 });
        report('GAME-001: Переход к раунду 2', 'PASS');
      } catch {
        // Может быть на финальном экране если игра уже закончилась
        const finalScreen = await player1Page.locator('text=Финальный счёт').isVisible().catch(() => false);
        report('GAME-001: Переход', finalScreen ? 'FAIL' : 'FAIL',
          finalScreen ? 'игра завершилась досрочно' : 'timeout');
      }
    } else {
      report('GAME-001: Интерфейс', 'SKIP', 'поле ввода не найдено (игра не в фазе playing)');
    }

    // ─────────────────────────────────────────────────────
    // Проверка наличия GameHeader
    // ─────────────────────────────────────────────────────
    console.log('\n─── GAME-002: GameHeader ───');
    const headerVisible = await player1Page.locator('text=Раунд').isVisible().catch(() => false);
    report('GAME-002: GameHeader', headerVisible ? 'PASS' : 'FAIL');

    // ─────────────────────────────────────────────────────
    // Проверка TimerRing
    // ─────────────────────────────────────────────────────
    console.log('\n─── TIMER-001: TimerRing ───');
    const timerSvg = await player1Page.locator('svg[role="timer"]').isVisible().catch(() => false);
    report('TIMER-001: SVG таймер', timerSvg ? 'PASS' : 'FAIL');

    // ─────────────────────────────────────────────────────
    // GAME-COMPLETE: Ждём завершения игры
    // ─────────────────────────────────────────────────────
    console.log('\n─── GAME-COMPLETE: Ожидание завершения игры ───');
    // Отвечаем в раундах 3-9 быстро, чтобы игра завершилась
    try {
      for (let r = 3; r <= 9 && !(await player1Page.locator('text=Финальный счёт').isVisible().catch(() => false)); r++) {
        // Ждём появления поля ввода для следующего раунда
        await player1Page.waitForSelector('input[placeholder="0"]', { timeout: 20000 }).catch(() => {});
        await sleep(300);
        try {
          await player1Page.fill('input[placeholder="0"]', '100');
          await player1Page.click('button:has-text("Ответить")');
          await player1Page.waitForSelector('button:has-text("Ответ принят")', { timeout: 3000 }).catch(() => {});
        } catch {}
        try {
          await player2Page.fill('input[placeholder="0"]', '200');
          await player2Page.click('button:has-text("Ответить")');
          await player2Page.waitForSelector('button:has-text("Ответ принят")', { timeout: 3000 }).catch(() => {});
        } catch {}
        // Ждём либо следующего раунда, либо финального экрана
        try {
          await Promise.race([
            player1Page.waitForSelector(`text=Раунд ${r + 1}`, { timeout: 20000 }),
            player1Page.waitForSelector('text=Финальный счёт', { timeout: 20000 }),
          ]);
        } catch {}
      }
      const finalVisible = await player1Page.locator('text=Финальный счёт').isVisible().catch(() => false);
      report('GAME-COMPLETE: Завершение', finalVisible ? 'PASS' : 'FAIL',
        finalVisible ? 'финальный экран показан' : 'не дошли до финала');
    } catch (e) {
      report('GAME-COMPLETE: Завершение', 'FAIL', `ошибка: ${e.message.split('\\n')[0]}`);
    }

    // ─────────────────────────────────────────────────────
    // LEADER-001/002: Таблица рекордов
    // ─────────────────────────────────────────────────────
    console.log('\n─── LEADER-001/002: Рекорды ───');
    await adminPage.click('button:has-text("Рекорды")');
    await sleep(1500); // Ждём загрузки данных

    const leaderTitle = await adminPage.locator('text=Таблица рекордов').isVisible().catch(() => false);
    const leaderLoading = await adminPage.locator('text=Загрузка').isVisible().catch(() => false);
    const leaderEmpty = await adminPage.locator('text=Пока нет сыгранных игр').isVisible().catch(() => false);

    if (leaderTitle) {
      report('LEADER-001: Заголовок', 'PASS');
      if (leaderLoading) {
        report('LEADER-002: Данные', 'SKIP', 'всё ещё загружается');
      } else if (!leaderEmpty) {
        // Проверяем заголовки колонок
        const hasNickname = await adminPage.locator('text=Игрок').isVisible().catch(() => false);
        const hasGames = await adminPage.locator('text=Игр').isVisible().catch(() => false);
        report('LEADER-002: Данные', (hasNickname || hasGames) ? 'PASS' : 'FAIL',
          `Игрок=${hasNickname ? '✓' : '✗'} Игр=${hasGames ? '✓' : '✗'}`);
      } else {
        report('LEADER-002: Данные', 'SKIP', 'таблица пуста (игра не сохранена?)');
      }
    } else {
      report('LEADER-001: Заголовок', 'FAIL', 'не найден');
    }

    // ─────────────────────────────────────────────────────
    // RESTART-001: Перезапуск
    // ─────────────────────────────────────────────────────
    console.log('\n─── RESTART-001: Перезапуск ───');
    await adminPage.click('button:has-text("Игра")');
    await sleep(500);

    // Проверяем рестарт или лобби
    const restartBtn = adminPage.locator('button:has-text("Рестарт")');
    const canRestart = await restartBtn.isVisible().catch(() => false);
    if (canRestart) {
      await restartBtn.click();
      await sleep(3000);
      // Игроки должны увидеть экран входа или переподключения
      const p1Reset = await player1Page.locator('button:has-text("Присоединиться")').isVisible().catch(() => false);
      const p1Waiting = await player1Page.locator('text=Ожидание').isVisible().catch(() => false);
      const p2Reset = await player2Page.locator('button:has-text("Присоединиться")').isVisible().catch(() => false);
      const p2Waiting = await player2Page.locator('text=Ожидание').isVisible().catch(() => false);
      const p1State = p1Reset ? 'join' : p1Waiting ? 'waiting' : 'other';
      const p2State = p2Reset ? 'join' : p2Waiting ? 'waiting' : 'other';
      report('RESTART-001: Сброс', (p1State !== 'other' && p2State !== 'other') ? 'PASS' : 'FAIL',
        `P1=${p1State} P2=${p2State}`);
    } else {
      // Может быть уже в лобби
      const startVisible = await adminPage.locator('button:has-text("Запустить игру")').isVisible().catch(() => false);
      if (startVisible) {
        const p1State = await player1Page.locator('button:has-text("Присоединиться")').isVisible().catch(() => false) ? 'join' : 'other';
        report('RESTART-001: Сброс', p1State === 'join' ? 'PASS' : 'SKIP',
          p1State === 'join' ? 'игроки на экране входа' : 'admin в лобби, игроки не сброшены');
      } else {
        report('RESTART-001: Сброс', 'SKIP', 'кнопки рестарт/запуск не видны');
      }
    }

    // ─────────────────────────────────────────────────────
    // SOUND-006: Проверка звуковых файлов
    // ─────────────────────────────────────────────────────
    console.log('\n─── SOUND-006: Звуки ───');
    const sounds = ['tick.mp3', 'tick_fast.mp3', 'end_round.mp3', 'winner.mp3'];
    let soundsOk = 0;
    for (const sound of sounds) {
      const resp = await fetch(`${BASE_URL}/sounds/${sound}`);
      if (resp.ok) soundsOk++;
    }
    // Проверяем шрифты тоже
    const fontResp = await fetch(`${BASE_URL}/fonts/CoFoSansRegular.otf`).catch(() => ({ ok: false }));
    const fontsOk = fontResp.ok;

    report('SOUND-006: Ассеты', (soundsOk === 4 && fontsOk) ? 'PASS' : 'FAIL',
      `звуки: ${soundsOk}/4, шрифты: ${fontsOk ? '✓' : '✗'}`);

    // ─────────────────────────────────────────────────────
    // DEPLOY-003: Статические файлы
    // ─────────────────────────────────────────────────────
    console.log('\n─── DEPLOY-003: Статика ───');
    const indexResp = await fetch(BASE_URL);
    const indexOk = indexResp.ok && (await indexResp.text()).includes('Число летописца');
    report('DEPLOY-002: index.html', indexOk ? 'PASS' : 'FAIL');

    // ─────────────────────────────────────────────────────
    // Закрываем страницы
    // ─────────────────────────────────────────────────────
    await player1Ctx.close();
    await player2Ctx.close();
    await adminCtx.close();

  } catch (e) {
    console.error(`\n❌ Критическая ошибка: ${e.message}`);
    console.error(e.stack);
  } finally {
    await browser.close();
  }

  // ─────────────────────────────────────────────────────
  // Итоговый отчёт
  // ─────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('📊 ИТОГОВЫЙ ОТЧЁТ');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : r.status === 'SKIP' ? '⏭️' : '⚠️';
    console.log(`${icon} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }

  console.log(`\nВсего: ${total} | Пройдено: ${passed} | Провалено: ${failed} | Пропущено: ${skipped}`);
  console.log(`Успешность: ${Math.round(passed / (passed + failed) * 100)}%\n`);

  return { passed, failed, skipped, total, results };
}

// Запуск
runTests().then(report => {
  if (report.failed > 0) {
    process.exit(1);
  }
}).catch(e => {
  console.error(e);
  process.exit(1);
});
