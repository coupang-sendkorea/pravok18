const CONFIG = window.APP_CONFIG || {};
const hasSupabaseConfig = Boolean(
  CONFIG.SUPABASE_URL &&
  CONFIG.SUPABASE_KEY &&
  !CONFIG.SUPABASE_URL.includes('PASTE_') &&
  !CONFIG.SUPABASE_KEY.includes('PASTE_')
);

function createRestSupabaseClient(url, apiKey) {
  function normalizeValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.action = 'select';
      this.columns = '*';
      this.filters = [];
      this.orders = [];
      this.payload = null;
      this.expectSingle = false;
      this.returnRepresentation = false;
      this.selectOptions = {};
    }

    select(columns = '*', options = {}) {
      this.columns = columns;
      this.selectOptions = options || {};
      this.returnRepresentation = true;
      if (this.action === 'select') this.action = 'select';
      return this;
    }

    insert(payload) {
      this.action = 'insert';
      this.payload = payload;
      return this;
    }

    update(payload) {
      this.action = 'update';
      this.payload = payload;
      return this;
    }

    delete() {
      this.action = 'delete';
      return this;
    }

    eq(column, value) {
      this.filters.push({ column, op: 'eq', value });
      return this;
    }

    in(column, values) {
      this.filters.push({ column, op: 'in', value: values });
      return this;
    }

    is(column, value) {
      this.filters.push({ column, op: 'is', value });
      return this;
    }

    order(column, options = {}) {
      this.orders.push({ column, ascending: options.ascending !== false });
      return this;
    }

    single() {
      this.expectSingle = true;
      return this;
    }

    then(resolve, reject) {
      return this.execute().then(resolve, reject);
    }

    async execute() {
      const headers = {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
      };
      const params = new URLSearchParams();
      let method = 'GET';
      let body;

      if (this.action === 'select') {
        params.set('select', this.columns || '*');
      } else if (this.returnRepresentation) {
        params.set('select', this.columns || '*');
        headers['Prefer'] = 'return=representation';
      } else {
        headers['Prefer'] = 'return=minimal';
      }

      for (const filter of this.filters) {
        if (filter.op === 'eq') {
          params.append(filter.column, `eq.${normalizeValue(filter.value)}`);
        }
        if (filter.op === 'in') {
          const list = Array.isArray(filter.value)
            ? filter.value.map((item) => JSON.stringify(String(item))).join(',')
            : '';
          params.append(filter.column, `in.(${list})`);
        }
        if (filter.op === 'is') {
          const normalized = filter.value === null ? 'null' : normalizeValue(filter.value);
          params.append(filter.column, `is.${normalized}`);
        }
      }

      if (this.orders.length) {
        params.set('order', this.orders.map((item) => `${item.column}.${item.ascending ? 'asc' : 'desc'}`).join(','));
      }

      if (this.expectSingle) {
        headers['Accept'] = 'application/vnd.pgrst.object+json';
      }

      if (this.action === 'select' && this.selectOptions?.count) {
        headers['Prefer'] = `count=${this.selectOptions.count}`;
      }

      if (this.action === 'select' && this.selectOptions?.head) {
        method = 'HEAD';
      }

      if (this.action === 'insert') {
        method = 'POST';
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(this.payload);
      }
      if (this.action === 'update') {
        method = 'PATCH';
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(this.payload);
      }
      if (this.action === 'delete') {
        method = 'DELETE';
      }

      const query = params.toString();
      const endpoint = `${url.replace(/\/$/, '')}/rest/v1/${this.table}${query ? `?${query}` : ''}`;

      try {
        const response = await fetch(endpoint, { method, headers, body });
        const raw = method === 'HEAD' ? '' : await response.text();
        let parsed = null;
        if (raw) {
          try {
            parsed = JSON.parse(raw);
          } catch (error) {
            parsed = raw;
          }
        }

        if (!response.ok) {
          const message = parsed?.message || parsed?.error_description || parsed?.hint || response.statusText || 'Ошибка Supabase';
          return { data: null, error: { message, details: parsed } };
        }

        const countHeader = response.headers.get('content-range');
        const count = countHeader && countHeader.includes('/') ? Number(countHeader.split('/').pop()) : null;

        return { data: parsed, error: null, count };
      } catch (error) {
        return { data: null, error: { message: error.message || 'Сетевая ошибка', details: error } };
      }
    }
  }

  return {
    from(table) {
      return new QueryBuilder(table);
    },
  };
}

const supabase = hasSupabaseConfig
  ? createRestSupabaseClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY)
  : null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));


window.addEventListener('error', (event) => {
  console.error('[Право CRM] Ошибка приложения:', event.error || event.message || event);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Право CRM] Необработанная ошибка Promise:', event.reason || event);
});

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
  generateContractBtn: $('#generate-contract-btn'),
  generateActBtn: $('#generate-act-btn'),
  generateReceiptBtn: $('#generate-receipt-btn'),
  generatePoaBtn: $('#generate-poa-btn'),
  archiveClientBtn: $('#archive-client-btn'),
  restoreClientBtn: $('#restore-client-btn'),
  saveEventBtn: $('#save-event-btn'),
  saveCashBtn: $('#save-cash-btn'),
  saveLoanBtn: $('#save-loan-btn'),
  savePersonalBtn: $('#save-personal-btn'),
};

