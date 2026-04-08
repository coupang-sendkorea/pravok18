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
  activeSection: 'dashboard',
  calendarMonth: startOfMonth(new Date()),
  selectedCalendarDate: toDateInputValue(new Date()),
  currentClientId: null,
  currentEventId: null,
  clientDraft: null,
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
  calendarGrid: $('#calendar-grid'),
  calendarTitle: $('#calendar-title'),
  calendarDayEvents: $('#calendar-day-events'),
  sectionTitle: $('#section-title'),
  sectionSubtitle: $('#section-subtitle'),
  todayLabel: $('#today-label'),
  clientSearch: $('#client-search'),
  clientFilter: $('#client-filter'),
  clientsTable: $('#clients-table'),
  archiveTable: $('#archive-table'),
  eventsTable: $('#events-table'),
  clientModal: $('#client-modal'),
  eventModal: $('#event-modal'),
  clientModalTitle: $('#client-modal-title'),
  eventModalTitle: $('#event-modal-title'),
  financeSummary: $('#client-finance-summary'),
  paymentsList: $('#payments-list'),
  expensesList: $('#expenses-list'),
  scheduleList: $('#schedule-list'),
  eventClientId: $('#event-client-id'),
  refreshBtn: $('#refresh-btn'),
  openClientBtn: $('#open-client-btn'),
  openEventBtn: $('#open-event-btn'),
  prevMonthBtn: $('#prev-month-btn'),
  nextMonthBtn: $('#next-month-btn'),
  saveClientBtn: $('#save-client-btn'),
  archiveClientBtn: $('#archive-client-btn'),
  restoreClientBtn: $('#restore-client-btn'),
  saveEventBtn: $('#save-event-btn'),
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
  if (unlocked) {
    unlockApp();
  }
}

function bindGlobalEvents() {
  els.passwordForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const expectedPassword = CONFIG.APP_PASSWORD || 'pravo888';
    if (els.passwordInput.value === expectedPassword) {
      sessionStorage.setItem('law-crm-unlocked', 'yes');
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

  els.refreshBtn.addEventListener('click', loadAllData);
  els.openClientBtn.addEventListener('click', () => openClientModal());
  els.openEventBtn.addEventListener('click', () => openEventModal());
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
  $('#add-payment-btn').addEventListener('click', () => addDraftRow('payments'));
  $('#add-expense-btn').addEventListener('click', () => addDraftRow('expenses'));
  $('#add-schedule-btn').addEventListener('click', () => addDraftRow('schedules'));
  els.saveClientBtn.addEventListener('click', saveClient);
  els.archiveClientBtn.addEventListener('click', archiveCurrentClient);
  els.restoreClientBtn.addEventListener('click', restoreCurrentClient);
  els.saveEventBtn.addEventListener('click', saveEvent);
}

async function unlockApp() {
  els.passwordGate.classList.add('hidden');
  els.appShell.classList.remove('hidden');

  if (!hasSupabaseConfig) {
    els.configWarning.classList.remove('hidden');
    renderAll();
    return;
  }

  els.configWarning.classList.add('hidden');
  await loadAllData();
}

async function loadAllData() {
  if (!supabase) {
    renderAll();
    return;
  }

  try {
    showToast('Загружаю данные…', 'info', 1800);
    const [clientsRes, paymentsRes, expensesRes, schedulesRes, eventsRes] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('payments').select('*').order('payment_date', { ascending: false }),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('payment_schedules').select('*').order('due_date', { ascending: true }),
      supabase.from('events').select('*').order('event_date', { ascending: true }).order('event_time', { ascending: true }),
    ]);

    const responses = [clientsRes, paymentsRes, expensesRes, schedulesRes, eventsRes];
    const firstError = responses.find((response) => response.error)?.error;
    if (firstError) throw firstError;

    state.clients = clientsRes.data || [];
    state.payments = paymentsRes.data || [];
    state.expenses = expensesRes.data || [];
    state.schedules = schedulesRes.data || [];
    state.events = eventsRes.data || [];

    renderAll();
  } catch (error) {
    console.error(error);
    showToast(`Ошибка загрузки: ${error.message || error}`, 'error', 5000);
  }
}

