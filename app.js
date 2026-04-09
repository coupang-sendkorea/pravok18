import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const CONFIG = window.APP_CONFIG || {};
const hasSupabaseConfig = Boolean(
  CONFIG.SUPABASE_URL &&
  CONFIG.SUPABASE_KEY &&
  !CONFIG.SUPABASE_URL.includes('PASTE_') &&
  !CONFIG.SUPABASE_KEY.includes('PASTE_')
);

const supabase = hasSupabaseConfig
  ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY)
  : null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = {
  clients: [],
  payments: [],
  expenses: [],
  schedules: [],
  events: [],
  cashTransactions: [],
  loans: [],
  personalRecords: [],
  activeSection: 'dashboard',
  calendarMonth: startOfMonth(new Date()),
  selectedCalendarDate: toDateInputValue(new Date()),
  currentClientId: null,
  currentEventId: null,
  currentCashId: null,
  currentLoanId: null,
  currentPersonalId: null,
  clientDraft: null,
  workspaceKey: null,
};

const els = {
  passwordGate: $('#password-gate'),
  passwordForm: $('#password-form'),
  passwordInput: $('#password-input'),
  appShell: $('#app-shell'),
  configWarning: $('#config-warning'),
  statsGrid: $('#stats-grid'),
  paymentAlerts: $('#payment-alerts'),
  upcomingEvents: $('#upcoming-events'),
  recentCashOps: $('#recent-cash-ops'),
  calendarGrid: $('#calendar-grid'),
  calendarTitle: $('#calendar-title'),
  calendarDayEvents: $('#calendar-day-events'),
  sectionTitle: $('#section-title'),
  sectionSubtitle: $('#section-subtitle'),
  todayLabel: $('#today-label'),
  clientSearch: $('#client-search'),
  clientFilter: $('#client-filter'),
  clientsTable: $('#clients-table'),
  cashSearch: $('#cash-search'),
  cashFilter: $('#cash-filter'),
  cashBalanceCard: $('#cash-balance-card'),
  cashSummaryGrid: $('#cash-summary-grid'),
  cashTable: $('#cash-table'),
  loansOverview: $('#loans-overview'),
  personalSummary: $('#personal-summary'),
  loansTable: $('#loans-table'),
  personalTable: $('#personal-table'),
  archiveTable: $('#archive-table'),
  eventsTable: $('#events-table'),
  clientModal: $('#client-modal'),
  eventModal: $('#event-modal'),
  cashModal: $('#cash-modal'),
  loanModal: $('#loan-modal'),
  personalModal: $('#personal-modal'),
  clientModalTitle: $('#client-modal-title'),
  eventModalTitle: $('#event-modal-title'),
  cashModalTitle: $('#cash-modal-title'),
  loanModalTitle: $('#loan-modal-title'),
  personalModalTitle: $('#personal-modal-title'),
  financeSummary: $('#client-finance-summary'),
  paymentsList: $('#payments-list'),
  expensesList: $('#expenses-list'),
  scheduleList: $('#schedule-list'),
  eventClientId: $('#event-client-id'),
  refreshBtn: $('#refresh-btn'),
  openClientBtn: $('#open-client-btn'),
  openEventBtn: $('#open-event-btn'),
  openCashBtn: $('#open-cash-btn'),
  openCashInlineBtn: $('#open-cash-inline-btn'),
  openLoanBtn: $('#open-loan-btn'),
  openPersonalBtn: $('#open-personal-btn'),
  prevMonthBtn: $('#prev-month-btn'),
  nextMonthBtn: $('#next-month-btn'),
  saveClientBtn: $('#save-client-btn'),
  archiveClientBtn: $('#archive-client-btn'),
  restoreClientBtn: $('#restore-client-btn'),
  saveEventBtn: $('#save-event-btn'),
  saveCashBtn: $('#save-cash-btn'),
  saveLoanBtn: $('#save-loan-btn'),
  savePersonalBtn: $('#save-personal-btn'),
};

const clientFields = {
  full_name: $('#client-full-name'),
  case_title: $('#client-case-title'),
  phone: $('#client-phone'),
  email: $('#client-email'),
  messenger: $('#client-messenger'),
  address: $('#client-address'),
  notes: $('#client-notes'),
  contract_amount: $('#client-contract-amount'),
  payment_type: $('#client-payment-type'),
  payment_deadline: $('#client-payment-deadline'),
  payment_reminder_date: $('#client-payment-reminder'),
};

const eventFields = {
  title: $('#event-title'),
  client_id: $('#event-client-id'),
  event_date: $('#event-date'),
  event_time: $('#event-time'),
  description: $('#event-description'),
};

const cashFields = {
  entry_date: $('#cash-date'),
  flow_type: $('#cash-type'),
  account_type: $('#cash-account-type'),
  purpose: $('#cash-purpose'),
  related_loan_id: $('#cash-loan-id'),
  category: $('#cash-category'),
  amount: $('#cash-amount'),
  description: $('#cash-description'),
};

const loanFields = {
  lender_name: $('#loan-lender-name'),
  loan_title: $('#loan-title'),
  issue_date: $('#loan-issue-date'),
  due_date: $('#loan-due-date'),
  principal_amount: $('#loan-amount'),
  received_account_type: $('#loan-account-type'),
  description: $('#loan-description'),
};

const personalFields = {
  record_date: $('#personal-date'),
  person_name: $('#personal-person'),
  record_type: $('#personal-type'),
  account_type: $('#personal-account-type'),
  amount: $('#personal-amount'),
  description: $('#personal-description'),
};

init();

function init() {
  bindGlobalEvents();
  els.todayLabel.textContent = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const unlocked = sessionStorage.getItem('law-crm-unlocked') === 'yes';
  const savedWorkspaceKey = sessionStorage.getItem('law-crm-workspace-key');
  if (unlocked && savedWorkspaceKey) {
    state.workspaceKey = savedWorkspaceKey;
    unlockApp();
  }
}

function bindGlobalEvents() {
  els.passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const expectedPassword = CONFIG.APP_PASSWORD || 'pravo888';
    if (els.passwordInput.value === expectedPassword) {
      state.workspaceKey = await buildWorkspaceKey(els.passwordInput.value);
      sessionStorage.setItem('law-crm-unlocked', 'yes');
      sessionStorage.setItem('law-crm-workspace-key', state.workspaceKey);
      unlockApp();
      return;
    }
    showToast('Неверный пароль.', 'error');
  });

  $$('.menu-item').forEach((button) => {
    button.addEventListener('click', () => switchSection(button.dataset.section));
  });

  document.body.addEventListener('click', handleBodyClick);
  document.body.addEventListener('input', handleBodyInput);
  document.body.addEventListener('change', handleBodyInput);

  $$('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => closeModal(button.dataset.closeModal));
  });

  els.refreshBtn.addEventListener('click', () => loadAllData({ silent: false }));
  els.openClientBtn.addEventListener('click', () => openClientModal());
  els.openEventBtn.addEventListener('click', () => openEventModal());
  els.openCashBtn.addEventListener('click', () => openCashModal());
  els.openCashInlineBtn?.addEventListener('click', () => openCashModal());
  els.openLoanBtn?.addEventListener('click', () => openLoanModal());
  els.openPersonalBtn?.addEventListener('click', () => openPersonalModal());
  els.prevMonthBtn.addEventListener('click', () => {
    state.calendarMonth = addMonths(state.calendarMonth, -1);
    renderCalendar();
  });
  els.nextMonthBtn.addEventListener('click', () => {
    state.calendarMonth = addMonths(state.calendarMonth, 1);
    renderCalendar();
  });
  els.clientSearch.addEventListener('input', renderClientsTable);
  els.clientFilter.addEventListener('change', renderClientsTable);
  els.cashSearch?.addEventListener('input', renderCashSection);
  els.cashFilter?.addEventListener('change', renderCashSection);
  $('#add-payment-btn').addEventListener('click', () => addDraftRow('payments'));
  $('#add-expense-btn').addEventListener('click', () => addDraftRow('expenses'));
  $('#add-schedule-btn').addEventListener('click', () => addDraftRow('schedules'));
  els.saveClientBtn.addEventListener('click', saveClient);
  els.archiveClientBtn.addEventListener('click', archiveCurrentClient);
  els.restoreClientBtn.addEventListener('click', restoreCurrentClient);
  els.saveEventBtn.addEventListener('click', saveEvent);
  els.saveCashBtn?.addEventListener('click', saveCashTransaction);
  els.saveLoanBtn?.addEventListener('click', saveLoan);
  els.savePersonalBtn?.addEventListener('click', savePersonalRecord);
  cashFields.purpose?.addEventListener('change', syncCashPurposeUI);
  personalFields.record_type?.addEventListener('change', syncPersonalTypeUI);
}

async function unlockApp() {
  els.passwordGate.classList.add('hidden');
  els.appShell.classList.remove('hidden');

  if (!hasSupabaseConfig) {
    els.configWarning.classList.remove('hidden');
    renderAll();
    return;
  }

  if (!state.workspaceKey) {
    showToast('Не удалось определить рабочее пространство по паролю.', 'error');
    return;
  }

  els.configWarning.classList.add('hidden');
  await loadAllData({ silent: false });
}