const clientFields = {
  client_type: $('#client-type'),
  full_name: $('#client-full-name'),
  case_title: $('#client-case-title'),
  phone: $('#client-phone'),
  email: $('#client-email'),
  messenger: $('#client-messenger'),
  address: $('#client-address'),
  notes: $('#client-notes'),
  contract_number: $('#client-contract-number'),
  contract_date: $('#client-contract-date'),
  contract_city: $('#client-contract-city'),
  contract_payment_days: $('#client-contract-payment-days'),
  customer_birth_date: $('#client-customer-birth-date'),
  registration_address: $('#client-registration-address'),
  passport_number: $('#client-passport-number'),
  passport_issued_by: $('#client-passport-issued-by'),
  passport_division_code: $('#client-passport-division-code'),
  legal_representative_name: $('#client-legal-representative-name'),
  legal_representative_position: $('#client-legal-representative-position'),
  legal_representative_basis: $('#client-legal-representative-basis'),
  company_legal_address: $('#client-company-legal-address'),
  company_mailing_address: $('#client-company-mailing-address'),
  company_inn: $('#client-company-inn'),
  company_kpp: $('#client-company-kpp'),
  company_ogrn: $('#client-company-ogrn'),
  company_bank_name: $('#client-company-bank-name'),
  company_bank_account: $('#client-company-bank-account'),
  company_correspondent_account: $('#client-company-correspondent-account'),
  company_bik: $('#client-company-bik'),
  service_description: $('#client-service-description'),
  act_date: $('#client-act-date'),
  act_city: $('#client-act-city'),
  receipt_date: $('#client-receipt-date'),
  receipt_city: $('#client-receipt-city'),
  attorney_full_name: $('#client-attorney-full-name'),
  attorney_position: $('#client-attorney-position'),
  attorney_passport: $('#client-attorney-passport'),
  attorney_address: $('#client-attorney-address'),
  attorney_phone: $('#client-attorney-phone'),
  power_of_attorney_date: $('#client-power-date'),
  power_of_attorney_city: $('#client-power-city'),
  power_of_attorney_powers: $('#client-power-powers'),
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


function bootApp() {
  try {
    if (!window.APP_CONFIG) {
      console.warn('[Право CRM] Файл config.js не загружен.');
    }
    init();
  } catch (error) {
    console.error('[Право CRM] Ошибка запуска:', error);
    alert('Приложение не удалось запустить. Обновите страницу через Ctrl+F5.');
  }
}

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
    const expectedPassword = (CONFIG.APP_PASSWORD || 'pravo888').trim();
    const enteredPassword = String(els.passwordInput.value || '').trim();
    if (enteredPassword === expectedPassword) {
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
  els.generateContractBtn?.addEventListener('click', generateContractForDraft);
  els.generateActBtn?.addEventListener('click', generateActForDraft);
  els.generateReceiptBtn?.addEventListener('click', generateReceiptForDraft);
  els.generatePoaBtn?.addEventListener('click', generatePowerOfAttorneyForDraft);
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
    // Миграция старых данных отключена: текущие данные уже привязаны к workspace_key.

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
    showToast(message === 'Failed to fetch' ? 'Ошибка сети при обращении к Supabase. Я убрал проблемную проверку legacy-данных: обновите app.js и index.html, затем откройте страницу заново.' : `Ошибка загрузки: ${message}`, 'error', 7000);
  }
}

