const STORAGE_KEY = 'financas_app_v1';
const SEED_URL = '/finance.seed.json';

const DEFAULT_SETTINGS = {
  metaEconomiaPct: 20,
};

const CATEGORY_MAP = {
  receita: ['Fonte de renda 1', 'Fonte de renda 2', 'Outros', 'Salário', 'Renda extra', 'Bonus'],
  despesa: [
    'Aluguel',
    'Aluguel/condomínio',
    'Condomínio',
    'Eletricidade',
    'internet',
    'Telefone celular',
    'Iptv',
    'Cartões de crédito',
    'Cartao Nubank',
    'Cartao Suellen',
    'Cartao Torra',
    'Cartao Assai',
    'Picpay',
    'Mercado pago',
    'Casas Bahia',
    'Renner',
    'CeA',
    'Havan',
    'Pernambucanas',
    'Riachuelo',
    'Sams',
    'Studio Z',
    'Seguro Carro',
    'Parcela Carro',
    'Parcela Empréstimo',
    'Parcela MBA',
    'pensão',
    'IPVA',
    'Salário Vera',
  ],
  investimento: [
    'Reserva de emergência',
    'Tesouro Selic',
    'CDB',
    'LCI/LCA',
    'Fundos',
    'Ações/ETFs',
    'Previdencia',
  ],
};

const FIXED_EXPENSES = new Set([
  'Aluguel',
  'Aluguel/condomínio',
  'Condomínio',
  'Eletricidade',
  'internet',
  'Telefone celular',
  'Iptv',
  'Parcela Carro',
  'Seguro Carro',
  'Parcela Empréstimo',
  'Parcela MBA',
  'pensão',
  'IPVA',
]);

const INVEST_OPTIONS = {
  conservador: [
    {
      titulo: 'Reserva de emergência',
      detalhe: 'Objetivo: 3 a 6 meses de despesas, liquidez diaria e baixo risco.',
    },
    {
      titulo: 'Tesouro Selic',
      detalhe: 'Titulo publico com boa liquidez e volatilidade baixa.',
    },
    {
      titulo: 'CDB com liquidez diaria',
      detalhe: 'Buscar cobertura do FGC e taxas proximas a 100% do CDI.',
    },
  ],
  moderado: [
    {
      titulo: 'CDBs e LCIs/LCAs',
      detalhe: 'Mesclar prazos para ganhar taxa sem perder liquidez total.',
    },
    {
      titulo: 'Fundos de renda fixa ativa',
      detalhe: 'Para diversificar duration e credito com gestao.',
    },
    {
      titulo: 'ETFs de indice amplo',
      detalhe: 'Exposicao gradual a renda variavel com custos menores.',
    },
  ],
  arrojado: [
    {
      titulo: 'Carteira de ETFs diversificada',
      detalhe: 'Brasil + exterior, foco em longo prazo e aportes regulares.',
    },
    {
      titulo: 'Acoes por setores',
      detalhe: 'Selecionar empresas com fluxo de caixa resiliente e dividendos.',
    },
    {
      titulo: 'Fundos multimercado',
      detalhe: 'Gestao ativa para cenarios de juros e cambio.',
    },
  ],
};

const state = {
  data: null,
  currentMonth: null,
  summaryType: 'despesa',
  riskLevel: 'conservador',
  filterType: '',
  search: '',
};

const elements = {
  monthSelect: document.getElementById('month-select'),
  summary: document.getElementById('summary'),
  form: document.getElementById('transaction-form'),
  date: document.getElementById('tx-date'),
  type: document.getElementById('tx-type'),
  category: document.getElementById('tx-category'),
  desc: document.getElementById('tx-desc'),
  amount: document.getElementById('tx-amount'),
  recurring: document.getElementById('tx-recurring'),
  metaEconomia: document.getElementById('meta-economia'),
  categoryList: document.getElementById('category-list'),
  summaryTable: document.getElementById('summary-table'),
  detailTable: document.getElementById('detail-table'),
  filterType: document.getElementById('filter-type'),
  filterSearch: document.getElementById('filter-search'),
  budgetBar: document.getElementById('budget-bar'),
  segExpense: document.getElementById('seg-expense'),
  segInvest: document.getElementById('seg-invest'),
  segBalance: document.getElementById('seg-balance'),
  spark: document.getElementById('spark-chart'),
  insights: document.getElementById('insights'),
  investList: document.getElementById('invest-list'),
  addBtn: document.getElementById('add-transaction-btn'),
  exportBtn: document.getElementById('export-btn'),
  importInput: document.getElementById('import-input'),
};

function toBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

function formatPct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function todayISO() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function monthKeyFromDate(dateStr) {
  return dateStr.slice(0, 7);
}

async function loadSeed() {
  try {
    const resp = await fetch(SEED_URL);
    if (!resp.ok) return null;
    return await resp.json();
  } catch (err) {
    return null;
  }
}

function loadLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function saveLocal(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function mergeSeed(localData, seedData) {
  if (!seedData) return localData;
  if (!localData) return seedData;

  const existingIds = new Set(localData.transactions.map((t) => t.id));
  const merged = {
    version: localData.version || 1,
    settings: { ...seedData.settings, ...localData.settings },
    transactions: [...localData.transactions],
  };

  seedData.transactions.forEach((tx) => {
    if (!existingIds.has(tx.id)) merged.transactions.push(tx);
  });

  return merged;
}

function getMonths(transactions) {
  const months = new Set(transactions.map((t) => t.month));
  const currentMonth = todayISO().slice(0, 7);
  months.add(currentMonth);
  return Array.from(months).sort();
}

function getTransactionsForMonth(month) {
  return state.data.transactions.filter((t) => t.month === month);
}

function summarizeMonth(month) {
  const items = getTransactionsForMonth(month);
  const totalReceita = items.filter((t) => t.type === 'receita').reduce((sum, t) => sum + t.valor, 0);
  const totalDespesa = items.filter((t) => t.type === 'despesa').reduce((sum, t) => sum + t.valor, 0);
  const totalInvest = items.filter((t) => t.type === 'investimento').reduce((sum, t) => sum + t.valor, 0);
  const saldo = totalReceita - totalDespesa - totalInvest;
  const gastoPct = totalReceita > 0 ? Math.min(totalDespesa / totalReceita, 1) : 0;
  const poupancaPct = totalReceita > 0 ? saldo / totalReceita : 0;
  return {
    totalReceita,
    totalDespesa,
    totalInvest,
    saldo,
    gastoPct,
    poupancaPct,
  };
}

function renderSummary() {
  const summary = summarizeMonth(state.currentMonth);
  const meta = state.data.settings.metaEconomiaPct || 20;
  const metaPct = meta / 100;
  const metaStatus = summary.poupancaPct >= metaPct ? 'Meta em dia' : 'Abaixo da meta';

  elements.summary.innerHTML = [
    {
      label: 'Renda mensal total',
      value: toBRL(summary.totalReceita),
      delta: summary.totalReceita ? `Percentual gasto: ${formatPct(summary.gastoPct)}` : 'Sem receita registrada',
    },
    {
      label: 'Despesa mensal total',
      value: toBRL(summary.totalDespesa),
      delta: summary.totalReceita ? `Participacao: ${formatPct(summary.totalDespesa / summary.totalReceita)}` : 'Sem base',
    },
    {
      label: 'Economia mensal total',
      value: toBRL(summary.totalInvest),
      delta: `Meta ${meta}%: ${metaStatus}`,
    },
    {
      label: 'Saldo em dinheiro',
      value: toBRL(summary.saldo),
      delta: `Taxa de poupanca: ${formatPct(summary.poupancaPct)}`,
    },
  ]
    .map(
      (kpi) => `
        <div class="kpi">
          <h3>${kpi.label}</h3>
          <div class="value">${kpi.value}</div>
          <div class="delta">${kpi.delta}</div>
        </div>
      `
    )
    .join('');

  const expensePct = summary.totalReceita > 0 ? Math.min(summary.totalDespesa / summary.totalReceita, 1) : 0;
  const investPct = summary.totalReceita > 0 ? Math.min(summary.totalInvest / summary.totalReceita, 1) : 0;
  const balancePct = Math.max(0, 1 - expensePct - investPct);

  elements.segExpense.style.width = `${expensePct * 100}%`;
  elements.segInvest.style.width = `${investPct * 100}%`;
  elements.segBalance.style.width = `${balancePct * 100}%`;
}

function renderSpark() {
  const months = getMonths(state.data.transactions).slice(-6);
  const values = months.map((month) => summarizeMonth(month).saldo);
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));

  elements.spark.innerHTML = months
    .map((month, idx) => {
      const height = Math.max(8, (Math.abs(values[idx]) / max) * 100);
      return `
        <div class="bar-col" title="${month} | ${toBRL(values[idx])}">
          <span style="height:${height}%"></span>
        </div>
      `;
    })
    .join('');
}