async function loadAllData({ silent = true } = {}) {
  if (!supabase) {
    renderAll();
    return;
  }

  try {
    if (!silent) showToast('Обновляю данные…', 'info', 1400);
    await migrateLegacyWorkspaceIfNeeded();

    const [clientsRes, paymentsRes, expensesRes, schedulesRes, eventsRes, cashRes, loansRes, personalRes] = await Promise.all([
      supabase.from('clients').select('*').eq('workspace_key', state.workspaceKey).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('workspace_key', state.workspaceKey).order('payment_date', { ascending: false }),
      supabase.from('expenses').select('*').eq('workspace_key', state.workspaceKey).order('expense_date', { ascending: false }),
      supabase.from('payment_schedules').select('*').eq('workspace_key', state.workspaceKey).order('due_date', { ascending: true }),
      supabase.from('events').select('*').eq('workspace_key', state.workspaceKey).order('event_date', { ascending: true }).order('event_time', { ascending: true }),
      supabase.from('cash_transactions').select('*').eq('workspace_key', state.workspaceKey).order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('loans').select('*').eq('workspace_key', state.workspaceKey).order('issue_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('personal_records').select('*').eq('workspace_key', state.workspaceKey).order('record_date', { ascending: false }).order('created_at', { ascending: false }),
    ]);

    const responses = [clientsRes, paymentsRes, expensesRes, schedulesRes, eventsRes, cashRes, loansRes, personalRes];
    const firstError = responses.find((response) => response.error)?.error;
    if (firstError) throw firstError;

    state.clients = clientsRes.data || [];
    state.payments = paymentsRes.data || [];
    state.expenses = expensesRes.data || [];
    state.schedules = schedulesRes.data || [];
    state.events = eventsRes.data || [];
    state.cashTransactions = cashRes.data || [];
    state.loans = loansRes.data || [];
    state.personalRecords = personalRes.data || [];

    renderAll();
  } catch (error) {
    console.error(error);
    const message = error?.message || String(error);
    if (message.includes('workspace_key') || message.includes('cash_transactions') || message.includes('loans') || message.includes('personal_records') || message.includes('payment_channel') || message.includes('account_type')) {
      showToast('Нужно обновить базу Supabase: еще раз выполните новый файл supabase-schema.sql.', 'error', 8000);
      return;
    }
    showToast(`Ошибка загрузки: ${message}`, 'error', 5000);
  }
}

async function migrateLegacyWorkspaceIfNeeded() {
  if (!supabase || !state.workspaceKey) return;

  const { count: currentCount, error: currentError } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_key', state.workspaceKey);

  if (currentError) throw currentError;
  if ((currentCount || 0) > 0) return;

  const { count: legacyCount, error: legacyError } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .is('workspace_key', null);

  if (legacyError) throw legacyError;
  if ((legacyCount || 0) === 0) return;

  const confirmed = window.confirm('Найдены старые данные без привязки к паролю. Привязать их к текущему паролю, чтобы они открывались на всех устройствах?');
  if (!confirmed) return;

  const tableNames = ['clients', 'payments', 'expenses', 'payment_schedules', 'events'];
  for (const tableName of tableNames) {
    const { error } = await supabase
      .from(tableName)
      .update({ workspace_key: state.workspaceKey })
      .is('workspace_key', null);

    if (error) throw error;
  }

  showToast('Старые данные привязаны к текущему паролю.', 'success', 4200);
}

function renderAll() {
  renderStats();
  renderAlerts();
  renderUpcomingEvents();
  renderRecentCashOps();
  renderCalendar();
  renderClientsTable();
  renderCashSection();
  renderLoansTable();
  renderPersonalTable();
  renderArchiveTable();
  renderEventsTable();
  populateEventClientOptions();
  populateLoanOptions();
}

function renderStats() {
  const activeClients = state.clients.filter((client) => client.case_status !== 'archived');
  const archivedClients = state.clients.filter((client) => client.case_status === 'archived');

  const totals = activeClients.reduce((acc, client) => {
    const summary = getClientSummary(client.id);
    acc.contract += parseNumber(client.contract_amount);
    acc.paid += summary.paid;
    acc.debt += summary.debt;
    acc.expenses += summary.expenses;
    return acc;
  }, { contract: 0, paid: 0, debt: 0, expenses: 0 });

  const cash = getCashMetrics();
  const loans = getLoanMetrics();
  const personal = getPersonalMetrics();
  const upcomingPayments = buildPaymentAlerts().filter((item) => item.kind !== 'overdue').length;
  const upcomingEventsCount = getUpcomingEvents(14).length;

  const stats = [
    { label: 'Активные дела', value: activeClients.length, subtext: `В архиве: ${archivedClients.length}` },
    { label: 'Сумма договоров', value: formatMoney(totals.contract), subtext: 'Сумма договоров фиксируется отдельно' },
    { label: 'Оплачено по договорам', value: formatMoney(totals.paid), subtext: 'Считается по внесённым оплатам' },
    { label: 'Остаток долга', value: formatMoney(totals.debt), subtext: 'Уменьшается автоматически' },
    { label: 'Касса общая', value: formatSignedMoney(cash.balance), subtext: `Наличные: ${formatSignedMoney(cash.cashBalance)} · Безнал: ${formatSignedMoney(cash.cashlessBalance)}` },
    { label: 'Займы к погашению', value: formatMoney(loans.outstandingTotal), subtext: `Активных займов: ${loans.activeCount}` },
    { label: 'Личные расчёты', value: formatSignedMoney(personal.netCompanyLiability), subtext: 'Плюс: компания должна · минус: должны компании' },
    { label: 'Ближайшие события', value: upcomingEventsCount, subtext: `Напоминаний по оплатам: ${upcomingPayments}` },
  ];

  els.statsGrid.innerHTML = stats.map((item) => `
    <article class="glass-card stat-card">
      <div class="stat-label">${escapeHtml(item.label)}</div>
      <div class="stat-value">${escapeHtml(String(item.value))}</div>
      <div class="stat-subtext">${escapeHtml(item.subtext)}</div>
    </article>
  `).join('');
}

function renderAlerts() {
  const alerts = buildPaymentAlerts();
  if (!alerts.length) {
    els.paymentAlerts.innerHTML = emptyCard('Нет просрочек и ближайших оплат.');
    return;
  }

  els.paymentAlerts.innerHTML = alerts.map((item) => `
    <article class="alert-card ${item.kind}">
      <strong>${escapeHtml(item.title)}</strong>
      <div>${escapeHtml(item.subtitle)}</div>
      <div class="muted small">${escapeHtml(item.meta)}</div>
    </article>
  `).join('');
}

function buildPaymentAlerts() {
  const today = stripTime(new Date());
  const in7Days = addDays(today, 7);
  const alerts = [];

  state.clients
    .filter((client) => client.case_status !== 'archived')
    .forEach((client) => {
      const summary = getClientSummary(client.id);
      const reminderDate = parseDateSafe(client.payment_reminder_date);
      const deadlineDate = parseDateSafe(client.payment_deadline);
      const scheduleRows = state.schedules.filter((row) => row.client_id === client.id);

      if (summary.debt > 0 && deadlineDate && deadlineDate < today) {
        alerts.push({
          kind: 'overdue',
          title: `${client.full_name}: просрочена оплата`,
          subtitle: `Остаток долга ${formatMoney(summary.debt)}. Срок оплаты был ${formatDate(client.payment_deadline)}.`,
          meta: client.case_title || 'Без названия дела',
        });
      } else if (summary.debt > 0 && reminderDate && reminderDate >= today && reminderDate <= in7Days) {
        alerts.push({
          kind: 'soon',
          title: `${client.full_name}: напоминание об оплате`,
          subtitle: `Напомнить ${formatDate(client.payment_reminder_date)}. Остаток долга ${formatMoney(summary.debt)}.`,
          meta: client.payment_type || 'Способ оплаты не указан',
        });
      }

      scheduleRows.forEach((row) => {
        const dueDate = parseDateSafe(row.due_date);
        if (!dueDate || row.status === 'completed') return;
        if (dueDate < today) {
          alerts.push({
            kind: 'overdue',
            title: `${client.full_name}: просрочен этап графика`,
            subtitle: `По графику ожидалась сумма ${formatMoney(parseNumber(row.planned_amount))} до ${formatDate(row.due_date)}.`,
            meta: row.note || 'Этап графика оплаты',
          });
        } else if (dueDate <= in7Days) {
          alerts.push({
            kind: 'soon',
            title: `${client.full_name}: скоро платеж по графику`,
            subtitle: `Нужно оплатить ${formatMoney(parseNumber(row.planned_amount))} до ${formatDate(row.due_date)}.`,
            meta: row.note || 'Этап графика оплаты',
          });
        }
      });
    });

  return alerts.slice(0, 12);
}

function renderUpcomingEvents() {
  const items = getUpcomingEvents(14);
  if (!items.length) {
    els.upcomingEvents.innerHTML = emptyCard('На ближайшие дни событий нет.');
    return;
  }

  els.upcomingEvents.innerHTML = items.map((event) => {
    const clientName = getClientName(event.client_id);
    return `
      <article class="event-card compact-event-card">
        <strong>${escapeHtml(event.title)}</strong>
        <div>${escapeHtml(formatEventDateTime(event))}</div>
        <div class="muted small">${escapeHtml(clientName || 'Без привязки к клиенту')}</div>
        ${event.description ? `<div class="muted small line-clamp-2">${escapeHtml(event.description)}</div>` : ''}
      </article>
    `;
  }).join('');
}

function renderRecentCashOps() {
  const rows = getCashLedgerRows().slice(0, 8);
  if (!rows.length) {
    els.recentCashOps.innerHTML = emptyCard('Операции по кассе пока не добавлены.');
    return;
  }

  els.recentCashOps.innerHTML = rows.map((row) => `
    <article class="event-card compact-event-card ${row.flowType === 'income' ? 'income-card' : 'expense-card'}">
      <div class="split-line">
        <strong>${escapeHtml(row.title)}</strong>
        <span class="money-inline ${row.flowType === 'income' ? 'income' : 'expense'}">${escapeHtml(formatSignedMoney(row.signedAmount))}</span>
      </div>
      <div class="mini-inline-pills">
        <span class="pill soft">${escapeHtml(accountTypeLabel(row.accountType))}</span>
        <span class="pill ${row.flowType === 'income' ? 'ok' : 'danger'}">${escapeHtml(row.sourceLabel)}</span>
      </div>
      <div class="muted small">${escapeHtml(formatDate(row.date))}</div>
      <div class="muted small line-clamp-2">${escapeHtml(row.description)}</div>
    </article>
  `).join('');
}

function renderCalendar() {
  const monthStart = startOfMonth(state.calendarMonth);
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const cells = [];

  els.calendarTitle.textContent = capitalize(new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
  }).format(monthStart));

  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  dayNames.forEach((dayName) => {
    cells.push(`<div class="calendar-day-name">${dayName}</div>`);
  });

  for (let current = new Date(gridStart); current <= gridEnd; current = addDays(current, 1)) {
    const iso = toDateInputValue(current);
    const dayEvents = state.events.filter((event) => event.event_date === iso);
    const isCurrentMonth = current.getMonth() === monthStart.getMonth();
    const isToday = iso === toDateInputValue(new Date());
    const isSelected = iso === state.selectedCalendarDate;
    const lines = dayEvents.slice(0, 2).map((event) => `
      <div class="calendar-event-line">
        <span class="calendar-event-time">${escapeHtml(event.event_time || '')}</span>
        <span class="calendar-event-title">${escapeHtml(shorten(event.title, 22))}</span>
      </div>
    `).join('');
    const extra = dayEvents.length > 2 ? `<div class="calendar-more">+ ещё ${dayEvents.length - 2}</div>` : '';

    cells.push(`
      <button class="calendar-cell ${!isCurrentMonth ? 'muted-month' : ''} ${isToday ? 'today' : ''} ${dayEvents.length ? 'has-events' : ''} ${isSelected ? 'selected' : ''}" type="button" data-calendar-date="${iso}">
        <div class="calendar-cell-top">
          <div class="calendar-day-number">${current.getDate()}</div>
          ${dayEvents.length ? `<span class="calendar-count">${dayEvents.length}</span>` : ''}
        </div>
        <div class="calendar-events-preview">
          ${lines || '<div class="calendar-empty">—</div>'}
          ${extra}
        </div>
      </button>
    `);
  }

  els.calendarGrid.innerHTML = cells.join('');
  renderCalendarDayEvents(state.selectedCalendarDate);
}