async function migrateLegacyWorkspaceIfNeeded() {
  return;
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


function isCompanyClient(draft) {
  return String(draft?.client_type || 'individual') === 'company';
}

function updateClientTypeUI() {
  const draftType = state.clientDraft?.client_type || clientFields.client_type?.value || 'individual';
  const type = draftType === 'company' ? 'company' : 'individual';
  const isCompany = type === 'company';

  const nameLabel = document.getElementById('client-name-label');
  if (nameLabel) {
    nameLabel.textContent = isCompany ? 'Наименование организации' : 'ФИО клиента';
  }

  document.querySelectorAll('[data-client-kind]').forEach((element) => {
    const shouldShow = element.dataset.clientKind === type;
    element.classList.toggle('hidden', !shouldShow);
  });
}

function valueOrLine(value, fallback = '______________________________________') {
  const text = String(value || '').trim();
  return text ? escapeHtml(text) : fallback;
}

function formatDateHeaderLikeTemplate(value) {
  const date = value instanceof Date ? stripTime(value) : parseDateSafe(value);
  if (!date) return '«____» ___________ 2026г.';
  const day = String(date.getDate()).padStart(2, '0');
  return `«${day}» ${monthNameRu(date)} ${date.getFullYear()}г.`;
}

function buildContractCustomerIntro(draft) {
  if (isCompanyClient(draft)) {
    const companyName = valueOrLine(draft.full_name, '_________________________');
    const position = valueOrLine(draft.legal_representative_position, '_________________________');
    const representative = valueOrLine(draft.legal_representative_name, '_________________________');
    const basis = valueOrLine(draft.legal_representative_basis, '_________________________');
    return `${companyName}, именуемое в дальнейшем «Заказчик, Доверитель», в лице ${position} ${representative}, действующего на основании ${basis}, с одной стороны, и `;
  }

  const fullName = valueOrLine(draft.full_name, '_________________________');
  return `${fullName}, именуемый в дальнейшем «Заказчик, Доверитель», с одной стороны, и `;
}

function buildContractCustomerSignatureCell(draft) {
  if (isCompanyClient(draft)) {
    const companyName = valueOrLine(draft.full_name);
    const legalAddress = valueOrLine(draft.company_legal_address);
    const mailingAddress = valueOrLine(draft.company_mailing_address || draft.company_legal_address);
    const inn = valueOrLine(draft.company_inn, '____________________________');
    const kpp = valueOrLine(draft.company_kpp, '____________________________');
    const ogrn = valueOrLine(draft.company_ogrn, '____________________________');
    const rs = valueOrLine(draft.company_bank_account, '____________________________');
    const bank = valueOrLine(draft.company_bank_name, '____________________________');
    const ks = valueOrLine(draft.company_correspondent_account, '____________________________');
    const bik = valueOrLine(draft.company_bik, '____________________________');
    const phone = valueOrLine(draft.phone, '____________________________');
    const position = valueOrLine(draft.legal_representative_position, '____________________________');
    const representative = valueOrLine(draft.legal_representative_name, '____________________________');
    return `
          Заказчик: <br><br>
          ${companyName}<br><br>
          Юридический адрес: ${legalAddress}<br>
          Почтовый адрес: ${mailingAddress}<br>
          ИНН ${inn}, КПП ${kpp}<br>
          ОГРН ${ogrn}<br>
          р/с ${rs}<br>
          в ${bank}<br>
          к/с ${ks}, БИК ${bik}<br>
          тел.${phone}<br><br>
          ${position}<br><br><br>
          _____________________/${representative}/<br>
          М.п.
    `;
  }

  const fullName = valueOrLine(draft.full_name);
  const registrationAddress = valueOrLine(draft.registration_address || draft.address);
  const passportNumber = valueOrLine(draft.passport_number, '_____________________________');
  const passportIssuedBy = valueOrLine(draft.passport_issued_by, '_______________________________');
  const divisionCode = valueOrLine(draft.passport_division_code, '______________________');
  const phone = valueOrLine(draft.phone, '___________________________________');
  return `
          Заказчик: <br><br>
          ${fullName}<br>
          Адрес регистрации: ${registrationAddress}<br>
          паспорт ${passportNumber}<br>
          выдан ${passportIssuedBy}, <br>
          код подразделения ${divisionCode}<br>
          тел.${phone}<br><br><br>
          _____________________/ ${fullName}/
    `;
}

function openClientModal(clientId = null) {
  const client = clientId ? state.clients.find((item) => item.id === clientId) : null;
  const payments = client ? state.payments.filter((item) => item.client_id === clientId).map((item) => ({ ...item, payment_channel: item.payment_channel || 'cashless' })) : [];
  const expenses = client ? state.expenses.filter((item) => item.client_id === clientId).map((item) => ({ ...item, payment_channel: item.payment_channel || 'cashless' })) : [];
  const schedules = client ? state.schedules.filter((item) => item.client_id === clientId) : [];

  state.clientDraft = {
    id: client?.id || null,
    client_type: client?.client_type || 'individual',
    full_name: client?.full_name || '',
    case_title: client?.case_title || '',
    phone: client?.phone || '',
    email: client?.email || '',
    messenger: client?.messenger || '',
    address: client?.address || '',
    notes: client?.notes || '',
    contract_number: client?.contract_number || '',
    contract_date: client?.contract_date || toDateInputValue(new Date()),
    contract_city: client?.contract_city || 'Удмуртская Республика, г. Ижевск',
    contract_payment_days: client?.contract_payment_days ?? '',
    customer_birth_date: client?.customer_birth_date || '',
    registration_address: client?.registration_address || client?.address || '',
    passport_number: client?.passport_number || '',
    passport_issued_by: client?.passport_issued_by || '',
    passport_division_code: client?.passport_division_code || '',
    legal_representative_name: client?.legal_representative_name || '',
    legal_representative_position: client?.legal_representative_position || '',
    legal_representative_basis: client?.legal_representative_basis || 'Устава',
    company_legal_address: client?.company_legal_address || '',
    company_mailing_address: client?.company_mailing_address || client?.company_legal_address || '',
    company_inn: client?.company_inn || '',
    company_kpp: client?.company_kpp || '',
    company_ogrn: client?.company_ogrn || '',
    company_bank_name: client?.company_bank_name || '',
    company_bank_account: client?.company_bank_account || '',
    company_correspondent_account: client?.company_correspondent_account || '',
    company_bik: client?.company_bik || '',
    service_description: client?.service_description || client?.case_title || '',
    act_date: client?.act_date || toDateInputValue(new Date()),
    act_city: client?.act_city || client?.contract_city || 'Удмуртская Республика, г. Ижевск',
    receipt_date: client?.receipt_date || toDateInputValue(new Date()),
    receipt_city: client?.receipt_city || client?.contract_city || 'Удмуртская Республика, г. Ижевск',
    attorney_full_name: client?.attorney_full_name || '',
    attorney_position: client?.attorney_position || 'представитель ООО «Контакт+»',
    attorney_passport: client?.attorney_passport || '',
    attorney_address: client?.attorney_address || '',
    attorney_phone: client?.attorney_phone || '',
    power_of_attorney_date: client?.power_of_attorney_date || toDateInputValue(new Date()),
    power_of_attorney_city: client?.power_of_attorney_city || client?.contract_city || 'Удмуртская Республика, г. Ижевск',
    power_of_attorney_powers: client?.power_of_attorney_powers || '',
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

  updateClientTypeUI();
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
        if (field === 'client_type') {
          updateClientTypeUI();
        }
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
      client_type: draft.client_type || 'individual',
      full_name: draft.full_name.trim(),
      case_title: draft.case_title || null,
      phone: draft.phone || null,
      email: draft.email || null,
      messenger: draft.messenger || null,
      address: draft.address || null,
      notes: draft.notes || null,
      contract_number: draft.contract_number || null,
      contract_date: draft.contract_date || null,
      contract_city: draft.contract_city || null,
      contract_payment_days: parseNumber(draft.contract_payment_days) || null,
      customer_birth_date: draft.customer_birth_date || null,
      registration_address: draft.registration_address || null,
      passport_number: draft.passport_number || null,
      passport_issued_by: draft.passport_issued_by || null,
      passport_division_code: draft.passport_division_code || null,
      legal_representative_name: draft.legal_representative_name || null,
      legal_representative_position: draft.legal_representative_position || null,
      legal_representative_basis: draft.legal_representative_basis || null,
      company_legal_address: draft.company_legal_address || null,
      company_mailing_address: draft.company_mailing_address || null,
      company_inn: draft.company_inn || null,
      company_kpp: draft.company_kpp || null,
      company_ogrn: draft.company_ogrn || null,
      company_bank_name: draft.company_bank_name || null,
      company_bank_account: draft.company_bank_account || null,
      company_correspondent_account: draft.company_correspondent_account || null,
      company_bik: draft.company_bik || null,
      service_description: draft.service_description || null,
      act_date: draft.act_date || null,
      act_city: draft.act_city || null,
      receipt_date: draft.receipt_date || null,
      receipt_city: draft.receipt_city || null,
      attorney_full_name: draft.attorney_full_name || null,
      attorney_position: draft.attorney_position || null,
      attorney_passport: draft.attorney_passport || null,
      attorney_address: draft.attorney_address || null,
      attorney_phone: draft.attorney_phone || null,
      power_of_attorney_date: draft.power_of_attorney_date || null,
      power_of_attorney_city: draft.power_of_attorney_city || null,
      power_of_attorney_powers: draft.power_of_attorney_powers || null,
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

async function generateContractForDraft() {
  const draft = state.clientDraft;
  if (!draft) return;

  const missing = getContractMissingFields(draft);
  if (missing.length) {
    showToast(`Для договора заполните: ${missing.join(', ')}.`, 'error', 6500);
    return;
  }

  try {
    const html = buildContractWordHtml(draft);
    downloadWordDocument(html, createContractFilename(draft));
    showToast('Договор сформирован и скачан в Word.', 'success', 4500);
  } catch (error) {
    console.error(error);
    showToast(`Не удалось сформировать договор: ${error.message || error}`, 'error', 7000);
  }
}

function generateActForDraft() {
  const draft = state.clientDraft;
  if (!draft) return;

  const missing = getActMissingFields(draft);
  if (missing.length) {
    showToast(`Для акта заполните: ${missing.join(', ')}.`, 'error', 6500);
    return;
  }

  try {
    const html = buildActWordHtml(draft);
    downloadWordDocument(html, createActFilename(draft));
    showToast('Акт сформирован и скачан в Word.', 'success', 4500);
  } catch (error) {
    console.error(error);
    showToast(`Не удалось сформировать акт: ${error.message || error}`, 'error', 7000);
  }
}

function generateReceiptForDraft() {
  const draft = state.clientDraft;
  if (!draft) return;

  const missing = getReceiptMissingFields(draft);
  if (missing.length) {
    showToast(`Для расписки заполните: ${missing.join(', ')}.`, 'error', 6500);
    return;
  }

  try {
    const html = buildReceiptWordHtml(draft);
    downloadWordDocument(html, createReceiptFilename(draft));
    showToast('Расписка сформирована и скачана в Word.', 'success', 4500);
  } catch (error) {
    console.error(error);
    showToast(`Не удалось сформировать расписку: ${error.message || error}`, 'error', 7000);
  }
}

function generatePowerOfAttorneyForDraft() {
  const draft = state.clientDraft;
  if (!draft) return;
  if (isCompanyClient(draft)) {
    showToast('Доверенность сейчас формируется только для физического лица.', 'error', 5000);
    return;
  }

  const missing = getPowerOfAttorneyMissingFields(draft);
  if (missing.length) {
    showToast(`Для доверенности заполните: ${missing.join(', ')}.`, 'error', 7000);
    return;
  }

  try {
    const html = buildPowerOfAttorneyWordHtml(draft);
    downloadWordDocument(html, createPowerOfAttorneyFilename(draft));
    showToast('Доверенность сформирована и скачана в Word.', 'success', 4500);
  } catch (error) {
    console.error(error);
    showToast(`Не удалось сформировать доверенность: ${error.message || error}`, 'error', 7000);
  }
}

function getContractMissingFields(draft) {
  const commonChecks = [
    ['наименование клиента', draft.full_name],
    ['номер договора', draft.contract_number],
    ['дату договора', draft.contract_date],
    ['предмет услуги для договора', draft.service_description || draft.case_title],
    ['сумму договора', parseNumber(draft.contract_amount) > 0 ? 'ok' : ''],
    ['срок оплаты в днях', getContractPaymentDays(draft)],
    ['телефон клиента', draft.phone],
  ];

  const individualChecks = [
    ['адрес регистрации', draft.registration_address],
    ['паспорт клиента', draft.passport_number],
    ['кем выдан паспорт', draft.passport_issued_by],
    ['код подразделения', draft.passport_division_code],
  ];

  const companyChecks = [
    ['представителя заказчика', draft.legal_representative_name],
    ['должность представителя', draft.legal_representative_position],
    ['основание полномочий', draft.legal_representative_basis],
    ['юридический адрес', draft.company_legal_address],
    ['ИНН', draft.company_inn],
    ['КПП', draft.company_kpp],
    ['ОГРН', draft.company_ogrn],
    ['банк заказчика', draft.company_bank_name],
    ['расчетный счет', draft.company_bank_account],
    ['корреспондентский счет', draft.company_correspondent_account],
    ['БИК', draft.company_bik],
  ];

  const checks = commonChecks.concat(isCompanyClient(draft) ? companyChecks : individualChecks);
  return checks.filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
}

function getActMissingFields(draft) {
  const checks = [
    ['ФИО клиента', draft.full_name],
    ['номер договора', draft.contract_number],
    ['дату договора', draft.contract_date],
    ['дату акта', draft.act_date],
    ['услугу / дело', draft.service_description || draft.case_title],
    ['сумму договора', parseNumber(draft.contract_amount) > 0 ? 'ok' : ''],
  ];
  return checks.filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
}

function getReceiptMissingFields(draft) {
  const checks = [
    ['ФИО клиента', draft.full_name],
    ['номер договора', draft.contract_number],
    ['дату договора', draft.contract_date],
    ['дату расписки', draft.receipt_date],
    ['сумму для расписки', parseNumber(getReceiptAmount(draft)) > 0 ? 'ok' : ''],
  ];
  return checks.filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
}

function getPowerOfAttorneyMissingFields(draft) {
  const checks = [
    ['ФИО доверителя', draft.full_name],
    ['дату рождения доверителя', draft.customer_birth_date],
    ['адрес регистрации доверителя', draft.registration_address],
    ['паспорт доверителя', draft.passport_number],
    ['кем выдан паспорт доверителя', draft.passport_issued_by],
    ['код подразделения доверителя', draft.passport_division_code],
    ['ФИО представителя', draft.attorney_full_name],
    ['дату доверенности', draft.power_of_attorney_date],
    ['полномочия по доверенности', draft.power_of_attorney_powers],
  ];
  return checks.filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
}

function getContractPaymentDays(draft) {
  const explicit = Math.round(parseNumber(draft.contract_payment_days));
  if (explicit > 0) return explicit;

  const start = parseDateSafe(draft.contract_date);
  const end = parseDateSafe(draft.payment_deadline);
  if (start && end) {
    const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
    if (diff > 0) return diff;
  }

  return 0;
}

function getReceiptAmount(draft) {
  if (!draft) return 0;
  const latestPayment = [...(draft.payments || [])]
    .filter((item) => parseNumber(item.amount) > 0)
    .sort((a, b) => String(b.payment_date || '').localeCompare(String(a.payment_date || '')))[0];
  return latestPayment ? parseNumber(latestPayment.amount) : parseNumber(draft.contract_amount);
}

function buildContractWordHtml(draft) {
  const contractDate = formatDateHeaderLikeTemplate(draft.contract_date);
  const amount = parseNumber(draft.contract_amount);
  const paymentDays = getContractPaymentDays(draft);
  const paymentMode = escapeHtml(paymentTypeContractLabel(draft.payment_type));
  const paymentDaysWords = escapeHtml(numberToWordsRu(paymentDays));
  const amountDigits = escapeHtml(formatNumberPlain(amount));
  const amountWords = escapeHtml(rublesToWords(amount));
  const city = escapeHtml(draft.contract_city || 'Удмуртская Республика, г. Ижевск');
  const serviceDescription = escapeHtml(draft.service_description || draft.case_title || '______________________________________________________');
  const customerIntro = buildContractCustomerIntro(draft);
  const customerSignatureCell = buildContractCustomerSignatureCell(draft);

  return buildWordHtmlDocument(`Договор № ${escapeHtml(draft.contract_number || '____')}`, `
    <div class="title">ДОГОВОР №${escapeHtml(draft.contract_number || '____')}</div>
    <div class="subtitle">об оказании юридических услуг</div>
    <table class="meta-table"><tr><td>${city}</td><td class="right">${contractDate}</td></tr></table>

    <p>${customerIntro}Общество с ограниченной ответственностью «Контакт+», именуемое в дальнейшем «Исполнитель», в лице директора Шайхуловой Карины Дмитриевны, действующего на основании Устава, с другой стороны, именуемые в дальнейшем «Стороны», заключили настоящий Договор о нижеследующем:</p>

    <p class="section-title">1. Предмет договора</p>
    <p>1.1. Заказчик поручает, а Исполнитель принимает на себя обязательство по оказанию следующих юридических услуг по составлению искового заявления/досудебной претензии ${serviceDescription}.</p>
    <p>1.2. В предмет настоящего соглашения включены следующие виды и формы оказания юридической помощи:</p>
    <p>- консультация Заказчика;</p>
    <p>- изучение и анализ документов, материалов по делу, подбор, изучение и анализ нормативно-правовых актов, судебной практики, методических рекомендаций, специальной литературы в целях защиты прав и законных интересов Заказчика;</p>
    <p>- подготовка иска/претензии и его подача в суд, подготовка и подача необходимых возражений, письменных пояснений, ходатайств и иных процессуальных документов, надобность в которых возникнет в ходе судопроизводства по делу;</p>
    <p>- представление интересов Заказчика в суде первой инстанции при рассмотрении и разрешении дела по существу.</p>

    <p class="section-title">2. Права и обязанности Сторон</p>
    <p>2.1. Заказчик вправе:</p>
    <p>- вносить предложения, получать консультации, информацию о ходе и результатах работы, а также знакомиться с правовой позицией, подготовленными и полученными документами;</p>
    <p>- в любое время отказаться от выполнения договора с компенсацией расходов Исполнителю и уплатой вознаграждения соразмерно выполненной работе.</p>
    <p>2.2. Заказчик обязан:</p>
    <p>- оплатить выполненные Исполнителем работы (оказанные услуги) в соответствии с условиями настоящего договора;</p>
    <p>- обеспечить своевременное предоставление Исполнителю всей информации и документации, необходимой для выполнения задания (оказания услуг);</p>
    <p>- при необходимости обязан предоставить должным образом заверенную доверенность;</p>
    <p>- четко формулировать задания для Исполнителя в письменном виде или устной форме;</p>
    <p>- оказывать всяческое содействие в выполнении Исполнителем его обязанностей;</p>
    <p>- заблаговременно (не менее чем за 5 дней) уведомлять Исполнителя о датах судебных заседаний, полученных от суда и лиц, участвующих в деле, документах и предоставлять документы, указанные в определении суда.</p>
    <p>2.3. Исполнитель вправе:</p>
    <p>- затребовать и получать от Заказчика всю необходимую для выполнения поручения информацию, документы и материалы, относящиеся к предмету настоящего договора;</p>
    <p>- требовать соразмерного увеличения размера вознаграждения в случае существенного увеличения объема работ (услуг) по сравнению с предполагаемым на момент заключения соглашения.</p>
    <p>2.4. Исполнитель обязан:</p>
    <p>- выслушать Заказчика, изучить представленные документы и проинформировать Заказчика о возможных вариантах развития ситуаций;</p>
    <p>- подготовить необходимые документы в срок, предусмотренный ГПК РФ;</p>
    <p>- выполнить работы в полном объеме, порядке и сроки, предусмотренные законодательством;</p>
    <p>- честно, разумно и добросовестно отстаивать права и законные интересы Доверителя. Использовать все не запрещенные законодательством РФ средства и способы для защиты прав и законных интересов Доверителя, при этом точно и неукоснительно соблюдать требования действующего законодательства РФ;</p>
    <p>- сообщать Заказчику информацию о ходе и результатах выполнения настоящего Договора, сведения, имеющие существенное значение по делу.</p>

    <p class="section-title">3. Порядок выполнения работ (оказания услуг)</p>
    <p>3.1. Исполнитель самостоятельно определяет и назначает ответственного за осуществление работы/услуг из числа своих сотрудников, при этом, имеет право без уведомления Заказчика заменить работника без обоснования причин.</p>
    <p>3.2. Исполнитель вправе самостоятельно определять позицию, форму и варианты выполнения работы (оказания услуг), при этом, учитывая пожелания Заказчика.</p>
    <p>3.2.1. Исполнитель не несет ответственности за последствия, связанные с представлением Заказчиком документов, не соответствующих действительности.</p>
    <p>3.3. Все работы по делу проводятся Исполнителем в удобное для него время, но на основании сроков, изложенных в соответствующих Законах либо по договоренности с Заказчиком.</p>
    <p>3.5. Возражения Заказчика по объему и качеству выполненных работ (оказания услуг) должны быть обоснованными и содержать конкретные ссылки на несоответствие выполненных работ/ оказанных услуг. При этом Стороны обязаны немедленно согласовать условия устранения данной претензии.</p>

    <p class="section-title">4. Стоимость работ и порядок расчетов</p>
    <p>4.1. Стоимость услуг по договору определяется в сумме ${amountDigits} (${amountWords}) рублей и оплачивается следующим образом:</p>
    <p>- ${paymentMode};</p>
    <p>- в течение ${paymentDays} (${paymentDaysWords}) дней с момента подписания настоящего договора.</p>
    <p>Названная сумма при любом исходе дела обратно не возвращается, считается соразмерной оплатой, без вознаграждения.</p>
    <p>4.2. Согласованная между сторонами в п.4.1 Договора стоимость услуг производится за оказанную Исполнителем по договору юридическую помощь независимо от положительного результата по делу.</p>
    <p>4.3. В случае усложнения или увеличения объема работ/услуг по настоящему договору, по согласованию сторон размер оплаты за оказание юридической помощи, предусмотренный п. 4.1. настоящего Соглашения, подлежит увеличению по соглашению сторон.</p>
    <p>4.4. Оплата судебных издержек (госпошлина, экспертиза, заключение специалиста и т.д.) производится Заказчиком за свой счет и не включается стоимость услуг/работ по договору.</p>
    <p>4.5. При необходимости выезда Исполнителя за пределы города Ижевска в связи с выполнением настоящего договора Заказчик возмещает фактически понесенные расходы на проезд, проживание, питание.</p>

    <p class="section-title">5. Форс-мажор</p>
    <p>5.1. Ни одна из Сторон не будет нести ответственности за полное или частичное невыполнение любых своих обязательств, если невыполнение будет являться прямым следствием обстоятельств непреодолимого (форс-мажорного) характера, находящихся вне контроля Сторон, возникших после заключения Договора.</p>
    <p>5.2. Под форс-мажорными обстоятельствами понимаются стихийные бедствия, войны, катастрофы, землетрясения и иные природные катаклизмы.</p>

    <p class="section-title">6. Расторжение договора</p>
    <p>6.1. Договор, может быть, расторгнут по инициативе Заказчика в случаях предусмотренных действующим законодательством РФ.</p>
    <p>6.2. Договор, может быть, расторгнут по инициативе Исполнителя в случае:</p>
    <p>а) не обеспечения Исполнителя Заказчиком информацией, требуемой для выполнения Исполнителем своих обязательств по настоящему Договору;</p>
    <p>б) создание Заказчиком условий, препятствующих выполнению Исполнителем принятых по Договору обязательств;</p>
    <p>в) в иных случаях, предусмотренных действующим законодательством.</p>
    <p>6.3. Сторона, выступившая инициатором расторжения Договора, обязана уведомить другую сторону о прекращении работ не менее чем за 3 (три) рабочих дня до предполагаемой даты прекращения работ/услуг.</p>
    <p>6.4. С момента получения Стороной извещения о расторжении Договора, Исполнитель не имеет права продолжать работу/ услуги по Договору, а Заказчик не вправе требовать продолжения работ/услуг.</p>

    <p class="section-title">7. Другие условия</p>
    <p>7.1. Настоящий договор считается заключенным и вступает в действие с момента подписания его Сторонами и действует в течение 1 (одного) года. В части неисполненных обязательств Договор продолжает действовать и в случае его расторжения до полного и надлежащего исполнения Сторонами этих обязательств.</p>
    <p>7.2. Стороны обязуются все возникающие разногласия решать путем переговоров. При невозможности урегулирования сторонами возникших разногласий спор разрешается в судебном порядке, согласно законодательству РФ.</p>
    <p>7.3. Во всех иных случаях, не упомянутых в настоящем Договоре, стороны руководствуются положениями и нормами действующего законодательства.</p>
    <p>7.4. Настоящий договор составлен в двух экземплярах, по одному для каждой стороны, оба экземпляра имеют одинаковую юридическую силу.</p>

    <p class="section-title">8. Адреса, реквизиты и подписи Сторон:</p>
    <table class="sign-table">
      <tr>
        <td>
          Исполнитель:<br><br>
          ООО «Контакт+»<br><br>
          Юридический и почтовый адрес: 426009, УР,<br>
          г. Ижевск, ул. Совхозная, д.56<br>
          ИНН 1832028955, КПП184001001<br>
          ОГРН 10218014338922, дата присвоения 11.11.02г.<br>
          р/с 40702810729020000314<br>
          в филиале «Нижегородский» ОАО «АЛЬФА-БАНК»<br>
          к/с 30101810200000000824, БИК 042202824,<br><br>
          Директор <br><br><br>
          _____________________/Шайхулова К.Д./<br>
          М.п.
        </td>
        <td>
          ${customerSignatureCell}
        </td>
      </tr>
    </table>
  `);
}

function buildActWordHtml(draft) {
  const actDate = formatDateFancy(draft.act_date || draft.contract_date);
  const city = escapeHtml(draft.act_city || draft.contract_city || 'Удмуртская Республика, г. Ижевск');
  const amount = parseNumber(draft.contract_amount);
  const serviceDescription = escapeHtml(draft.service_description || draft.case_title || 'юридические услуги');
  return buildWordHtmlDocument(`Акт_${escapeHtml(draft.contract_number || 'без_номера')}`, `
    <div class="title">АКТ</div>
    <div class="subtitle">об оказании юридических услуг</div>
    <table class="meta-table"><tr><td>${city}</td><td class="right">${actDate}</td></tr></table>
    <p>Мы, нижеподписавшиеся, ООО «Контакт+» в лице директора Шайхуловой Карины Дмитриевны, именуемое в дальнейшем «Исполнитель», и <b>${escapeHtml(draft.full_name)}</b>, именуемый(ая) в дальнейшем «Заказчик», составили настоящий Акт о нижеследующем:</p>
    <p>1. Во исполнение договора № <b>${escapeHtml(draft.contract_number || '____')}</b> от <b>${escapeHtml(formatDateLongDots(draft.contract_date))}</b> Исполнитель оказал Заказчику юридические услуги по делу: <b>${serviceDescription}</b>.</p>
    <p>2. Стоимость оказанных услуг составляет <b>${escapeHtml(formatNumberPlain(amount))}</b> (<b>${escapeHtml(rublesToWords(amount))}</b>) рублей.</p>
    <p>3. Услуги оказаны в полном объеме и в согласованные сроки. Заказчик претензий по объему, качеству и срокам оказания услуг не имеет.</p>
    <p>4. Настоящий Акт составлен в двух экземплярах, имеющих одинаковую юридическую силу.</p>
    <table class="sign-table">
      <tr>
        <td>
          <b>Исполнитель:</b><br>
          ООО «Контакт+»<br><br><br>
          _____________________ /Шайхулова К.Д./
        </td>
        <td>
          <b>Заказчик:</b><br>
          ${escapeHtml(draft.full_name)}<br><br><br>
          _____________________ /${escapeHtml(draft.full_name)} /
        </td>
      </tr>
    </table>
  `);
}

function buildReceiptWordHtml(draft) {
  const receiptDate = formatDateFancy(draft.receipt_date || new Date());
  const city = escapeHtml(draft.receipt_city || draft.contract_city || 'Удмуртская Республика, г. Ижевск');
  const amount = getReceiptAmount(draft);
  const amountDigits = escapeHtml(formatNumberPlain(amount));
  const amountWords = escapeHtml(rublesToWords(amount));
  const basis = escapeHtml(draft.service_description || draft.case_title || 'оказание юридических услуг');
  return buildWordHtmlDocument(`Расписка_${escapeHtml(draft.contract_number || 'без_номера')}`, `
    <div class="title">РАСПИСКА</div>
    <table class="meta-table"><tr><td>${city}</td><td class="right">${receiptDate}</td></tr></table>
    <p>ООО «Контакт+» подтверждает получение от <b>${escapeHtml(draft.full_name)}</b> денежных средств в размере <b>${amountDigits}</b> (<b>${amountWords}</b>) рублей.</p>
    <p>Денежные средства получены в счет оплаты по договору № <b>${escapeHtml(draft.contract_number || '____')}</b> от <b>${escapeHtml(formatDateLongDots(draft.contract_date))}</b> за ${basis}.</p>
    <p>Претензий по факту приема денежных средств стороны не имеют.</p>
    <p style="margin-top:28px;"><b>Исполнитель:</b> ООО «Контакт+»</p>
    <p>Директор _____________________ /Шайхулова К.Д./</p>
    <p style="margin-top:28px;"><b>Заказчик:</b> ${escapeHtml(draft.full_name)}</p>
    <p>_____________________ /${escapeHtml(draft.full_name)} /</p>
  `);
}

function buildPowerOfAttorneyWordHtml(draft) {
  const poaDate = formatDateFancy(draft.power_of_attorney_date || new Date());
  const city = escapeHtml(draft.power_of_attorney_city || draft.contract_city || 'Удмуртская Республика, г. Ижевск');
  const powers = escapeHtml(draft.power_of_attorney_powers || '').replace(/\n/g, '<br>');
  return buildWordHtmlDocument(`Доверенность_${escapeHtml(draft.full_name || 'клиент')}`, `
    <div class="title">ДОВЕРЕННОСТЬ</div>
    <table class="meta-table"><tr><td>${city}</td><td class="right">${poaDate}</td></tr></table>
    <p>Я, <b>${escapeHtml(draft.full_name)}</b>, дата рождения: <b>${escapeHtml(formatDateLongDots(draft.customer_birth_date))}</b>, паспорт: <b>${escapeHtml(draft.passport_number || '')}</b>, выдан <b>${escapeHtml(draft.passport_issued_by || '')}</b>, код подразделения <b>${escapeHtml(draft.passport_division_code || '')}</b>, зарегистрированный(ая) по адресу: <b>${escapeHtml(draft.registration_address || draft.address || '')}</b>, настоящей доверенностью уполномочиваю:</p>
    <p><b>${escapeHtml(draft.attorney_full_name)}</b>${draft.attorney_position ? `, ${escapeHtml(draft.attorney_position)}` : ''}${draft.attorney_passport ? `, паспорт: ${escapeHtml(draft.attorney_passport)}` : ''}${draft.attorney_address ? `, адрес: ${escapeHtml(draft.attorney_address)}` : ''}${draft.attorney_phone ? `, телефон: ${escapeHtml(draft.attorney_phone)}` : ''}.</p>
    <p>Представлять мои интересы по делу / поручению: <b>${escapeHtml(draft.service_description || draft.case_title || 'юридическое сопровождение')}</b>.</p>
    <p>Представителю предоставляются следующие полномочия:</p>
    <p>${powers}</p>
    <p>Доверенность выдана сроком на один год без права передоверия, если иное не будет согласовано дополнительно.</p>
    <p style="margin-top:36px;">Доверитель: _____________________ /${escapeHtml(draft.full_name)} /</p>
  `);
}

function buildWordHtmlDocument(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: 'Times New Roman', serif; font-size: 14pt; line-height: 1.35; color: #000; }
  .title { text-align: center; font-weight: 700; font-size: 16pt; margin-bottom: 8px; text-transform: uppercase; }
  .subtitle { text-align: center; font-weight: 700; margin-bottom: 18px; }
  .section-title { font-weight: 700; margin-top: 18px; margin-bottom: 8px; }
  p { margin: 0 0 10px 0; text-align: justify; }
  ul { margin: 0 0 12px 22px; }
  li { margin-bottom: 6px; }
  .meta-table, .sign-table { width: 100%; border-collapse: collapse; margin: 0 0 16px 0; }
  .meta-table td { vertical-align: top; }
  .right { text-align: right; }
  .sign-table td { width: 50%; vertical-align: top; padding-top: 18px; }
  .sign-table br { line-height: 1.45; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function downloadWordDocument(html, filename) {
  const blob = new Blob(['﻿', html], { type: 'application/msword;charset=utf-8' });
  downloadBlob(blob, filename);
}

function formatDateFancy(value) {
  const date = value instanceof Date ? stripTime(value) : parseDateSafe(value);
  if (!date) return '«____» ____________ 20___ г.';
  const day = String(date.getDate()).padStart(2, '0');
  return `«${day}» ${monthNameRu(date)} ${date.getFullYear()} г.`;
}

function createContractFilename(draft) {
  const base = `Договор_${(draft.contract_number || 'без_номера').toString()}_${(draft.full_name || 'клиент').toString()}`;
  return `${sanitizeFilename(base)}.doc`;
}

function createActFilename(draft) {
  const base = `Акт_${(draft.contract_number || 'без_номера').toString()}_${(draft.full_name || 'клиент').toString()}`;
  return `${sanitizeFilename(base)}.doc`;
}

function createReceiptFilename(draft) {
  const base = `Расписка_${(draft.contract_number || 'без_номера').toString()}_${(draft.full_name || 'клиент').toString()}`;
  return `${sanitizeFilename(base)}.doc`;
}

function createPowerOfAttorneyFilename(draft) {
  const base = `Доверенность_${(draft.full_name || 'клиент').toString()}`;
  return `${sanitizeFilename(base)}.doc`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFilename(value) {
  return String(value || 'document')
    .replace(/[\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 160);
}

function paymentTypeContractLabel(value) {

  return {
    '100% предоплата': 'авансовым путем',
    'частями': 'частями',
    'по графику': 'по графику платежей',
  }[value] || 'в согласованном сторонами порядке';
}

function monthNameRu(date) {
  return ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'][date.getMonth()];
}

function formatDateLongDots(value) {
  if (!value) return '_________________________';
  const date = parseDateSafe(value);
  if (!date) return '_________________________';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatNumberPlain(value) {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(parseNumber(value));
}

function rublesToWords(value) {
  const amount = Math.abs(parseNumber(value));
  const rubles = Math.floor(amount);
  const kopeks = Math.round((amount - rubles) * 100);
  let result = `${numberToWordsRu(rubles)} ${pluralRu(rubles, 'рубль', 'рубля', 'рублей')}`;
  if (kopeks > 0) {
    result += ` ${String(kopeks).padStart(2, '0')} ${pluralRu(kopeks, 'копейка', 'копейки', 'копеек')}`;
  }
  return result;
}

function numberToWordsRu(value) {
  const num = Math.abs(Math.trunc(parseNumber(value)));
  if (num === 0) return 'ноль';

  const unitsMale = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const unitsFemale = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  const orders = [
    { one: '', few: '', many: '', female: false },
    { one: 'тысяча', few: 'тысячи', many: 'тысяч', female: true },
    { one: 'миллион', few: 'миллиона', many: 'миллионов', female: false },
    { one: 'миллиард', few: 'миллиарда', many: 'миллиардов', female: false },
  ];

  const chunks = [];
  let rest = num;
  while (rest > 0) {
    chunks.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const words = [];
  for (let i = chunks.length - 1; i >= 0; i -= 1) {
    const chunk = chunks[i];
    if (!chunk) continue;
    const order = orders[i] || orders[orders.length - 1];
    const genderUnits = order.female ? unitsFemale : unitsMale;
    const h = Math.floor(chunk / 100);
    const t = Math.floor((chunk % 100) / 10);
    const u = chunk % 10;
    if (h) words.push(hundreds[h]);
    if (t === 1) {
      words.push(teens[u]);
    } else {
      if (t > 1) words.push(tens[t]);
      if (u > 0) words.push(genderUnits[u]);
    }
    if (i > 0) words.push(pluralRu(chunk, order.one, order.few, order.many));
  }

  return words.join(' ').replace(/\s+/g, ' ').trim();
}

function pluralRu(number, one, few, many) {
  const n = Math.abs(number) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
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