function renderSummaryTable() {
  const items = getTransactionsForMonth(state.currentMonth).filter((t) => t.type === state.summaryType);
  const total = items.reduce((sum, t) => sum + t.valor, 0) || 1;
  const byCat = {};
  items.forEach((t) => {
    const key = t.categoria || 'Sem categoria';
    byCat[key] = (byCat[key] || 0) + t.valor;
  });

  const rows = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([cat, value]) => `
        <tr>
          <td>${cat}</td>
          <td>${toBRL(value)}</td>
          <td>${formatPct(value / total)}</td>
        </tr>
      `
    )
    .join('');

  elements.summaryTable.innerHTML = `
    <thead>
      <tr>
        <th>Categoria</th>
        <th>Total</th>
        <th>%</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="3">Sem dados para o mes</td></tr>'}
    </tbody>
  `;
}

function renderDetailTable() {
  const items = getTransactionsForMonth(state.currentMonth)
    .filter((t) => (state.filterType ? t.type === state.filterType : true))
    .filter((t) => {
      if (!state.search) return true;
      const term = state.search.toLowerCase();
      return (
        (t.categoria && t.categoria.toLowerCase().includes(term)) ||
        (t.descricao && t.descricao.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const rows = items
    .map(
      (t) => `
        <tr>
          <td>${t.date}</td>
          <td>${t.type}</td>
          <td>${t.categoria || '-'}</td>
          <td>${t.descricao || '-'}</td>
          <td>${toBRL(t.valor)}</td>
          <td>${t.recorrente ? 'Sim' : 'Nao'}</td>
        </tr>
      `
    )
    .join('');

  elements.detailTable.innerHTML = `
    <thead>
      <tr>
        <th>Data</th>
        <th>Tipo</th>
        <th>Categoria</th>
        <th>Descricao</th>
        <th>Valor</th>
        <th>Recorrente</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6">Sem lancamentos no filtro atual</td></tr>'}
    </tbody>
  `;
}

function renderInsights() {
  const { totalReceita, totalDespesa, totalInvest, saldo, gastoPct, poupancaPct } = summarizeMonth(
    state.currentMonth
  );

  const insights = [];
  if (totalReceita === 0) {
    insights.push('Inclua pelo menos uma receita para liberar calculos completos.');
  } else {
    if (totalDespesa > totalReceita) {
      insights.push('Despesas acima da renda. Priorize cortes em itens variaveis.');
    }
    if (gastoPct > 0.7) {
      insights.push('Percentual gasto acima de 70%. Avalie renegociar despesas fixas.');
    }
    if (poupancaPct < 0.1) {
      insights.push('Taxa de poupanca baixa. Tente reservar 10% a 20% da renda.');
    }
    if (totalInvest === 0) {
      insights.push('Sem investimentos no mes. Considere iniciar com reserva de emergencia.');
    }
  }

  const despesas = getTransactionsForMonth(state.currentMonth).filter((t) => t.type === 'despesa');
  const byCat = {};
  despesas.forEach((t) => {
    const key = t.categoria || 'Sem categoria';
    byCat[key] = (byCat[key] || 0) + t.valor;
  });
  const topCats = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  topCats.forEach(([cat, value]) => {
    const tipo = FIXED_EXPENSES.has(cat) ? 'fixa' : 'variavel';
    insights.push(`Top despesa: ${cat} (${toBRL(value)}). Categoria ${tipo}.`);
  });

  if (saldo > 0) {
    insights.push(`Saldo positivo de ${toBRL(saldo)}. Direcione parte para investimentos.`);
  }

  elements.insights.innerHTML = insights.map((text) => `<li>${text}</li>`).join('');
}

function renderInvestOptions() {
  const options = INVEST_OPTIONS[state.riskLevel] || [];
  elements.investList.innerHTML = options
    .map(
      (opt) => `
        <div class="invest-card">
          <strong>${opt.titulo}</strong><br />
          <span>${opt.detalhe}</span>
        </div>
      `
    )
    .join('');
}

function updateCategoryList() {
  const type = elements.type.value;
  const cats = CATEGORY_MAP[type] || [];
  elements.categoryList.innerHTML = cats.map((cat) => `<option value="${cat}"></option>`).join('');
}

function handleSubmit(event) {
  event.preventDefault();
  const date = elements.date.value || todayISO();
  const type = elements.type.value;
  const categoria = elements.category.value.trim();
  const descricao = elements.desc.value.trim();
  const valor = Number(elements.amount.value || 0);
  const recorrente = elements.recurring.checked;

  if (!categoria || !valor) return;

  const month = monthKeyFromDate(date);
  const tx = {
    id: `${month}-${type}-${Date.now()}`,
    month,
    date,
    type,
    categoria,
    descricao,
    valor,
    recorrente,
  };

  state.data.transactions.push(tx);
  state.currentMonth = month;

  const meta = Number(elements.metaEconomia.value || DEFAULT_SETTINGS.metaEconomiaPct);
  state.data.settings.metaEconomiaPct = meta;

  saveLocal(state.data);
  renderAll();
  elements.form.reset();
  elements.date.value = date;
  elements.type.value = type;
  updateCategoryList();
}

function renderAll() {
  renderSummary();
  renderSpark();
  renderSummaryTable();
  renderDetailTable();
  renderInsights();
  renderInvestOptions();
  renderMonthSelect();
}

function renderMonthSelect() {
  const months = getMonths(state.data.transactions);
  if (!months.includes(state.currentMonth)) {
    state.currentMonth = months[months.length - 1];
  }
  elements.monthSelect.innerHTML = months
    .map((m) => `<option value="${m}">${m}</option>`)
    .join('');
  elements.monthSelect.value = state.currentMonth;
}

function bindEvents() {
  elements.monthSelect.addEventListener('change', (event) => {
    state.currentMonth = event.target.value;
    renderAll();
  });

  elements.type.addEventListener('change', updateCategoryList);
  elements.form.addEventListener('submit', handleSubmit);
  elements.filterType.addEventListener('change', (event) => {
    state.filterType = event.target.value;
    renderDetailTable();
  });
  elements.filterSearch.addEventListener('input', (event) => {
    state.search = event.target.value;
    renderDetailTable();
  });

  elements.metaEconomia.addEventListener('change', (event) => {
    const value = Number(event.target.value || DEFAULT_SETTINGS.metaEconomiaPct);
    state.data.settings.metaEconomiaPct = value;
    saveLocal(state.data);
    renderSummary();
  });

  document.querySelectorAll('[data-summary]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-summary]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.summaryType = btn.dataset.summary;
      renderSummaryTable();
    });
  });

  document.querySelectorAll('[data-risk]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-risk]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.riskLevel = btn.dataset.risk;
      renderInvestOptions();
    });
  });

  elements.addBtn.addEventListener('click', () => {
    elements.date.focus();
    elements.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  elements.exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'financas.json';
    link.click();
    URL.revokeObjectURL(url);
  });

  elements.importInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const imported = JSON.parse(text);
      if (!imported.transactions) return;
      state.data = mergeSeed(imported, null);
      saveLocal(state.data);
      renderAll();
    } catch (err) {
      console.warn('Arquivo invalido');
    }
  });
}

async function init() {
  const localData = loadLocal();
  const seedData = await loadSeed();
  state.data = mergeSeed(localData, seedData) || { version: 1, settings: DEFAULT_SETTINGS, transactions: [] };

  if (!state.data.settings) state.data.settings = { ...DEFAULT_SETTINGS };
  if (state.data.settings.metaEconomiaPct === undefined) {
    state.data.settings.metaEconomiaPct = DEFAULT_SETTINGS.metaEconomiaPct;
  }

  const months = getMonths(state.data.transactions);
  state.currentMonth = months[months.length - 1];

  elements.date.value = todayISO();
  elements.metaEconomia.value = state.data.settings.metaEconomiaPct;
  updateCategoryList();
  bindEvents();
  renderAll();
}

init();