function renderCalendarDayEvents(dateString) {
  state.selectedCalendarDate = dateString;
  const events = state.events
    .filter((event) => event.event_date === dateString)
    .sort((a, b) => `${a.event_time || ''} ${a.title || ''}`.localeCompare(`${b.event_time || ''} ${b.title || ''}`));

  if (!events.length) {
    els.calendarDayEvents.innerHTML = `
      <div class="calendar-day-panel glass-subcard">
        <div class="section-inline-head">
          <div>
            <h4>${escapeHtml(`События на ${formatDate(dateString)}`)}</h4>
            <p class="muted">На выбранную дату записей нет.</p>
          </div>
          <button class="btn btn-primary btn-sm" type="button" data-add-event-date="${dateString}">Добавить событие</button>
        </div>
      </div>
    `;
    return;
  }

  els.calendarDayEvents.innerHTML = `
    <div class="calendar-day-panel glass-subcard">
      <div class="section-inline-head">
        <div>
          <h4>${escapeHtml(`События на ${formatDate(dateString)}`)}</h4>
          <p class="muted">${escapeHtml(`Всего событий: ${events.length}. Открыт полный список записей на выбранную дату.`)}</p>
        </div>
        <button class="btn btn-primary btn-sm" type="button" data-add-event-date="${dateString}">Добавить событие</button>
      </div>
      <div class="day-events-grid">
        ${events.map((event) => `
          <article class="event-card day-event-card full-event-card">
            <div class="split-line gap-wrap">
              <strong class="event-title-full">${escapeHtml(event.title)}</strong>
              <span class="pill soft">${escapeHtml(event.event_time || 'Без времени')}</span>
            </div>
            <div class="event-meta-grid muted small">
              <div><span class="meta-label">Клиент:</span> ${escapeHtml(getClientName(event.client_id) || 'Без привязки к клиенту')}</div>
              <div><span class="meta-label">Дата:</span> ${escapeHtml(formatDate(event.event_date))}</div>
            </div>
            <div class="event-description-full">
              <div class="meta-label">Описание</div>
              <div>${escapeHtml(event.description || 'Описание не указано.')}</div>
            </div>
            <div class="toolbar-group">
              <button class="btn btn-secondary btn-sm" type="button" data-edit-event="${event.id}">Изменить</button>
              <button class="btn btn-danger btn-sm" type="button" data-delete-event="${event.id}">Удалить</button>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function renderClientsTable() {
  const search = (els.clientSearch.value || '').trim().toLowerCase();
  const filter = els.clientFilter.value;
  const today = stripTime(new Date());

  let clients = state.clients.filter((client) => client.case_status !== 'archived');

  if (search) {
    clients = clients.filter((client) => [
      client.full_name,
      client.case_title,
      client.phone,
      client.email,
      client.messenger,
      client.address,
    ].some((value) => String(value || '').toLowerCase().includes(search)));
  }

  if (filter === 'overdue') {
    clients = clients.filter((client) => {
      const summary = getClientSummary(client.id);
      const deadline = parseDateSafe(client.payment_deadline);
      return summary.debt > 0 && deadline && deadline < today;
    });
  }
  if (filter === 'debt') {
    clients = clients.filter((client) => getClientSummary(client.id).debt > 0);
  }
  if (filter === 'scheduled') {
    clients = clients.filter((client) => client.payment_type === 'по графику');
  }

  if (!clients.length) {
    els.clientsTable.innerHTML = emptyCard('Клиенты не найдены.');
    return;
  }

  els.clientsTable.innerHTML = `
    <table class="table clients-table">
      <thead>
        <tr>
          <th>ФИО клиента</th>
          <th>Контактная информация</th>
          <th>Дело / услуга</th>
          <th>Сумма договора</th>
          <th>Способ оплаты</th>
          <th>Срок оплаты</th>
          <th>Оплачено</th>
          <th>Остаток долга</th>
          <th>Расходы конторы</th>
          <th>Напоминание</th>
          <th>Архив</th>
        </tr>
      </thead>
      <tbody>
        ${clients.map((client) => {
          const summary = getClientSummary(client.id);
          const contacts = [client.phone, client.email, client.messenger, client.address].filter(Boolean);
          return `
            <tr>
              <td>
                <div class="clickable-name" data-open-client="${client.id}">${escapeHtml(client.full_name)}</div>
              </td>
              <td>
                <div class="cell-stack">
                  ${contacts.length ? contacts.map((item) => `<div class="mini-meta">${escapeHtml(item)}</div>`).join('') : '<div class="mini-meta">Контакты не заполнены</div>'}
                </div>
              </td>
              <td><div class="wrap-cell">${escapeHtml(client.case_title || '—')}</div></td>
              <td>${escapeHtml(formatMoney(parseNumber(client.contract_amount)))}</td>
              <td>${escapeHtml(client.payment_type || '—')}</td>
              <td>${escapeHtml(formatDate(client.payment_deadline))}</td>
              <td>${escapeHtml(formatMoney(summary.paid))}</td>
              <td>${renderDebtPill(summary.debt)}</td>
              <td>${escapeHtml(formatMoney(summary.expenses))}</td>
              <td>${escapeHtml(formatDate(client.payment_reminder_date))}</td>
              <td>
                <button class="btn btn-danger btn-sm btn-nowrap" type="button" data-archive-id="${client.id}">Убрать в архив</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderCashSection() {
  const cash = getCashMetrics();
  const loans = getLoanMetrics();
  const personal = getPersonalMetrics();

  els.cashBalanceCard.innerHTML = `
    <div class="eyebrow">Касса</div>
    <div class="cash-balance ${cash.balance < 0 ? 'negative' : 'positive'}">${escapeHtml(formatSignedMoney(cash.balance))}</div>
    <div class="cash-balance-split">
      <div class="capsule compact-capsule small-capsule">
        <div class="capsule-label">Наличный расчёт</div>
        <div class="capsule-value">${escapeHtml(formatSignedMoney(cash.cashBalance))}</div>
      </div>
      <div class="capsule compact-capsule small-capsule">
        <div class="capsule-label">Безналичный расчёт</div>
        <div class="capsule-value">${escapeHtml(formatSignedMoney(cash.cashlessBalance))}</div>
      </div>
    </div>
    <div class="muted">В расчёт входят оплаты по договорам, займы, погашения, личные расчёты и иные операции.</div>
  `;

  const summaryItems = [
    { label: 'Оплаты по договорам', value: formatMoney(cash.contractIncome) },
    { label: 'Расходы конторы', value: formatMoney(cash.officeExpenses) },
    { label: 'Иные доходы', value: formatMoney(cash.otherIncome) },
    { label: 'Иные расходы', value: formatMoney(cash.otherExpense) },
    { label: 'Полученные займы', value: formatMoney(loans.principalTotal) },
    { label: 'К погашению', value: formatMoney(loans.outstandingTotal) },
  ];
  els.cashSummaryGrid.innerHTML = summaryItems.map((item) => `
    <div class="capsule compact-capsule">
      <div class="capsule-label">${escapeHtml(item.label)}</div>
      <div class="capsule-value">${escapeHtml(item.value)}</div>
    </div>
  `).join('');

  if (!loans.items.length) {
    els.loansOverview.innerHTML = emptyCard('Активных займов нет.');
  } else {
    els.loansOverview.innerHTML = loans.items.slice(0, 4).map((loan) => `
      <article class="event-card compact-event-card">
        <div class="split-line">
          <strong>${escapeHtml(loan.lender_name)}</strong>
          <span class="pill warn">${escapeHtml(formatMoney(loan.outstanding))}</span>
        </div>
        <div class="muted small">${escapeHtml(loan.loan_title || 'Без названия')}</div>
        <div class="muted small">Срок: ${escapeHtml(formatDate(loan.due_date))} · ${escapeHtml(accountTypeLabel(loan.received_account_type))}</div>
      </article>
    `).join('');
  }

  els.personalSummary.innerHTML = ['Ильвар', 'Рустам'].map((person) => {
    const amount = personal.balances[person] || 0;
    const statusText = amount > 0
      ? `Компания должна ${person.toLowerCase()}у`
      : amount < 0
        ? `${person} должен компании`
        : 'Расчёты закрыты';
    return `
      <article class="event-card compact-event-card">
        <div class="split-line">
          <strong>${escapeHtml(person)}</strong>
          <span class="pill ${amount >= 0 ? 'ok' : 'danger'}">${escapeHtml(formatSignedMoney(amount))}</span>
        </div>
        <div class="muted small">${escapeHtml(statusText)}</div>
      </article>
    `;
  }).join('');

  const search = (els.cashSearch?.value || '').trim().toLowerCase();
  const filter = els.cashFilter?.value || 'all';
  let rows = getCashLedgerRows();

  if (filter !== 'all') {
    rows = rows.filter((row) => row.flowType === filter);
  }
  if (search) {
    rows = rows.filter((row) => [row.title, row.description, row.clientName, row.category, row.sourceLabel, accountTypeLabel(row.accountType)]
      .some((value) => String(value || '').toLowerCase().includes(search)));
  }

  if (!rows.length) {
    els.cashTable.innerHTML = emptyCard('Операции не найдены.');
    return;
  }

  els.cashTable.innerHTML = `
    <table class="table cash-table">
      <thead>
        <tr>
          <th>Дата</th>
          <th>Касса</th>
          <th>Тип</th>
          <th>Источник</th>
          <th>Категория</th>
          <th>Клиент</th>
          <th>Описание</th>
          <th>Сумма</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(formatDate(row.date))}</td>
            <td><span class="pill soft">${escapeHtml(accountTypeLabel(row.accountType))}</span></td>
            <td><span class="pill ${row.flowType === 'income' ? 'ok' : 'danger'}">${escapeHtml(row.flowType === 'income' ? 'Доход' : 'Расход')}</span></td>
            <td>${escapeHtml(row.sourceLabel)}</td>
            <td>${escapeHtml(row.category || '—')}</td>
            <td>${escapeHtml(row.clientName || '—')}</td>
            <td><div class="wrap-cell">${escapeHtml(row.description || '—')}</div></td>
            <td><span class="money-inline ${row.flowType === 'income' ? 'income' : 'expense'}">${escapeHtml(formatSignedMoney(row.signedAmount))}</span></td>
            <td>
              <div class="toolbar-group">
                ${row.sourceType === 'cash'
                  ? `
                    <button class="btn btn-secondary btn-sm" type="button" data-edit-cash="${row.id}">Изменить</button>
                    <button class="btn btn-danger btn-sm" type="button" data-delete-cash="${row.id}">Удалить</button>
                  `
                  : row.sourceType === 'loan'
                    ? `<button class="btn btn-secondary btn-sm" type="button" data-repay-loan="${row.id}">Погасить</button>`
                    : row.clientId
                      ? `<button class="btn btn-secondary btn-sm" type="button" data-open-client="${row.clientId}">Открыть дело</button>`
                      : '<span class="muted small">—</span>'}
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderLoansTable() {
  const metrics = getLoanMetrics();
  if (!metrics.items.length) {
    els.loansTable.innerHTML = emptyCard('Займов пока нет.');
    return;
  }

  els.loansTable.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Кредитор</th>
          <th>Пометка</th>
          <th>Дата получения</th>
          <th>Срок возврата</th>
          <th>Касса</th>
          <th>Сумма займа</th>
          <th>Погашено</th>
          <th>Остаток</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${metrics.items.map((loan) => `
          <tr>
            <td>${escapeHtml(loan.lender_name)}</td>
            <td><div class="wrap-cell">${escapeHtml(loan.loan_title || '—')}</div></td>
            <td>${escapeHtml(formatDate(loan.issue_date))}</td>
            <td>${escapeHtml(formatDate(loan.due_date))}</td>
            <td>${escapeHtml(accountTypeLabel(loan.received_account_type))}</td>
            <td>${escapeHtml(formatMoney(loan.principal_amount))}</td>
            <td>${escapeHtml(formatMoney(loan.repaid))}</td>
            <td>${renderDebtPill(loan.outstanding)}</td>
            <td>
              <div class="toolbar-group">
                <button class="btn btn-secondary btn-sm" type="button" data-edit-loan="${loan.id}">Изменить</button>
                <button class="btn btn-secondary btn-sm" type="button" data-repay-loan="${loan.id}">Погасить</button>
                <button class="btn btn-danger btn-sm" type="button" data-delete-loan="${loan.id}">Удалить</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderPersonalTable() {
  if (!state.personalRecords.length) {
    els.personalTable.innerHTML = emptyCard('Личные расчёты пока не добавлены.');
    return;
  }

  const rows = [...state.personalRecords].sort((a, b) => `${b.record_date || ''} ${b.created_at || ''}`.localeCompare(`${a.record_date || ''} ${a.created_at || ''}`));
  els.personalTable.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Дата</th>
          <th>Сотрудник</th>
          <th>Тип записи</th>
          <th>Касса</th>
          <th>Сумма</th>
          <th>Для нас</th>
          <th>Описание</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => {
          const effect = getPersonalRecordEffect(row);
          return `
            <tr>
              <td>${escapeHtml(formatDate(row.record_date))}</td>
              <td>${escapeHtml(row.person_name)}</td>
              <td>${escapeHtml(personalRecordTypeLabel(row.record_type))}</td>
              <td>${escapeHtml(accountTypeLabel(row.account_type))}</td>
              <td>${escapeHtml(formatMoney(row.amount))}</td>
              <td><span class="pill ${effect.balanceDelta >= 0 ? 'ok' : 'danger'}">${escapeHtml(formatSignedMoney(effect.balanceDelta))}</span></td>
              <td><div class="wrap-cell">${escapeHtml(row.description || '—')}</div></td>
              <td>
                <div class="toolbar-group">
                  <button class="btn btn-secondary btn-sm" type="button" data-edit-personal="${row.id}">Изменить</button>
                  <button class="btn btn-danger btn-sm" type="button" data-delete-personal="${row.id}">Удалить</button>
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderArchiveTable() {
  const archived = state.clients.filter((client) => client.case_status === 'archived');
  if (!archived.length) {
    els.archiveTable.innerHTML = emptyCard('Архив пока пуст.');
    return;
  }

  els.archiveTable.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Клиент</th>
          <th>Дело</th>
          <th>Сумма договора</th>
          <th>Оплачено</th>
          <th>Долг</th>
          <th>Дата завершения</th>
          <th>Действие</th>
        </tr>
      </thead>
      <tbody>
        ${archived.map((client) => {
          const summary = getClientSummary(client.id);
          return `
            <tr>
              <td>${escapeHtml(client.full_name)}</td>
              <td>${escapeHtml(client.case_title || '—')}</td>
              <td>${escapeHtml(formatMoney(parseNumber(client.contract_amount)))}</td>
              <td>${escapeHtml(formatMoney(summary.paid))}</td>
              <td>${escapeHtml(formatMoney(summary.debt))}</td>
              <td>${escapeHtml(formatDateTime(client.case_completed_at))}</td>
              <td><button class="btn btn-secondary btn-sm" type="button" data-restore-id="${client.id}">Вернуть</button></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderEventsTable() {
  if (!state.events.length) {
    els.eventsTable.innerHTML = emptyCard('События еще не добавлены.');
    return;
  }

  els.eventsTable.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Дата</th>
          <th>Время</th>
          <th>Событие</th>
          <th>Клиент</th>
          <th>Описание</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${state.events.map((event) => `
          <tr>
            <td>${escapeHtml(formatDate(event.event_date))}</td>
            <td>${escapeHtml(event.event_time || '—')}</td>
            <td>${escapeHtml(event.title)}</td>
            <td>${escapeHtml(getClientName(event.client_id) || '—')}</td>
            <td><div class="wrap-cell">${escapeHtml(event.description || '—')}</div></td>
            <td>
              <div class="toolbar-group">
                <button class="btn btn-secondary btn-sm" type="button" data-edit-event="${event.id}">Изменить</button>
                <button class="btn btn-danger btn-sm" type="button" data-delete-event="${event.id}">Удалить</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function populateEventClientOptions() {
  const options = ['<option value="">Без привязки</option>']
    .concat(state.clients.map((client) => `<option value="${client.id}">${escapeHtml(client.full_name)}</option>`));
  els.eventClientId.innerHTML = options.join('');
}

function populateLoanOptions() {
  if (!cashFields.related_loan_id) return;
  const loans = getLoanMetrics().items;
  const options = ['<option value="">Без привязки</option>']
    .concat(loans.map((loan) => `<option value="${loan.id}">${escapeHtml(`${loan.lender_name} — остаток ${formatMoney(loan.outstanding)}`)}</option>`));
  cashFields.related_loan_id.innerHTML = options.join('');
}

function switchSection(section) {
  state.activeSection = section;
  const map = {
    dashboard: {
      title: 'Главная',
      subtitle: 'Обзор дел, платежей, кассы и ближайших событий.',
    },
    clients: {
      title: 'Клиенты',
      subtitle: 'Карточки клиентов и финансовая информация.',
    },
    cash: {
      title: 'Касса',
      subtitle: 'Наличный и безналичный баланс, займы, личные расчёты и движение денег.',
    },
    archive: {
      title: 'Архив',
      subtitle: 'Завершенные дела и история по ним.',
    },
    events: {
      title: 'События',
      subtitle: 'Все встречи, заседания и дедлайны.',
    },
  };

  $$('.menu-item').forEach((item) => item.classList.toggle('active', item.dataset.section === section));
  $('#dashboard-section').classList.toggle('hidden', section !== 'dashboard');
  $('#clients-section').classList.toggle('hidden', section !== 'clients');
  $('#cash-section').classList.toggle('hidden', section !== 'cash');
  $('#archive-section').classList.toggle('hidden', section !== 'archive');
  $('#events-section').classList.toggle('hidden', section !== 'events');
  els.sectionTitle.textContent = map[section].title;
  els.sectionSubtitle.textContent = map[section].subtitle;
}

function openClientModal(clientId = null) {
  const client = clientId ? state.clients.find((item) => item.id === clientId) : null;
  const payments = client ? state.payments.filter((item) => item.client_id === clientId).map((item) => ({ ...item, payment_channel: item.payment_channel || 'cashless' })) : [];
  const expenses = client ? state.expenses.filter((item) => item.client_id === clientId).map((item) => ({ ...item, payment_channel: item.payment_channel || 'cashless' })) : [];
  const schedules = client ? state.schedules.filter((item) => item.client_id === clientId) : [];

  state.clientDraft = {
    id: client?.id || null,
    full_name: client?.full_name || '',
    case_title: client?.case_title || '',
    phone: client?.phone || '',
    email: client?.email || '',
    messenger: client?.messenger || '',
    address: client?.address || '',
    notes: client?.notes || '',
    contract_amount: parseNumber(client?.contract_amount),
    payment_type: client?.payment_type || '100% предоплата',
    payment_deadline: client?.payment_deadline || '',
    payment_reminder_date: client?.payment_reminder_date || '',
    case_status: client?.case_status || 'active',
    originalPayments: payments.map(clonePlain),
    originalExpenses: expenses.map(clonePlain),
    originalSchedules: schedules.map(clonePlain),
    payments: payments.map(clonePlain),
    expenses: expenses.map(clonePlain),
    schedules: schedules.map(clonePlain),
  };

  state.currentClientId = clientId;
  els.clientModalTitle.textContent = client ? `Карточка: ${client.full_name}` : 'Новый клиент';
  els.archiveClientBtn.classList.toggle('hidden', !client || client.case_status === 'archived');
  els.restoreClientBtn.classList.toggle('hidden', !client || client.case_status !== 'archived');

  for (const [field, input] of Object.entries(clientFields)) {
    input.value = state.clientDraft[field] ?? '';
  }

  renderClientDraftLists();
  els.clientModal.showModal();
}

function openEventModal(eventId = null, dateString = null) {
  const item = eventId ? state.events.find((event) => event.id === eventId) : null;
  state.currentEventId = item?.id || null;
  els.eventModalTitle.textContent = item ? 'Изменение события' : 'Новое событие';
  eventFields.title.value = item?.title || '';
  eventFields.client_id.value = item?.client_id || '';
  eventFields.event_date.value = item?.event_date || dateString || toDateInputValue(new Date());
  eventFields.event_time.value = item?.event_time || '';
  eventFields.description.value = item?.description || '';
  els.eventModal.showModal();
}

function openCashModal(cashId = null, preset = {}) {
  const item = cashId ? state.cashTransactions.find((row) => row.id === cashId) : null;
  state.currentCashId = item?.id || null;
  els.cashModalTitle.textContent = item ? 'Изменение операции' : 'Новая операция';
  cashFields.entry_date.value = item?.entry_date || preset.entry_date || toDateInputValue(new Date());
  cashFields.flow_type.value = item?.flow_type || preset.flow_type || 'income';
  cashFields.account_type.value = item?.account_type || preset.account_type || 'cashless';
  cashFields.purpose.value = item?.purpose || preset.purpose || 'other';
  cashFields.category.value = item?.category || preset.category || '';
  cashFields.related_loan_id.value = item?.related_loan_id || preset.related_loan_id || '';
  cashFields.amount.value = item ? String(parseNumber(item.amount)) : preset.amount ? String(parseNumber(preset.amount)) : '';
  cashFields.description.value = item?.description || preset.description || '';
  syncCashPurposeUI();
  els.cashModal.showModal();
}

function openLoanModal(loanId = null) {
  const item = loanId ? state.loans.find((row) => row.id === loanId) : null;
  state.currentLoanId = item?.id || null;
  els.loanModalTitle.textContent = item ? 'Изменение займа' : 'Новый займ';
  loanFields.lender_name.value = item?.lender_name || '';
  loanFields.loan_title.value = item?.loan_title || '';
  loanFields.issue_date.value = item?.issue_date || toDateInputValue(new Date());
  loanFields.due_date.value = item?.due_date || '';
  loanFields.principal_amount.value = item ? String(parseNumber(item.principal_amount)) : '';
  loanFields.received_account_type.value = item?.received_account_type || 'cashless';
  loanFields.description.value = item?.description || '';
  els.loanModal.showModal();
}

function openPersonalModal(personalId = null) {
  const item = personalId ? state.personalRecords.find((row) => row.id === personalId) : null;
  state.currentPersonalId = item?.id || null;
  els.personalModalTitle.textContent = item ? 'Изменение записи' : 'Новая запись';
  personalFields.record_date.value = item?.record_date || toDateInputValue(new Date());
  personalFields.person_name.value = item?.person_name || 'Ильвар';
  personalFields.record_type.value = item?.record_type || 'spent_personal';
  personalFields.account_type.value = item?.account_type || '';
  personalFields.amount.value = item ? String(parseNumber(item.amount)) : '';
  personalFields.description.value = item?.description || '';
  syncPersonalTypeUI();
  els.personalModal.showModal();
}

function renderClientFinanceSummary() {
  const draft = state.clientDraft;
  if (!draft) return;

  const summary = getDraftSummary(draft);
  els.financeSummary.innerHTML = [
    ['Сумма договора', formatMoney(parseNumber(draft.contract_amount))],
    ['Оплачено', formatMoney(summary.paid)],
    ['Долг', formatMoney(summary.debt)],
    ['Расходы', formatMoney(summary.expenses)],
  ].map(([label, value]) => `
    <div class="capsule">
      <div class="capsule-label">${escapeHtml(label)}</div>
      <div class="capsule-value">${escapeHtml(value)}</div>
    </div>
  `).join('');
}

function renderClientDraftLists() {
  const draft = state.clientDraft;
  if (!draft) return;

  renderClientFinanceSummary();

  els.paymentsList.innerHTML = renderDraftCollection(
    draft.payments,
    'payments',
    `<div class="mini-meta">Дата</div><div class="mini-meta">Сумма</div><div class="mini-meta">Касса</div><div class="mini-meta">Комментарий</div><div></div>`,
    (row) => `
      <div class="mini-row five-cols" data-row-type="payments" data-row-id="${row.id || row._tempId}">
        <input type="date" data-row-field="payment_date" value="${escapeAttr(row.payment_date || toDateInputValue(new Date()))}" />
        <input type="number" min="0" step="0.01" data-row-field="amount" value="${escapeAttr(String(parseNumber(row.amount)))}" />
        <select data-row-field="payment_channel">
          ${['cashless', 'cash'].map((type) => `<option value="${type}" ${String(row.payment_channel || 'cashless') === type ? 'selected' : ''}>${accountTypeLabel(type)}</option>`).join('')}
        </select>
        <input type="text" data-row-field="comment" value="${escapeAttr(row.comment || '')}" placeholder="Комментарий" />
        <button class="btn btn-danger btn-sm" type="button" data-delete-row="payments:${row.id || row._tempId}">Удалить</button>
      </div>
    `,
    'Оплат пока нет.'
  );

  els.expensesList.innerHTML = renderDraftCollection(
    draft.expenses,
    'expenses',
    `<div class="mini-meta">Дата</div><div class="mini-meta">Сумма</div><div class="mini-meta">Касса</div><div class="mini-meta">Комментарий</div><div></div>`,
    (row) => `
      <div class="mini-row five-cols" data-row-type="expenses" data-row-id="${row.id || row._tempId}">
        <input type="date" data-row-field="expense_date" value="${escapeAttr(row.expense_date || toDateInputValue(new Date()))}" />
        <input type="number" min="0" step="0.01" data-row-field="amount" value="${escapeAttr(String(parseNumber(row.amount)))}" />
        <select data-row-field="payment_channel">
          ${['cashless', 'cash'].map((type) => `<option value="${type}" ${String(row.payment_channel || 'cashless') === type ? 'selected' : ''}>${accountTypeLabel(type)}</option>`).join('')}
        </select>
        <input type="text" data-row-field="comment" value="${escapeAttr(row.comment || row.category || '')}" placeholder="Например: госпошлина" />
        <button class="btn btn-danger btn-sm" type="button" data-delete-row="expenses:${row.id || row._tempId}">Удалить</button>
      </div>
    `,
    'Расходов пока нет.'
  );

  els.scheduleList.innerHTML = renderDraftCollection(
    draft.schedules,
    'schedules',
    `<div class="mini-meta">Срок</div><div class="mini-meta">Сумма</div><div class="mini-meta">Статус</div><div class="mini-meta">Примечание</div><div></div>`,
    (row) => `
      <div class="mini-row five-cols" data-row-type="schedules" data-row-id="${row.id || row._tempId}">
        <input type="date" data-row-field="due_date" value="${escapeAttr(row.due_date || toDateInputValue(new Date()))}" />
        <input type="number" min="0" step="0.01" data-row-field="planned_amount" value="${escapeAttr(String(parseNumber(row.planned_amount)))}" />
        <select data-row-field="status">
          ${['planned', 'completed', 'overdue'].map((status) => `<option value="${status}" ${row.status === status ? 'selected' : ''}>${scheduleStatusLabel(status)}</option>`).join('')}
        </select>
        <input type="text" data-row-field="note" value="${escapeAttr(row.note || '')}" placeholder="Комментарий" />
        <button class="btn btn-danger btn-sm" type="button" data-delete-row="schedules:${row.id || row._tempId}">Удалить</button>
      </div>
    `,
    'График оплаты не заполнен.'
  );
}

function renderDraftCollection(rows, type, headerHtml, rowRenderer, emptyText) {
  if (!rows.length) return emptyCard(emptyText);
  return `
    <div class="mini-list" data-collection="${type}">
      <div class="mini-row ${(type === 'schedules' || type === 'payments' || type === 'expenses') ? 'five-cols' : ''}">${headerHtml}</div>
      ${rows.map(rowRenderer).join('')}
    </div>
  `;
}

function addDraftRow(type) {
  if (!state.clientDraft) return;
  const tempId = `temp-${crypto.randomUUID()}`;

  if (type === 'payments') {
    state.clientDraft.payments.push({
      _tempId: tempId,
      payment_date: toDateInputValue(new Date()),
      amount: 0,
      payment_channel: 'cashless',
      comment: '',
    });
  }
  if (type === 'expenses') {
    state.clientDraft.expenses.push({
      _tempId: tempId,
      expense_date: toDateInputValue(new Date()),
      amount: 0,
      payment_channel: 'cashless',
      comment: '',
      category: '',
    });
  }
  if (type === 'schedules') {
    state.clientDraft.schedules.push({
      _tempId: tempId,
      due_date: toDateInputValue(new Date()),
      planned_amount: 0,
      status: 'planned',
      note: '',
    });
  }

  renderClientDraftLists();
}

function handleBodyInput(event) {
  const target = event.target;

  if (state.clientDraft) {
    for (const [field, input] of Object.entries(clientFields)) {
      if (target === input) {
        state.clientDraft[field] = input.type === 'number' ? parseNumber(input.value) : input.value;
        renderClientFinanceSummary();
        return;
      }
    }

    const rowElement = target.closest('[data-row-type]');
    if (rowElement) {
      const rowType = rowElement.dataset.rowType;
      const rowId = rowElement.dataset.rowId;
      const field = target.dataset.rowField;
      if (!field) return;

      const collection = state.clientDraft[rowType];
      const row = collection.find((item) => String(item.id || item._tempId) === rowId);
      if (!row) return;

      row[field] = target.type === 'number' ? parseNumber(target.value) : target.value;
      if (rowType === 'expenses' && field === 'comment') {
        row.category = row.comment;
      }
      renderClientFinanceSummary();
    }
  }
}

async function saveClient() {
  if (!supabase) {
    showToast('Сначала подключите Supabase в файле config.js.', 'error');
    return;
  }
  const draft = state.clientDraft;
  if (!draft) return;
  if (!draft.full_name?.trim()) {
    showToast('Заполните ФИО клиента.', 'error');
    return;
  }

  try {
    const payload = {
      workspace_key: state.workspaceKey,
      full_name: draft.full_name.trim(),
      case_title: draft.case_title || null,
      phone: draft.phone || null,
      email: draft.email || null,
      messenger: draft.messenger || null,
      address: draft.address || null,
      notes: draft.notes || null,
      contract_amount: parseNumber(draft.contract_amount),
      payment_type: draft.payment_type || null,
      payment_deadline: draft.payment_deadline || null,
      payment_reminder_date: draft.payment_reminder_date || null,
      case_status: draft.case_status || 'active',
    };

    let savedClient;

    if (draft.id) {
      const { data, error } = await supabase
        .from('clients')
        .update(payload)
        .eq('id', draft.id)
        .eq('workspace_key', state.workspaceKey)
        .select()
        .single();
      if (error) throw error;
      savedClient = data;
    } else {
      const { data, error } = await supabase.from('clients').insert(payload).select().single();
      if (error) throw error;
      savedClient = data;
      state.currentClientId = data.id;
      draft.id = data.id;
    }

    const clientId = savedClient.id;

    await Promise.all([
      syncChildCollection('payments', clientId, draft.originalPayments, draft.payments, (row) => ({
        payment_date: row.payment_date || null,
        amount: parseNumber(row.amount),
        payment_channel: row.payment_channel || 'cashless',
        comment: row.comment || null,
      })),
      syncChildCollection('expenses', clientId, draft.originalExpenses, draft.expenses, (row) => ({
        expense_date: row.expense_date || null,
        amount: parseNumber(row.amount),
        payment_channel: row.payment_channel || 'cashless',
        comment: row.comment || null,
        category: row.comment || null,
      })),
      syncChildCollection('payment_schedules', clientId, draft.originalSchedules, draft.schedules, (row) => ({
        due_date: row.due_date || null,
        planned_amount: parseNumber(row.planned_amount),
        status: row.status || 'planned',
        note: row.note || null,
      })),
    ]);

    const bundle = await fetchClientBundle(clientId);
    patchClientBundle(bundle.client, bundle.payments, bundle.expenses, bundle.schedules);
    closeModal('client-modal');
    state.clientDraft = null;
    renderAll();
    showToast('Карточка клиента сохранена.', 'success');
    loadAllData({ silent: true });
  } catch (error) {
    console.error(error);
    showToast(`Ошибка сохранения клиента: ${error.message || error}`, 'error', 6000);
  }
}

async function fetchClientBundle(clientId) {
  const [clientRes, paymentsRes, expensesRes, schedulesRes] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).eq('workspace_key', state.workspaceKey).single(),
    supabase.from('payments').select('*').eq('client_id', clientId).eq('workspace_key', state.workspaceKey).order('payment_date', { ascending: false }),
    supabase.from('expenses').select('*').eq('client_id', clientId).eq('workspace_key', state.workspaceKey).order('expense_date', { ascending: false }),
    supabase.from('payment_schedules').select('*').eq('client_id', clientId).eq('workspace_key', state.workspaceKey).order('due_date', { ascending: true }),
  ]);

  const responses = [clientRes, paymentsRes, expensesRes, schedulesRes];
  const firstError = responses.find((item) => item.error)?.error;
  if (firstError) throw firstError;

  return {
    client: clientRes.data,
    payments: paymentsRes.data || [],
    expenses: expensesRes.data || [],
    schedules: schedulesRes.data || [],
  };
}

function patchClientBundle(client, payments, expenses, schedules) {
  upsertStateItem('clients', client);
  replaceRowsByClient('payments', client.id, payments);
  replaceRowsByClient('expenses', client.id, expenses);
  replaceRowsByClient('schedules', client.id, schedules);
}

function replaceRowsByClient(key, clientId, rows) {
  state[key] = state[key].filter((item) => item.client_id !== clientId).concat(rows);
}

function upsertStateItem(key, item) {
  state[key] = state[key].some((row) => row.id === item.id)
    ? state[key].map((row) => row.id === item.id ? item : row)
    : [item, ...state[key]];
}

async function syncChildCollection(tableName, clientId, originalRows, currentRows, mapper) {
  const originalIds = new Set(originalRows.filter((row) => row.id).map((row) => row.id));
  const currentIds = new Set(currentRows.filter((row) => row.id).map((row) => row.id));
  const toDelete = [...originalIds].filter((id) => !currentIds.has(id));
  const toInsert = currentRows.filter((row) => !row.id).map((row) => ({ client_id: clientId, workspace_key: state.workspaceKey, ...mapper(row) }));
  const toUpdate = currentRows.filter((row) => row.id);

  const tasks = [];

  if (toDelete.length) {
    tasks.push(
      supabase.from(tableName).delete().in('id', toDelete).eq('workspace_key', state.workspaceKey)
        .then(({ error }) => {
          if (error) throw error;
        })
    );
  }

  if (toInsert.length) {
    tasks.push(
      supabase.from(tableName).insert(toInsert)
        .then(({ error }) => {
          if (error) throw error;
        })
    );
  }

  toUpdate.forEach((row) => {
    const payload = { client_id: clientId, workspace_key: state.workspaceKey, ...mapper(row) };
    tasks.push(
      supabase.from(tableName).update(payload).eq('id', row.id).eq('workspace_key', state.workspaceKey)
        .then(({ error }) => {
          if (error) throw error;
        })
    );
  });

  await Promise.all(tasks);
}

async function archiveClientById(clientId, options = {}) {
  if (!supabase || !clientId) return;
  const confirmed = window.confirm('Переместить дело в архив?');
  if (!confirmed) return;

  try {
    const patch = { case_status: 'archived', case_completed_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from('clients')
      .update(patch)
      .eq('id', clientId)
      .eq('workspace_key', state.workspaceKey)
      .select()
      .single();
    if (error) throw error;

    upsertStateItem('clients', data);
    renderAll();
    showToast('Дело перенесено в архив.', 'success');
    if (options.closeModal) closeModal('client-modal');
    switchSection('archive');
    loadAllData({ silent: true });
  } catch (error) {
    showToast(`Не удалось архивировать дело: ${error.message || error}`, 'error');
  }
}

async function archiveCurrentClient() {
  await archiveClientById(state.currentClientId, { closeModal: true });
}

async function restoreCurrentClient() {
  if (!supabase || !state.currentClientId) return;
  try {
    const { data, error } = await supabase
      .from('clients')
      .update({ case_status: 'active', case_completed_at: null })
      .eq('id', state.currentClientId)
      .eq('workspace_key', state.workspaceKey)
      .select()
      .single();
    if (error) throw error;
    upsertStateItem('clients', data);
    showToast('Дело возвращено из архива.', 'success');
    closeModal('client-modal');
    renderAll();
    switchSection('clients');
    loadAllData({ silent: true });
  } catch (error) {
    showToast(`Не удалось вернуть дело: ${error.message || error}`, 'error');
  }
}

async function saveEvent() {
  if (!supabase) {
    showToast('Сначала подключите Supabase в файле config.js.', 'error');
    return;
  }
  if (!eventFields.title.value.trim()) {
    showToast('Введите название события.', 'error');
    return;
  }

  try {
    const payload = {
      workspace_key: state.workspaceKey,
      title: eventFields.title.value.trim(),
      client_id: eventFields.client_id.value || null,
      event_date: eventFields.event_date.value || null,
      event_time: eventFields.event_time.value || null,
      description: eventFields.description.value || null,
    };

    let saved;
    if (state.currentEventId) {
      const { data, error } = await supabase
        .from('events')
        .update(payload)
        .eq('id', state.currentEventId)
        .eq('workspace_key', state.workspaceKey)
        .select()
        .single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase.from('events').insert(payload).select().single();
      if (error) throw error;
      saved = data;
    }

    upsertStateItem('events', saved);
    state.events.sort((a, b) => `${a.event_date || ''} ${a.event_time || ''}`.localeCompare(`${b.event_date || ''} ${b.event_time || ''}`));
    closeModal('event-modal');
    renderAll();
    showToast('Событие сохранено.', 'success');
    loadAllData({ silent: true });
  } catch (error) {
    showToast(`Ошибка сохранения события: ${error.message || error}`, 'error');
  }
}

async function deleteEvent(eventId) {
  if (!supabase) return;
  const confirmed = window.confirm('Удалить событие?');
  if (!confirmed) return;

  try {
    const { error } = await supabase.from('events').delete().eq('id', eventId).eq('workspace_key', state.workspaceKey);
    if (error) throw error;
    state.events = state.events.filter((item) => item.id !== eventId);
    renderAll();
    showToast('Событие удалено.', 'success');
    loadAllData({ silent: true });
  } catch (error) {
    showToast(`Не удалось удалить событие: ${error.message || error}`, 'error');
  }
}

async function saveCashTransaction() {
  if (!supabase) {
    showToast('Сначала подключите Supabase в файле config.js.', 'error');
    return;
  }

  if (!cashFields.entry_date.value) {
    showToast('Укажите дату операции.', 'error');
    return;
  }

  if (parseNumber(cashFields.amount.value) <= 0) {
    showToast('Укажите сумму больше нуля.', 'error');
    return;
  }

  if (cashFields.purpose.value === 'loan_repayment' && !cashFields.related_loan_id.value) {
    showToast('Для погашения займа выберите нужный займ.', 'error');
    return;
  }

  try {
    const payload = {
      workspace_key: state.workspaceKey,
      entry_date: cashFields.entry_date.value,
      flow_type: cashFields.flow_type.value,
      account_type: cashFields.account_type.value || 'cashless',
      purpose: cashFields.purpose.value || 'other',
      related_loan_id: cashFields.purpose.value === 'loan_repayment' ? (cashFields.related_loan_id.value || null) : null,
      category: cashFields.category.value.trim() || null,
      amount: parseNumber(cashFields.amount.value),
      description: cashFields.description.value.trim() || null,
    };

    if (payload.purpose === 'loan_repayment') {
      payload.flow_type = 'expense';
      payload.category = payload.category || 'Погашение займа';
    }

    let saved;
    if (state.currentCashId) {
      const { data, error } = await supabase
        .from('cash_transactions')
        .update(payload)
        .eq('id', state.currentCashId)
        .eq('workspace_key', state.workspaceKey)
        .select()
        .single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase.from('cash_transactions').insert(payload).select().single();
      if (error) throw error;
      saved = data;
    }

    upsertStateItem('cashTransactions', saved);
    state.cashTransactions.sort((a, b) => `${b.entry_date || ''} ${b.created_at || ''}`.localeCompare(`${a.entry_date || ''} ${a.created_at || ''}`));
    closeModal('cash-modal');
    renderAll();
    showToast('Операция сохранена.', 'success');
    loadAllData({ silent: true });
  } catch (error) {
    showToast(`Не удалось сохранить операцию: ${error.message || error}`, 'error');
  }
}

async function deleteCashTransaction(cashId) {
  if (!supabase || !cashId) return;
  const confirmed = window.confirm('Удалить эту операцию?');
  if (!confirmed) return;

  try {
    const { error } = await supabase.from('cash_transactions').delete().eq('id', cashId).eq('workspace_key', state.workspaceKey);
    if (error) throw error;
    state.cashTransactions = state.cashTransactions.filter((row) => row.id !== cashId);
    renderAll();
    showToast('Операция удалена.', 'success');
    loadAllData({ silent: true });
  } catch (error) {
    showToast(`Не удалось удалить операцию: ${error.message || error}`, 'error');
  }
}

async function saveLoan() {
  if (!supabase) {
    showToast('Сначала подключите Supabase в файле config.js.', 'error');
    return;
  }
  if (!loanFields.lender_name.value.trim()) {
    showToast('Укажите, у кого взят займ.', 'error');
    return;
  }
  if (parseNumber(loanFields.principal_amount.value) <= 0) {
    showToast('Укажите сумму займа больше нуля.', 'error');
    return;
  }

  try {
    const payload = {
      workspace_key: state.workspaceKey,
      lender_name: loanFields.lender_name.value.trim(),
      loan_title: loanFields.loan_title.value.trim() || null,
      issue_date: loanFields.issue_date.value || null,
      due_date: loanFields.due_date.value || null,
      principal_amount: parseNumber(loanFields.principal_amount.value),
      received_account_type: loanFields.received_account_type.value || 'cashless',
      description: loanFields.description.value.trim() || null,
    };

    let saved;
    if (state.currentLoanId) {
      const { data, error } = await supabase.from('loans').update(payload).eq('id', state.currentLoanId).eq('workspace_key', state.workspaceKey).select().single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase.from('loans').insert(payload).select().single();
      if (error) throw error;
      saved = data;
    }

    upsertStateItem('loans', saved);
    closeModal('loan-modal');
    renderAll();
    showToast('Займ сохранён.', 'success');
    loadAllData({ silent: true });
  } catch (error) {
    showToast(`Не удалось сохранить займ: ${error.message || error}`, 'error');
  }
}

async function deleteLoan(loanId) {
  if (!supabase || !loanId) return;
  const linkedRepayments = state.cashTransactions.filter((row) => row.related_loan_id === loanId && row.purpose === 'loan_repayment').length;
  if (linkedRepayments > 0) {
    showToast('Сначала удалите или измените операции погашения по этому займу.', 'error', 5000);
    return;
  }
  const confirmed = window.confirm('Удалить займ?');
  if (!confirmed) return;
  try {
    const { error } = await supabase.from('loans').delete().eq('id', loanId).eq('workspace_key', state.workspaceKey);
    if (error) throw error;
    state.loans = state.loans.filter((row) => row.id !== loanId);
    renderAll();
    showToast('Займ удалён.', 'success');
    loadAllData({ silent: true });
  } catch (error) {
    showToast(`Не удалось удалить займ: ${error.message || error}`, 'error');
  }
}

async function savePersonalRecord() {
  if (!supabase) {
    showToast('Сначала подключите Supabase в файле config.js.', 'error');
    return;
  }
  if (parseNumber(personalFields.amount.value) <= 0) {
    showToast('Укажите сумму больше нуля.', 'error');
    return;
  }

  const recordType = personalFields.record_type.value;
  const accountType = personalFields.account_type.value || null;
  if (['reimbursed_from_company', 'took_from_company', 'returned_to_company'].includes(recordType) && !accountType) {
    showToast('Для этой записи выберите кассу: наличный или безналичный расчёт.', 'error');
    return;
  }

  try {
    const payload = {
      workspace_key: state.workspaceKey,
      record_date: personalFields.record_date.value || null,
      person_name: personalFields.person_name.value,
      record_type: recordType,
      account_type: accountType,
      amount: parseNumber(personalFields.amount.value),
      description: personalFields.description.value.trim() || null,
    };

    let saved;
    if (state.currentPersonalId) {
      const { data, error } = await supabase.from('personal_records').update(payload).eq('id', state.currentPersonalId).eq('workspace_key', state.workspaceKey).select().single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase.from('personal_records').insert(payload).select().single();
      if (error) throw error;
      saved = data;
    }

    upsertStateItem('personalRecords', saved);
    closeModal('personal-modal');
    renderAll();
    showToast('Личная запись сохранена.', 'success');
    loadAllData({ silent: true });
  } catch (error) {
    showToast(`Не удалось сохранить запись: ${error.message || error}`, 'error');
  }
}

async function deletePersonalRecord(recordId) {
  if (!supabase || !recordId) return;
  const confirmed = window.confirm('Удалить эту запись?');
  if (!confirmed) return;
  try {
    const { error } = await supabase.from('personal_records').delete().eq('id', recordId).eq('workspace_key', state.workspaceKey);
    if (error) throw error;
    state.personalRecords = state.personalRecords.filter((row) => row.id !== recordId);
    renderAll();
    showToast('Запись удалена.', 'success');
    loadAllData({ silent: true });
  } catch (error) {
    showToast(`Не удалось удалить запись: ${error.message || error}`, 'error');
  }
}

function syncCashPurposeUI() {
  const isLoan = cashFields.purpose?.value === 'loan_repayment';
  if (cashFields.related_loan_id) cashFields.related_loan_id.disabled = !isLoan;
  if (cashFields.flow_type) cashFields.flow_type.disabled = isLoan;
  if (isLoan) cashFields.flow_type.value = 'expense';
}

function syncPersonalTypeUI() {
  const type = personalFields.record_type?.value;
  const needsCash = ['reimbursed_from_company', 'took_from_company', 'returned_to_company'].includes(type);
  if (personalFields.account_type) {
    personalFields.account_type.disabled = !needsCash;
    if (!needsCash) personalFields.account_type.value = '';
  }
}

function handleBodyClick(event) {
  const target = event.target;
  const section = target.closest('[data-section]');
  if (section) return;

  const openClientId = target.closest('[data-open-client]')?.dataset.openClient;
  if (openClientId) {
    openClientModal(openClientId);
    return;
  }

  const restoreId = target.closest('[data-restore-id]')?.dataset.restoreId;
  if (restoreId) {
    openClientModal(restoreId);
    return;
  }

  const archiveId = target.closest('[data-archive-id]')?.dataset.archiveId;
  if (archiveId) {
    archiveClientById(archiveId);
    return;
  }

  const editEventId = target.closest('[data-edit-event]')?.dataset.editEvent;
  if (editEventId) {
    openEventModal(editEventId);
    return;
  }

  const deleteEventId = target.closest('[data-delete-event]')?.dataset.deleteEvent;
  if (deleteEventId) {
    deleteEvent(deleteEventId);
    return;
  }

  const addEventDate = target.closest('[data-add-event-date]')?.dataset.addEventDate;
  if (addEventDate) {
    openEventModal(null, addEventDate);
    return;
  }

  const editCashId = target.closest('[data-edit-cash]')?.dataset.editCash;
  if (editCashId) {
    openCashModal(editCashId);
    return;
  }

  const deleteCashId = target.closest('[data-delete-cash]')?.dataset.deleteCash;
  if (deleteCashId) {
    deleteCashTransaction(deleteCashId);
    return;
  }

  const editLoanId = target.closest('[data-edit-loan]')?.dataset.editLoan;
  if (editLoanId) {
    openLoanModal(editLoanId);
    return;
  }

  const deleteLoanId = target.closest('[data-delete-loan]')?.dataset.deleteLoan;
  if (deleteLoanId) {
    deleteLoan(deleteLoanId);
    return;
  }

  const repayLoanId = target.closest('[data-repay-loan]')?.dataset.repayLoan;
  if (repayLoanId) {
    const loan = state.loans.find((item) => item.id === repayLoanId);
    openCashModal(null, {
      flow_type: 'expense',
      purpose: 'loan_repayment',
      related_loan_id: repayLoanId,
      account_type: loan?.received_account_type || 'cashless',
      category: 'Погашение займа',
      description: loan ? `Погашение займа: ${loan.lender_name}` : 'Погашение займа',
    });
    return;
  }

  const editPersonalId = target.closest('[data-edit-personal]')?.dataset.editPersonal;
  if (editPersonalId) {
    openPersonalModal(editPersonalId);
    return;
  }

  const deletePersonalId = target.closest('[data-delete-personal]')?.dataset.deletePersonal;
  if (deletePersonalId) {
    deletePersonalRecord(deletePersonalId);
    return;
  }

  const calendarDate = target.closest('[data-calendar-date]')?.dataset.calendarDate;
  if (calendarDate) {
    renderCalendarDayEvents(calendarDate);
    renderCalendar();
    if (state.activeSection !== 'dashboard') switchSection('dashboard');
    requestAnimationFrame(() => {
      els.calendarDayEvents?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return;
  }

  const deleteRowRef = target.closest('[data-delete-row]')?.dataset.deleteRow;
  if (deleteRowRef && state.clientDraft) {
    const [type, rowId] = deleteRowRef.split(':');
    state.clientDraft[type] = state.clientDraft[type].filter((item) => String(item.id || item._tempId) !== rowId);
    renderClientDraftLists();
  }
}

function getClientSummary(clientId) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) return { paid: 0, expenses: 0, debt: 0 };
  return getDraftSummary({
    contract_amount: client.contract_amount,
    payments: state.payments.filter((item) => item.client_id === clientId),
    expenses: state.expenses.filter((item) => item.client_id === clientId),
  });
}

function getDraftSummary(draft) {
  const contract = parseNumber(draft.contract_amount);
  const paid = (draft.payments || []).reduce((sum, item) => sum + parseNumber(item.amount), 0);
  const expenses = (draft.expenses || []).reduce((sum, item) => sum + parseNumber(item.amount), 0);
  const debt = Math.max(contract - paid, 0);
  return { contract, paid, expenses, debt };
}

function getCashMetrics() {
  const paymentRows = state.payments.map((row) => ({
    amount: parseNumber(row.amount),
    flowType: 'income',
    accountType: row.payment_channel || 'cashless',
    category: 'Договор',
    source: 'payment',
  }));

  const expenseRows = state.expenses.map((row) => ({
    amount: parseNumber(row.amount),
    flowType: 'expense',
    accountType: row.payment_channel || 'cashless',
    category: row.category || 'Расход конторы',
    source: 'expense',
  }));

  const cashRows = state.cashTransactions.map((row) => ({
    amount: parseNumber(row.amount),
    flowType: row.flow_type,
    accountType: row.account_type || 'cashless',
    category: row.category || 'Операция',
    source: 'cash',
  }));

  const loanRows = state.loans.map((row) => ({
    amount: parseNumber(row.principal_amount),
    flowType: 'income',
    accountType: row.received_account_type || 'cashless',
    category: 'Займ',
    source: 'loan',
  }));

  const personalCashRows = state.personalRecords
    .map(buildPersonalCashMovement)
    .filter(Boolean)
    .map((row) => ({ ...row, source: 'personal' }));

  const allRows = paymentRows.concat(expenseRows, cashRows, loanRows, personalCashRows);

  const totals = allRows.reduce((acc, row) => {
    const amount = parseNumber(row.amount);
    const account = row.accountType === 'cash' ? 'cash' : 'cashless';
    const signed = row.flowType === 'income' ? amount : -amount;
    acc.balance += signed;
    acc[`${account}Balance`] += signed;
    if (row.source === 'payment') acc.contractIncome += amount;
    if (row.source === 'expense') acc.officeExpenses += amount;
    if (row.source === 'cash') {
      if (row.flowType === 'income') acc.otherIncome += amount;
      else acc.otherExpense += amount;
    }
    if (row.source === 'loan') acc.loanIncome += amount;
    return acc;
  }, {
    balance: 0,
    cashBalance: 0,
    cashlessBalance: 0,
    contractIncome: 0,
    officeExpenses: 0,
    otherIncome: 0,
    otherExpense: 0,
    loanIncome: 0,
  });

  const loans = getLoanMetrics();
  const otherNet = totals.otherIncome - totals.otherExpense;
  return { ...totals, otherNet, loanOutstanding: loans.outstandingTotal };
}

function getCashLedgerRows() {
  const paymentRows = state.payments.map((row) => ({
    id: row.id,
    date: row.payment_date,
    flowType: 'income',
    signedAmount: parseNumber(row.amount),
    sourceType: 'payment',
    sourceLabel: 'Оплата по договору',
    title: 'Поступление по договору',
    category: 'Договор',
    accountType: row.payment_channel || 'cashless',
    clientId: row.client_id,
    clientName: getClientName(row.client_id),
    description: row.comment || 'Оплата клиента',
    createdAt: row.created_at,
  }));

  const expenseRows = state.expenses.map((row) => ({
    id: row.id,
    date: row.expense_date,
    flowType: 'expense',
    signedAmount: -parseNumber(row.amount),
    sourceType: 'expense',
    sourceLabel: 'Расход конторы',
    title: 'Расход по делу',
    category: row.category || 'Расход конторы',
    accountType: row.payment_channel || 'cashless',
    clientId: row.client_id,
    clientName: getClientName(row.client_id),
    description: row.comment || 'Дополнительный расход',
    createdAt: row.created_at,
  }));

  const cashRows = state.cashTransactions.map((row) => ({
    id: row.id,
    date: row.entry_date,
    flowType: row.flow_type,
    signedAmount: row.flow_type === 'income' ? parseNumber(row.amount) : -parseNumber(row.amount),
    sourceType: 'cash',
    sourceLabel: row.purpose === 'loan_repayment' ? 'Погашение займа' : 'Иная операция',
    title: row.purpose === 'loan_repayment' ? `Погашение займа${row.related_loan_id ? `: ${getLoanName(row.related_loan_id)}` : ''}` : (row.flow_type === 'income' ? 'Иной доход' : 'Иной расход'),
    category: row.category || 'Иное',
    accountType: row.account_type || 'cashless',
    clientId: null,
    clientName: '',
    description: row.description || row.category || 'Операция по кассе',
    createdAt: row.created_at,
  }));

  const loanRows = state.loans.map((row) => ({
    id: row.id,
    date: row.issue_date,
    flowType: 'income',
    signedAmount: parseNumber(row.principal_amount),
    sourceType: 'loan',
    sourceLabel: 'Получен займ',
    title: `Займ от ${row.lender_name}`,
    category: row.loan_title || 'Займ',
    accountType: row.received_account_type || 'cashless',
    clientId: null,
    clientName: '',
    description: row.description || row.loan_title || 'Получен займ',
    createdAt: row.created_at,
  }));

  const personalRows = state.personalRecords
    .map((row) => {
      const movement = buildPersonalCashMovement(row);
      if (!movement) return null;
      return {
        id: row.id,
        date: row.record_date,
        flowType: movement.flowType,
        signedAmount: movement.flowType === 'income' ? movement.amount : -movement.amount,
        sourceType: 'personal',
        sourceLabel: 'Личные расчёты',
        title: `${row.person_name}: ${personalRecordTypeLabel(row.record_type)}`,
        category: 'Личные расчёты',
        accountType: movement.accountType,
        clientId: null,
        clientName: '',
        description: row.description || personalRecordTypeLabel(row.record_type),
        createdAt: row.created_at,
      };
    })
    .filter(Boolean);

  return paymentRows.concat(expenseRows, cashRows, loanRows, personalRows)
    .sort((a, b) => `${b.date || ''} ${b.createdAt || ''}`.localeCompare(`${a.date || ''} ${a.createdAt || ''}`));
}

function getLoanMetrics() {
  const items = state.loans.map((loan) => {
    const repaid = state.cashTransactions
      .filter((row) => row.related_loan_id === loan.id && row.purpose === 'loan_repayment')
      .reduce((sum, row) => sum + parseNumber(row.amount), 0);
    const outstanding = Math.max(parseNumber(loan.principal_amount) - repaid, 0);
    return { ...loan, repaid, outstanding };
  });
  return {
    items: items.sort((a, b) => `${a.due_date || ''} ${a.issue_date || ''}`.localeCompare(`${b.due_date || ''} ${b.issue_date || ''}`)),
    principalTotal: items.reduce((sum, row) => sum + parseNumber(row.principal_amount), 0),
    outstandingTotal: items.reduce((sum, row) => sum + row.outstanding, 0),
    activeCount: items.filter((row) => row.outstanding > 0).length,
  };
}

function getPersonalMetrics() {
  const balances = { 'Ильвар': 0, 'Рустам': 0 };
  state.personalRecords.forEach((row) => {
    const { balanceDelta } = getPersonalRecordEffect(row);
    balances[row.person_name] = (balances[row.person_name] || 0) + balanceDelta;
  });
  return {
    balances,
    netCompanyLiability: Object.values(balances).reduce((sum, value) => sum + value, 0),
  };
}

function getPersonalRecordEffect(row) {
  const amount = parseNumber(row.amount);
  switch (row.record_type) {
    case 'spent_personal':
      return { balanceDelta: amount, cashMovement: null };
    case 'reimbursed_from_company':
      return { balanceDelta: -amount, cashMovement: { flowType: 'expense', amount, accountType: row.account_type || 'cashless' } };
    case 'took_from_company':
      return { balanceDelta: -amount, cashMovement: { flowType: 'expense', amount, accountType: row.account_type || 'cashless' } };
    case 'returned_to_company':
      return { balanceDelta: amount, cashMovement: { flowType: 'income', amount, accountType: row.account_type || 'cashless' } };
    default:
      return { balanceDelta: 0, cashMovement: null };
  }
}

function buildPersonalCashMovement(row) {
  return getPersonalRecordEffect(row).cashMovement;
}

function getClientName(clientId) {
  return state.clients.find((client) => client.id === clientId)?.full_name || '';
}

function getUpcomingEvents(daysAhead) {
  const today = stripTime(new Date());
  const endDate = addDays(today, daysAhead);

  return state.events.filter((event) => {
    const eventDate = parseDateSafe(event.event_date);
    return eventDate && eventDate >= today && eventDate <= endDate;
  });
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal?.open) modal.close();
}

function showToast(message, type = 'info', timeout = 3200) {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  window.setTimeout(() => toast.remove(), timeout);
}

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(parseNumber(value));
}

function formatSignedMoney(value) {
  const num = parseNumber(value);
  const prefix = num > 0 ? '+ ' : num < 0 ? '− ' : '';
  return `${prefix}${formatMoney(Math.abs(num))}`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = parseDateSafe(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatEventDateTime(event) {
  return `${formatDate(event.event_date)}${event.event_time ? `, ${event.event_time}` : ''}`;
}

function accountTypeLabel(value) {
  return {
    cash: 'Наличный расчёт',
    cashless: 'Безналичный расчёт',
    '': 'Без движения',
    null: 'Без движения',
    undefined: 'Без движения',
  }[value] || 'Без движения';
}

function personalRecordTypeLabel(value) {
  return {
    spent_personal: 'Личные деньги потрачены на компанию',
    reimbursed_from_company: 'Компания погасила личный расход',
    took_from_company: 'Взял деньги компании на личные нужды',
    returned_to_company: 'Вернул деньги компании',
  }[value] || value;
}

function getLoanName(loanId) {
  const loan = state.loans.find((item) => item.id === loanId);
  return loan ? `${loan.lender_name}` : 'Займ';
}

function parseNumber(value) {
  const number = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function parseDateSafe(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : stripTime(date);
}

function stripTime(date) {
  const cloned = new Date(date);
  cloned.setHours(0, 0, 0, 0);
  return cloned;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date, days) {
  const cloned = new Date(date);
  cloned.setDate(cloned.getDate() + days);
  return cloned;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function startOfWeek(date) {
  const cloned = stripTime(date);
  const day = cloned.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(cloned, diff);
}

function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

function toDateInputValue(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function emptyCard(text) {
  return `<div class="empty-card">${escapeHtml(text)}</div>`;
}

function renderDebtPill(debt) {
  const value = formatMoney(debt);
  const cls = debt > 0 ? 'danger' : 'ok';
  return `<span class="pill ${cls}">${escapeHtml(value)}</span>`;
}

function scheduleStatusLabel(value) {
  return {
    planned: 'Запланировано',
    completed: 'Исполнено',
    overdue: 'Просрочено',
  }[value] || value;
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function shorten(value, maxLength) {
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function capitalize(value) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

async function buildWorkspaceKey(password) {
  const normalized = String(password || '').trim();
  if (!normalized) return '';

  if (window.crypto?.subtle?.digest) {
    const encoded = new TextEncoder().encode(`law-crm::${normalized}`);
    const buffer = await window.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buffer))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }

  return `fallback-${btoa(unescape(encodeURIComponent(normalized)))}`;
}