function renderAll() {
  renderStats();
  renderAlerts();
  renderUpcomingEvents();
  renderCalendar();
  renderClientsTable();
  renderArchiveTable();
  renderEventsTable();
  populateEventClientOptions();
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

  const upcomingPayments = buildPaymentAlerts().filter((item) => item.kind !== 'overdue').length;
  const upcomingEventsCount = getUpcomingEvents(14).length;

  const stats = [
    { label: 'Активные дела', value: activeClients.length, subtext: `В архиве: ${archivedClients.length}` },
    { label: 'Сумма договоров', value: formatMoney(totals.contract), subtext: 'Сумма договоров не меняется' },
    { label: 'Оплачено фактически', value: formatMoney(totals.paid), subtext: 'Считается по внесённым оплатам' },
    { label: 'Остаток долга', value: formatMoney(totals.debt), subtext: 'Уменьшается автоматически' },
    { label: 'Расходы конторы', value: formatMoney(totals.expenses), subtext: 'Почта, госпошлина и др.' },
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
      <article class="event-card">
        <strong>${escapeHtml(event.title)}</strong>
        <div>${escapeHtml(formatEventDateTime(event))}</div>
        <div class="muted small">${escapeHtml(clientName || 'Без привязки к клиенту')}</div>
        ${event.description ? `<div class="muted small">${escapeHtml(event.description)}</div>` : ''}
      </article>
    `;
  }).join('');
}

function renderCalendar() {
  const monthStart = startOfMonth(state.calendarMonth);
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const cells = [];

  els.calendarTitle.textContent = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
  }).format(monthStart);

  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  dayNames.forEach((dayName) => {
    cells.push(`<div class="calendar-day-name">${dayName}</div>`);
  });

  for (let current = new Date(gridStart); current <= gridEnd; current = addDays(current, 1)) {
    const iso = toDateInputValue(current);
    const dayEvents = state.events.filter((event) => event.event_date === iso);
    const isCurrentMonth = current.getMonth() === monthStart.getMonth();
    const isToday = iso === toDateInputValue(new Date());
    const tags = dayEvents.slice(0, 3).map((event) => `<span class="calendar-tag">${escapeHtml(shorten(event.title, 16))}</span>`).join('');
    const extra = dayEvents.length > 3 ? `<span class="calendar-tag">+${dayEvents.length - 3}</span>` : '';

    cells.push(`
      <button class="calendar-cell ${!isCurrentMonth ? 'muted-month' : ''} ${isToday ? 'today' : ''} ${dayEvents.length ? 'has-events' : ''}" data-calendar-date="${iso}">
        <div class="calendar-day-number">${current.getDate()}</div>
        <div class="calendar-tags">${tags}${extra}</div>
      </button>
    `);
  }

  els.calendarGrid.innerHTML = cells.join('');
  renderCalendarDayEvents(state.selectedCalendarDate);
}

function renderCalendarDayEvents(dateString) {
  state.selectedCalendarDate = dateString;
  const events = state.events.filter((event) => event.event_date === dateString);

  if (!events.length) {
    els.calendarDayEvents.innerHTML = emptyCard(`На ${formatDate(dateString)} событий нет.`);
    return;
  }

  els.calendarDayEvents.innerHTML = `
    <div class="muted">События на ${escapeHtml(formatDate(dateString))}</div>
    ${events.map((event) => `
      <article class="event-card">
        <strong>${escapeHtml(event.title)}</strong>
        <div>${escapeHtml(formatEventDateTime(event))}</div>
        <div class="muted small">${escapeHtml(getClientName(event.client_id) || 'Без привязки к клиенту')}</div>
        ${event.description ? `<div class="muted small">${escapeHtml(event.description)}</div>` : ''}
      </article>
    `).join('')}
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
    <table class="table">
      <thead>
        <tr>
          <th>Клиент</th>
          <th>Дело</th>
          <th>Сумма договора</th>
          <th>Оплачено</th>
          <th>Долг</th>
          <th>Расходы</th>
          <th>Способ оплаты</th>
          <th>Срок оплаты</th>
          <th>Напоминание</th>
        </tr>
      </thead>
      <tbody>
        ${clients.map((client) => {
          const summary = getClientSummary(client.id);
          return `
            <tr>
              <td>
                <div class="clickable-name" data-open-client="${client.id}">${escapeHtml(client.full_name)}</div>
                <div class="mini-meta">${escapeHtml(client.phone || client.email || 'Контакты не заполнены')}</div>
              </td>
              <td>${escapeHtml(client.case_title || '—')}</td>
              <td>${escapeHtml(formatMoney(parseNumber(client.contract_amount)))}</td>
              <td>${escapeHtml(formatMoney(summary.paid))}</td>
              <td>${renderDebtPill(summary.debt)}</td>
              <td>${escapeHtml(formatMoney(summary.expenses))}</td>
              <td>${escapeHtml(client.payment_type || '—')}</td>
              <td>${escapeHtml(formatDate(client.payment_deadline))}</td>
              <td>${escapeHtml(formatDate(client.payment_reminder_date))}</td>
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
              <td><button class="btn btn-secondary btn-sm" data-restore-id="${client.id}">Вернуть</button></td>
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
            <td>${escapeHtml(event.description || '—')}</td>
            <td>
              <div class="toolbar-group">
                <button class="btn btn-secondary btn-sm" data-edit-event="${event.id}">Изменить</button>
                <button class="btn btn-danger btn-sm" data-delete-event="${event.id}">Удалить</button>
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

function switchSection(section) {
  state.activeSection = section;
  const map = {
    dashboard: {
      title: 'Главная',
      subtitle: 'Обзор дел, платежей и ближайших событий.',
    },
    clients: {
      title: 'Клиенты',
      subtitle: 'Карточки клиентов и финансовая информация.',
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
  $('#archive-section').classList.toggle('hidden', section !== 'archive');
  $('#events-section').classList.toggle('hidden', section !== 'events');
  els.sectionTitle.textContent = map[section].title;
  els.sectionSubtitle.textContent = map[section].subtitle;
}

function openClientModal(clientId = null) {
  const client = clientId ? state.clients.find((item) => item.id === clientId) : null;
  const payments = client ? state.payments.filter((item) => item.client_id === clientId) : [];
  const expenses = client ? state.expenses.filter((item) => item.client_id === clientId) : [];
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
    `<div class="mini-meta">Дата</div><div class="mini-meta">Сумма</div><div class="mini-meta">Комментарий</div><div></div>`,
    (row) => `
      <div class="mini-row" data-row-type="payments" data-row-id="${row.id || row._tempId}">
        <input type="date" data-row-field="payment_date" value="${escapeAttr(row.payment_date || toDateInputValue(new Date()))}" />
        <input type="number" min="0" step="0.01" data-row-field="amount" value="${escapeAttr(String(parseNumber(row.amount)))}" />
        <input type="text" data-row-field="comment" value="${escapeAttr(row.comment || '')}" placeholder="Комментарий" />
        <button class="btn btn-danger btn-sm" type="button" data-delete-row="payments:${row.id || row._tempId}">Удалить</button>
      </div>
    `,
    'Оплат пока нет.'
  );

  els.expensesList.innerHTML = renderDraftCollection(
    draft.expenses,
    'expenses',
    `<div class="mini-meta">Дата</div><div class="mini-meta">Сумма</div><div class="mini-meta">Комментарий</div><div></div>`,
    (row) => `
      <div class="mini-row" data-row-type="expenses" data-row-id="${row.id || row._tempId}">
        <input type="date" data-row-field="expense_date" value="${escapeAttr(row.expense_date || toDateInputValue(new Date()))}" />
        <input type="number" min="0" step="0.01" data-row-field="amount" value="${escapeAttr(String(parseNumber(row.amount)))}" />
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
      <div class="mini-row ${type === 'schedules' ? 'five-cols' : ''}">${headerHtml}</div>
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
      comment: '',
    });
  }
  if (type === 'expenses') {
    state.clientDraft.expenses.push({
      _tempId: tempId,
      expense_date: toDateInputValue(new Date()),
      amount: 0,
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
  if (!state.clientDraft) return;

  for (const [field, input] of Object.entries(clientFields)) {
    if (target === input) {
      state.clientDraft[field] = input.type === 'number' ? parseNumber(input.value) : input.value;
      renderClientFinanceSummary();
      return;
    }
  }

  const rowElement = target.closest('[data-row-type]');
  if (!rowElement) return;

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

    let clientId = draft.id;

    if (clientId) {
      const { error } = await supabase.from('clients').update(payload).eq('id', clientId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('clients').insert(payload).select().single();
      if (error) throw error;
      clientId = data.id;
      state.currentClientId = clientId;
      draft.id = clientId;
    }

    await syncChildCollection('payments', clientId, draft.originalPayments, draft.payments, (row) => ({
      payment_date: row.payment_date || null,
      amount: parseNumber(row.amount),
      comment: row.comment || null,
    }));

    await syncChildCollection('expenses', clientId, draft.originalExpenses, draft.expenses, (row) => ({
      expense_date: row.expense_date || null,
      amount: parseNumber(row.amount),
      comment: row.comment || null,
      category: row.comment || null,
    }));

    await syncChildCollection('payment_schedules', clientId, draft.originalSchedules, draft.schedules, (row) => ({
      due_date: row.due_date || null,
      planned_amount: parseNumber(row.planned_amount),
      status: row.status || 'planned',
      note: row.note || null,
    }));

    showToast('Карточка клиента сохранена.', 'success');
    closeModal('client-modal');
    state.clientDraft = null;
    await loadAllData();
  } catch (error) {
    console.error(error);
    showToast(`Ошибка сохранения клиента: ${error.message || error}`, 'error', 6000);
  }
}

async function syncChildCollection(tableName, clientId, originalRows, currentRows, mapper) {
  const originalIds = new Set(originalRows.filter((row) => row.id).map((row) => row.id));
  const currentIds = new Set(currentRows.filter((row) => row.id).map((row) => row.id));
  const toDelete = [...originalIds].filter((id) => !currentIds.has(id));

  for (const id of toDelete) {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) throw error;
  }

  for (const row of currentRows) {
    const payload = { client_id: clientId, ...mapper(row) };
    if (row.id) {
      const { error } = await supabase.from(tableName).update(payload).eq('id', row.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(tableName).insert(payload);
      if (error) throw error;
    }
  }
}

async function archiveCurrentClient() {
  if (!supabase || !state.currentClientId) return;
  const confirmed = window.confirm('Переместить дело в архив?');
  if (!confirmed) return;

  try {
    const { error } = await supabase
      .from('clients')
      .update({ case_status: 'archived', case_completed_at: new Date().toISOString() })
      .eq('id', state.currentClientId);
    if (error) throw error;
    showToast('Дело перенесено в архив.', 'success');
    closeModal('client-modal');
    await loadAllData();
    switchSection('archive');
  } catch (error) {
    showToast(`Не удалось архивировать дело: ${error.message || error}`, 'error');
  }
}

async function restoreCurrentClient() {
  if (!supabase || !state.currentClientId) return;
  try {
    const { error } = await supabase
      .from('clients')
      .update({ case_status: 'active', case_completed_at: null })
      .eq('id', state.currentClientId);
    if (error) throw error;
    showToast('Дело возвращено из архива.', 'success');
    closeModal('client-modal');
    await loadAllData();
    switchSection('clients');
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
      title: eventFields.title.value.trim(),
      client_id: eventFields.client_id.value || null,
      event_date: eventFields.event_date.value || null,
      event_time: eventFields.event_time.value || null,
      description: eventFields.description.value || null,
    };

    if (state.currentEventId) {
      const { error } = await supabase.from('events').update(payload).eq('id', state.currentEventId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('events').insert(payload);
      if (error) throw error;
    }

    showToast('Событие сохранено.', 'success');
    closeModal('event-modal');
    await loadAllData();
  } catch (error) {
    showToast(`Ошибка сохранения события: ${error.message || error}`, 'error');
  }
}

async function deleteEvent(eventId) {
  if (!supabase) return;
  const confirmed = window.confirm('Удалить событие?');
  if (!confirmed) return;

  try {
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) throw error;
    showToast('Событие удалено.', 'success');
    await loadAllData();
  } catch (error) {
    showToast(`Не удалось удалить событие: ${error.message || error}`, 'error');
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

  const calendarDate = target.closest('[data-calendar-date]')?.dataset.calendarDate;
  if (calendarDate) {
    renderCalendarDayEvents(calendarDate);
    if (state.activeSection !== 'dashboard') switchSection('dashboard');
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
  return new Date(date).toISOString().slice(0, 10);
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
