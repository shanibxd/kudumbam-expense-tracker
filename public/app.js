// Kudumbam Expense - Core Javascript Engine 

// Helper to get relative date string
function getFormattedDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// --- STATE MANAGEMENT (backed by the authenticated user's data on the server) ---
let appState = {
  budget: 30000,
  expenses: [],
  members: [],
  activeMemberId: '',
  categories: [],
  pinLock: { enabled: false, pin: '' }
};
let currentUser = null; // { id, name, email }

// Fetch the logged-in user's profile + full app state from the server.
// Redirects to /login.html if the session is missing/expired.
async function initAppState() {
  const meRes = await fetch('/api/me');
  if (!meRes.ok) {
    window.location.href = '/login.html';
    return false;
  }
  const meData = await meRes.json();
  currentUser = meData.user;

  const stateRes = await fetch('/api/state');
  if (!stateRes.ok) {
    window.location.href = '/login.html';
    return false;
  }
  appState = await stateRes.json();
  if (!appState.activeMemberId && appState.members.length > 0) {
    appState.activeMemberId = appState.members[0].id;
  }
  return true;
}

// Persist budget/categories/members/activeMemberId/pinLock to the server.
// (Expense records themselves are created/updated/deleted via their own API calls.)
async function saveStateToStorage() {
  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        budget: appState.budget,
        categories: appState.categories,
        members: appState.members,
        activeMemberId: appState.activeMemberId,
        pinLock: appState.pinLock
      })
    });
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// --- Expense API helpers (server enforces ownership on every call) ---
async function apiCreateExpense(expenseData) {
  const res = await fetch('/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expenseData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save expense.');
  }
  const data = await res.json();
  return data.expense;
}

async function apiUpdateExpense(id, expenseData) {
  const res = await fetch('/api/expenses/' + encodeURIComponent(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expenseData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update expense.');
  }
  const data = await res.json();
  return data.expense;
}

async function apiDeleteExpense(id) {
  const res = await fetch('/api/expenses/' + encodeURIComponent(id), { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete expense.');
  }
}

async function logoutUser() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } finally {
    window.location.href = '/login.html';
  }
}

// --- DOM ELEMENTS CACHE ---
const dom = {
  appContent: document.getElementById('appContent'),
  navTabs: document.querySelectorAll('.nav-tab'),
  screens: document.querySelectorAll('.app-screen'),
  
  // Header
  headerProfileBtn: document.getElementById('headerProfileBtn'),
  activeMemberAvatar: document.getElementById('activeMemberAvatar'),
  activeMemberName: document.getElementById('activeMemberName'),
  
  // Dashboard
  budgetLimitVal: document.getElementById('budgetLimitVal'),
  budgetSpentVal: document.getElementById('budgetSpentVal'),
  budgetRemainingVal: document.getElementById('budgetRemainingVal'),
  budgetPercentVal: document.getElementById('budgetPercentVal'),
  budgetProgressFill: document.getElementById('budgetProgressFill'),
  budgetForecastAlert: document.getElementById('budgetForecastAlert'),
  budgetForecastText: document.getElementById('budgetForecastText'),
  todayTotalVal: document.getElementById('todayTotalVal'),
  weekTotalVal: document.getElementById('weekTotalVal'),
  monthTotalVal: document.getElementById('monthTotalVal'),
  topCategoryVal: document.getElementById('topCategoryVal'),
  categoryChart: document.getElementById('categoryChart'),
  chartNoData: document.getElementById('chartNoData'),
  recentTransactionsList: document.getElementById('recentTransactionsList'),
  viewAllExpensesBtn: document.getElementById('viewAllExpensesBtn'),
  
  // Add Expense
  micButton: document.getElementById('micButton'),
  micStatusText: document.getElementById('micStatusText'),
  nlpInputField: document.getElementById('nlpInputField'),
  nlpParseBtn: document.getElementById('nlpParseBtn'),
  aiExtractedCard: document.getElementById('aiExtractedCard'),
  aiCancelBtn: document.getElementById('aiCancelBtn'),
  expenseEditorForm: document.getElementById('expenseEditorForm'),
  editExpenseId: document.getElementById('editExpenseId'),
  expAmount: document.getElementById('expAmount'),
  expCategory: document.getElementById('expCategory'),
  expDate: document.getElementById('expDate'),
  expMember: document.getElementById('expMember'),
  expDescription: document.getElementById('expDescription'),
  saveExpenseBtn: document.getElementById('saveExpenseBtn'),
  exampleChips: document.querySelectorAll('.chip'),
  tabAddExpenseBtn: document.getElementById('tabAddExpenseBtn'),
  
  // History
  historySearch: document.getElementById('historySearch'),
  filterDate: document.getElementById('filterDate'),
  filterCategory: document.getElementById('filterCategory'),
  filterMember: document.getElementById('filterMember'),
  historyResultsCount: document.getElementById('historyResultsCount'),
  historyFilteredTotal: document.getElementById('historyFilteredTotal'),
  historyTransactionsList: document.getElementById('historyTransactionsList'),
  
  // Insights
  insightsList: document.getElementById('insightsList'),
  
  // Profile
  accountName: document.getElementById('accountName'),
  accountEmail: document.getElementById('accountEmail'),
  logoutBtn: document.getElementById('logoutBtn'),
  settingsFamilyList: document.getElementById('settingsFamilyList'),
  addMemberBtn: document.getElementById('addMemberBtn'),
  settingsBudgetForm: document.getElementById('settingsBudgetForm'),
  settingsBudgetInput: document.getElementById('settingsBudgetInput'),
  addCategoryBtn: document.getElementById('addCategoryBtn'),
  settingsCategoryList: document.getElementById('settingsCategoryList'),
  pinLockToggle: document.getElementById('pinLockToggle'),
  pinSetupContainer: document.getElementById('pinSetupContainer'),
  securityPinInput: document.getElementById('securityPinInput'),
  exportDataBtn: document.getElementById('exportDataBtn'),
  importDataBtn: document.getElementById('importDataBtn'),
  importFileInput: document.getElementById('importFileInput'),
  resetDataBtn: document.getElementById('resetDataBtn'),
  
  // Modals / Overlays
  pinLockOverlay: document.getElementById('pinLockOverlay'),
  pinErrorMsg: document.getElementById('pinErrorMsg'),
  pinKeys: document.querySelectorAll('.pin-key'),
  pinKeyClear: document.getElementById('pinKeyClear'),
  memberDropdownOverlay: document.getElementById('memberDropdownOverlay'),
  dropdownMembersList: document.getElementById('dropdownMembersList')
};

// --- CUSTOM MALAYALAM/MANGLISH NATURAL LANGUAGE PARSER ---
function parseNaturalLanguageExpense(text) {
  if (!text || text.trim() === '') return null;
  
  const originalText = text.trim();
  const lowerText = originalText.toLowerCase();
  
  // 1. Amount Extraction
  // Match standard numbers (digits with optional comma/period)
  // Let's filter out year patterns (like 2026, 2027) if they stand alone
  let amount = 0;
  
  // Find numbers that are likely currency
  // Match: digits, optionally followed/preceded by roopa, rupees, rs, രൂപ, ₹
  // E.g. "500", "1200 roopa", "rs. 400", "500 രൂപ"
  const amountPatterns = [
    /(?:₹|rs\.?|rupees|roopa|രൂപ)?\s*(\d+(?:\.\d{1,2})?)\s*(?:₹|rs\.?|rupees|roopa|രൂപ|r)?/g
  ];
  
  let matches = [];
  let match;
  for (const pattern of amountPatterns) {
    while ((match = pattern.exec(lowerText)) !== null) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      // Filter out typical years or dates (e.g. 2026, 2025, or days like 19 if there are larger amounts)
      if (val > 0) {
        matches.push({ val, index: match.index, raw: match[0] });
      }
    }
  }
  
  // Select the best amount: 
  // - Look for a number near "roopa", "rupees", "rs", "₹", "രൂപ"
  // - Otherwise, pick the largest number that isn't a likely year (e.g., 2026)
  if (matches.length > 0) {
    const currencyMatch = matches.find(m => 
      /roopa|rupees|rs|₹|രൂപ/i.test(m.raw) || 
      /roopa|rupees|rs|₹|രൂപ/i.test(lowerText.substring(Math.max(0, m.index - 8), Math.min(lowerText.length, m.index + m.raw.length + 8)))
    );
    if (currencyMatch) {
      amount = currencyMatch.val;
    } else {
      // Sort descending, filter out common years unless it's the only value
      const nonYearMatches = matches.filter(m => m.val !== 2025 && m.val !== 2026 && m.val !== 2027);
      if (nonYearMatches.length > 0) {
        amount = nonYearMatches[0].val; // pick first parsed number
      } else {
        amount = matches[0].val;
      }
    }
  }

  // 2. Date Extraction
  let dateVal = getFormattedDate(0); // Default to today
  if (lowerText.includes('innale') || lowerText.includes('ഇന്നലെ') || lowerText.includes('yesterday')) {
    dateVal = getFormattedDate(-1);
  } else if (lowerText.includes('naale') || lowerText.includes('നാളെ') || lowerText.includes('tomorrow')) {
    dateVal = getFormattedDate(1);
  } else if (lowerText.includes('innu') || lowerText.includes('ഇന്ന്') || lowerText.includes('today')) {
    dateVal = getFormattedDate(0);
  }
  
  // 3. Category & Description Extraction
  let category = 'other';
  let description = '';
  
  // Keyword mappings for Kerala-centric phrasing
  const mappings = [
    {
      id: 'petrol',
      keywords: ['petrol', 'diesel', 'fuel', 'pump', 'vandi', 'വണ്ടി', 'പെട്രോൾ', 'ഡീസൽ'],
      defaultDesc: 'Petrol'
    },
    {
      id: 'groceries',
      keywords: ['grocery', 'groceries', 'supermarket', 'kada', 'ari', 'palacharakku', 'milk', 'pal', 'vegetables', 'pachaakkari', 'പച്ചക്കറി', 'പാല്', 'അരി', 'കട', 'ഗ്രോസറി'],
      defaultDesc: 'Groceries'
    },
    {
      id: 'food',
      keywords: ['hotel', 'food', 'oonu', 'biriyani', 'chaya', 'kadi', 'bakery', 'restaurant', 'tea', 'snacks', 'lunch', 'dinner', 'breakfast', 'ഭക്ഷണം', 'ഹോട്ടൽ', 'ചായ', 'ഊണ്'],
      defaultDesc: 'Hotel Food'
    },
    {
      id: 'bills',
      keywords: ['bill', 'kseb', 'current', 'electricity', 'water', 'wifi', 'internet', 'recharge', 'phone', 'mobile', 'tv', 'dish', 'കറന്റ്', 'ബിൽ', 'റീചാർജ്'],
      defaultDesc: 'KSEB / Bill Payment'
    },
    {
      id: 'education',
      keywords: ['college', 'school', 'fees', 'makan', 'makal', 'book', 'pusthakam', 'pen', 'fees', 'പഠനം', 'ഫീസ്', 'സ്കൂൾ', 'കോളേജ്'],
      defaultDesc: 'Education Fees/Books'
    },
    {
      id: 'medical',
      keywords: ['doctor', 'hospital', 'medicine', 'marunnu', 'clinic', 'checkup', 'tablets', 'medical', 'പനി', 'മരുന്ന്', 'ഡോക്ടർ', 'ആശുപത്രി'],
      defaultDesc: 'Medical & Health'
    },
    {
      id: 'shopping',
      keywords: ['dress', 'shopping', 'puthupanam', 'cloth', 'cheppu', 'aabharanam', 'gold', 'ornaments', 'തുണി', 'ഷോപ്പിംഗ്', 'സ്വർണം'],
      defaultDesc: 'Shopping'
    },
    {
      id: 'entertainment',
      keywords: ['cinema', 'movie', 'kali', 'tour', 'park', 'outing', 'theatre', 'സിനിമ', 'യാത്ര', 'കളി'],
      defaultDesc: 'Entertainment'
    },
    {
      id: 'rent',
      keywords: ['rent', 'vadaka', 'room', 'house rent', 'വാടക', 'വീട്'],
      defaultDesc: 'Rent'
    }
  ];

  // Try to find matching category
  let matchedRule = null;
  for (const rule of mappings) {
    if (rule.keywords.some(kw => lowerText.includes(kw))) {
      category = rule.id;
      matchedRule = rule;
      break;
    }
  }

  // Clean description: strip numbers, amount keywords, and date keywords
  let cleanDesc = originalText;
  
  // Strip numbers and surrounding units
  cleanDesc = cleanDesc.replace(/(?:₹|rs\.?|rupees|roopa|രൂപ)?\s*\d+(?:\.\d+)?\s*(?:₹|rs\.?|rupees|roopa|രൂപ|r)?/gi, '');
  
  // Strip common filler words
  const fillers = [
    'innu', 'innale', 'naale', 'today', 'yesterday', 'tomorrow',
    'ayi', 'aayi', 'adakkanam', 'koduthu', 'medichu', 'വാങ്ങി', 'കൊടുത്തു', 'ഇന്ന്', 'ഇന്നലെ', 'നാളെ', 'രൂപ'
  ];
  const fillerRegex = new RegExp('\\b(' + fillers.join('|') + ')\\b', 'gi');
  cleanDesc = cleanDesc.replace(fillerRegex, '');
  
  // Clean punctuation & extra whitespace
  cleanDesc = cleanDesc.replace(/[-_.,!?:()]/g, ' ');
  cleanDesc = cleanDesc.replace(/\s+/g, ' ').trim();

  // If description becomes empty, fall back to default or original phrase
  if (cleanDesc.length < 3) {
    description = matchedRule ? matchedRule.defaultDesc : originalText;
  } else {
    // Capitalize first letter
    description = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);
  }

  return {
    amount,
    category,
    date: dateVal,
    member: appState.activeMemberId,
    description
  };
}

// --- VOICE RECOGNITION HANDLING (Web Speech API) ---
let recognition = null;
let isRecording = false;

function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Speech Recognition not supported in this browser.');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'ml-IN'; // Default to Malayalam (India)
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isRecording = true;
    dom.micButton.classList.add('recording');
    dom.micStatusText.textContent = 'Listening... Speak now';
    dom.micStatusText.style.color = 'var(--danger)';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    console.log('Voice transcript:', transcript);
    dom.nlpInputField.value = transcript;
    
    // Automatically trigger parser
    handleNlpParse(transcript);
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    stopRecording();
    
    if (event.error === 'not-allowed') {
      alert('Microphone permission denied. Please allow microphone access in settings or type your expense manually.');
    } else {
      alert('Voice input failed. Try typing your expense or clicking one of the Malayalam suggestions below!');
    }
  };

  recognition.onend = () => {
    stopRecording();
  };
}

function startRecording() {
  if (!recognition) {
    alert('Speech recognition is not supported on this browser/environment. Feel free to type or tap on the Malayalam/Manglish suggestion buttons below!');
    return;
  }
  try {
    // Alternating between Malayalam and English language sets for Malayalam/English speech
    recognition.lang = 'ml-IN'; 
    recognition.start();
  } catch (e) {
    console.error(e);
  }
}

function stopRecording() {
  isRecording = false;
  dom.micButton.classList.remove('recording');
  dom.micStatusText.textContent = 'Tap to speak expense';
  dom.micStatusText.style.color = 'var(--text-dark)';
  if (recognition) {
    try { recognition.stop(); } catch (e) {}
  }
}

// --- UI NAVIGATION & TAB SWITCHING ---
function switchScreen(screenId) {
  dom.screens.forEach(screen => {
    screen.classList.remove('active');
    if (screen.id === `screen-${screenId}`) {
      screen.classList.add('active');
    }
  });

  dom.navTabs.forEach(tab => {
    tab.classList.remove('active');
    if (tab.getAttribute('data-screen') === screenId) {
      tab.classList.add('active');
    }
  });

  // Perform screen-specific refresh renders
  if (screenId === 'home') {
    renderDashboard();
  } else if (screenId === 'history') {
    renderHistory();
  } else if (screenId === 'insights') {
    renderInsights();
  } else if (screenId === 'profile') {
    renderProfile();
  } else if (screenId === 'add') {
    // Ensure extracted view is closed initially
    dom.aiExtractedCard.classList.add('collapsed');
    dom.nlpInputField.value = '';
  }
  
  // Close member switch modal if open
  dom.memberDropdownOverlay.classList.remove('active');
}

// --- DASHBOARD RENDER LOGIC ---
function renderDashboard() {
  const todayStr = getFormattedDate(0);
  const now = new Date();
  
  // Calculate spent aggregates
  let todayTotal = 0;
  let weekTotal = 0;
  let monthTotal = 0;
  
  // Get start of week (Monday)
  const monday = new Date(now);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  monday.setDate(diff);
  monday.setHours(0,0,0,0);
  
  // Get start of month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Category-wise totals for current month
  const categoryTotals = {};
  appState.categories.forEach(c => categoryTotals[c.id] = 0);
  
  appState.expenses.forEach(exp => {
    const expDate = new Date(exp.date);
    const amt = parseFloat(exp.amount);
    
    // Today
    if (exp.date === todayStr) {
      todayTotal += amt;
    }
    // This Week
    if (expDate >= monday) {
      weekTotal += amt;
    }
    // This Month
    if (expDate >= startOfMonth) {
      monthTotal += amt;
      const cat = exp.category || 'other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    }
  });

  // Display counters
  dom.todayTotalVal.textContent = `₹${todayTotal.toLocaleString('en-IN')}`;
  dom.weekTotalVal.textContent = `₹${weekTotal.toLocaleString('en-IN')}`;
  dom.monthTotalVal.textContent = `₹${monthTotal.toLocaleString('en-IN')}`;
  
  // Budget stats
  const budgetLimit = appState.budget;
  const remaining = Math.max(0, budgetLimit - monthTotal);
  const percentUsed = budgetLimit > 0 ? Math.min(100, Math.round((monthTotal / budgetLimit) * 100)) : 0;
  
  dom.budgetLimitVal.textContent = `₹${budgetLimit.toLocaleString('en-IN')}`;
  dom.budgetSpentVal.textContent = `₹${monthTotal.toLocaleString('en-IN')}`;
  dom.budgetRemainingVal.textContent = `₹${remaining.toLocaleString('en-IN')}`;
  dom.budgetPercentVal.textContent = `${percentUsed}%`;
  dom.budgetProgressFill.style.width = `${percentUsed}%`;
  
  // Budget progress colors based on limits
  if (percentUsed >= 90) {
    dom.budgetProgressFill.style.background = 'linear-gradient(90deg, #c62828, #ff8a80)';
  } else if (percentUsed >= 75) {
    dom.budgetProgressFill.style.background = 'linear-gradient(90deg, #ef6c00, #ffb74d)';
  } else {
    dom.budgetProgressFill.style.background = 'linear-gradient(90deg, var(--secondary-color), #ffcc66)';
  }

  // Monthly forecast projection
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const dailyAverage = monthTotal / currentDay;
  const projectedSpend = Math.round(dailyAverage * daysInMonth);
  
  dom.budgetForecastAlert.className = 'budget-forecast'; // Reset
  if (monthTotal === 0) {
    dom.budgetForecastText.textContent = 'Add some family expenses to calculate monthly spending projection.';
  } else if (projectedSpend > budgetLimit) {
    dom.budgetForecastAlert.classList.add('danger');
    dom.budgetForecastText.innerHTML = `⚠️ <b>High spending warning!</b> Projected spend is <b>₹${projectedSpend.toLocaleString('en-IN')}</b>, exceeding your limit by ₹${(projectedSpend - budgetLimit).toLocaleString('en-IN')}.`;
  } else if (percentUsed > 80) {
    dom.budgetForecastAlert.classList.add('warning');
    dom.budgetForecastText.innerHTML = `⚠️ <b>Budget warning:</b> You used ${percentUsed}% of your budget with ${daysInMonth - currentDay} days remaining. Consider pausing shopping or entertainment purchases.`;
  } else {
    dom.budgetForecastText.innerHTML = `💡 Estimated end-of-month spending is <b>₹${projectedSpend.toLocaleString('en-IN')}</b> (${Math.round((projectedSpend/budgetLimit)*100)}% of budget). You are on track!`;
  }

  // Find Top Category
  let topCatId = 'none';
  let topCatAmt = 0;
  Object.keys(categoryTotals).forEach(catId => {
    if (categoryTotals[catId] > topCatAmt) {
      topCatAmt = categoryTotals[catId];
      topCatId = catId;
    }
  });
  
  const topCatObj = appState.categories.find(c => c.id === topCatId);
  dom.topCategoryVal.textContent = topCatObj ? `${topCatObj.icon} ${topCatObj.name}` : 'None';

  // Render Horizontal Bar Chart
  renderCategoryChart(categoryTotals, monthTotal);

  // Render Recent Transactions (limit 4)
  renderRecentTransactions();
}

function renderCategoryChart(categoryTotals, monthTotal) {
  dom.categoryChart.innerHTML = '';
  
  if (monthTotal === 0) {
    dom.chartNoData.style.display = 'block';
    return;
  }
  dom.chartNoData.style.display = 'none';

  // Sort categories by spending descending
  const sortedCategories = appState.categories
    .map(cat => ({
      ...cat,
      total: categoryTotals[cat.id] || 0,
      percent: monthTotal > 0 ? Math.round(((categoryTotals[cat.id] || 0) / monthTotal) * 100) : 0
    }))
    .filter(cat => cat.total > 0)
    .sort((a, b) => b.total - a.total);

  sortedCategories.forEach(cat => {
    const row = document.createElement('div');
    row.className = 'chart-bar-row';
    row.innerHTML = `
      <div class="chart-bar-header">
        <span class="chart-bar-category">
          <span class="category-dot" style="background-color: ${cat.color || 'var(--primary-color)'}"></span>
          <span>${cat.icon} ${cat.name}</span>
        </span>
        <span class="chart-bar-amount">
          ₹${cat.total.toLocaleString('en-IN')} <span>(${cat.percent}%)</span>
        </span>
      </div>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="width: ${cat.percent}%; background-color: ${cat.color || 'var(--primary-color)'}"></div>
      </div>
    `;
    dom.categoryChart.appendChild(row);
  });
}

function renderRecentTransactions() {
  dom.recentTransactionsList.innerHTML = '';
  
  // Sort expenses by date descending, then ID/timestamp descending
  const sorted = [...appState.expenses].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.id.localeCompare(a.id);
  });
  
  const recent = sorted.slice(0, 4);
  
  if (recent.length === 0) {
    dom.recentTransactionsList.innerHTML = '<p class="text-muted text-center py-20" style="font-size:0.85rem;">No recent expenses found. Tap the <b>+</b> button to add one.</p>';
    return;
  }

  recent.forEach(exp => {
    const item = createTransactionItemDOM(exp);
    dom.recentTransactionsList.appendChild(item);
  });
}

// Transaction item DOM generator helper
function createTransactionItemDOM(exp) {
  const cat = appState.categories.find(c => c.id === exp.category) || { icon: '📦', name: 'Other', color: '#78909c' };
  const member = appState.members.find(m => m.id === exp.member) || { name: 'Unknown', avatar: '?' };
  
  // Format relative/clean date
  const todayStr = getFormattedDate(0);
  const yesterdayStr = getFormattedDate(-1);
  let dateText = exp.date;
  if (exp.date === todayStr) dateText = 'Today';
  else if (exp.date === yesterdayStr) dateText = 'Yesterday';
  
  const item = document.createElement('div');
  item.className = 'transaction-item';
  item.dataset.id = exp.id;
  item.innerHTML = `
    <div class="transaction-left">
      <div class="category-icon-wrapper" style="background-color: ${cat.color}22; color: ${cat.color};">
        ${cat.icon}
      </div>
      <div class="transaction-details">
        <span class="transaction-desc">${exp.description}</span>
        <span class="transaction-sub">
          <span class="member-tag">${member.name}</span>
          <span>•</span>
          <span>${dateText}</span>
        </span>
      </div>
    </div>
    <div class="transaction-right">
      <span class="transaction-amt">₹${parseFloat(exp.amount).toLocaleString('en-IN')}</span>
      <div class="transaction-actions">
        <button class="action-btn edit" title="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="action-btn delete" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `;
  
  // Attach listeners to buttons
  item.querySelector('.edit').addEventListener('click', (e) => {
    e.stopPropagation();
    handleEditExpense(exp.id);
  });
  
  item.querySelector('.delete').addEventListener('click', (e) => {
    e.stopPropagation();
    handleDeleteExpense(exp.id);
  });

  return item;
}

// --- ADD / EDIT EXPENSE CONTROLLER ---
function handleNlpParse(text) {
  const result = parseNaturalLanguageExpense(text);
  if (!result) return;

  // Open & populate the preview editor
  dom.aiExtractedCard.classList.remove('collapsed');
  
  dom.editExpenseId.value = ''; // new entry
  dom.expAmount.value = result.amount > 0 ? result.amount : '';
  dom.expCategory.value = result.category;
  dom.expDate.value = result.date;
  dom.expMember.value = result.member;
  dom.expDescription.value = result.description;

  // Scroll details card into view
  dom.aiExtractedCard.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function handleEditExpense(id) {
  const exp = appState.expenses.find(e => e.id === id);
  if (!exp) return;

  // Switch to add screen and open pre-filled editor
  switchScreen('add');
  dom.aiExtractedCard.classList.remove('collapsed');
  
  dom.editExpenseId.value = exp.id;
  dom.expAmount.value = exp.amount;
  dom.expCategory.value = exp.category;
  dom.expDate.value = exp.date;
  dom.expMember.value = exp.member;
  dom.expDescription.value = exp.description;
  
  dom.saveExpenseBtn.textContent = 'Update Expense';
}

async function handleDeleteExpense(id) {
  const exp = appState.expenses.find(e => e.id === id);
  if (!exp) return;

  if (confirm(`Are you sure you want to delete this expense: "${exp.description}" (₹${exp.amount})?`)) {
    try {
      await apiDeleteExpense(id);
      appState.expenses = appState.expenses.filter(e => e.id !== id);

      // Refresh active screen
      const activeTab = document.querySelector('.nav-tab.active');
      const screenId = activeTab ? activeTab.getAttribute('data-screen') : 'home';
      if (screenId === 'home') renderDashboard();
      else if (screenId === 'history') renderHistory();
    } catch (err) {
      alert(err.message || 'Failed to delete expense. Please try again.');
    }
  }
}

// Populate Selector Lists
function populateFormSelectors() {
  // Category Selector
  dom.expCategory.innerHTML = '';
  appState.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.name}`;
    dom.expCategory.appendChild(opt);
  });

  // Member Selector
  dom.expMember.innerHTML = '';
  appState.members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.name} (${m.role})`;
    dom.expMember.appendChild(opt);
  });
  
  // History Category Filter
  dom.filterCategory.innerHTML = '<option value="all">All Categories</option>';
  appState.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.name}`;
    dom.filterCategory.appendChild(opt);
  });

  // History Member Filter
  dom.filterMember.innerHTML = '<option value="all">Everyone</option>';
  appState.members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    dom.filterMember.appendChild(opt);
  });
}

// --- HISTORY VIEW CONTROLLER ---
function renderHistory() {
  const query = dom.historySearch.value.toLowerCase().trim();
  const dateRange = dom.filterDate.value;
  const categoryFilter = dom.filterCategory.value;
  const memberFilter = dom.filterMember.value;
  
  const todayStr = getFormattedDate(0);
  const now = new Date();
  
  // Get start of week (Monday)
  const monday = new Date(now);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  monday.setHours(0,0,0,0);
  
  // Get start of month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Filter list
  const filtered = appState.expenses.filter(exp => {
    // 1. Search Query filter (matches description or amount)
    const matchQuery = exp.description.toLowerCase().includes(query) || exp.amount.toString().includes(query);
    if (!matchQuery) return false;

    // 2. Category filter
    if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;

    // 3. Member filter
    if (memberFilter !== 'all' && exp.member !== memberFilter) return false;

    // 4. Date Range filter
    const expDate = new Date(exp.date);
    if (dateRange === 'today' && exp.date !== todayStr) return false;
    if (dateRange === 'week' && expDate < monday) return false;
    if (dateRange === 'month' && expDate < startOfMonth) return false;

    return true;
  });

  // Sort history results chronologically (newest first)
  filtered.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.id.localeCompare(a.id);
  });

  // Calculate sum of filtered
  const sum = filtered.reduce((total, e) => total + parseFloat(e.amount), 0);
  
  dom.historyResultsCount.textContent = `Showing ${filtered.length} expense${filtered.length === 1 ? '' : 's'}`;
  dom.historyFilteredTotal.textContent = `Total: ₹${sum.toLocaleString('en-IN')}`;

  // Populate list
  dom.historyTransactionsList.innerHTML = '';
  if (filtered.length === 0) {
    dom.historyTransactionsList.innerHTML = '<p class="text-muted text-center py-30" style="grid-column: 1/-1; font-size: 0.85rem;">No matching expenses found.</p>';
    return;
  }

  filtered.forEach(exp => {
    const item = createTransactionItemDOM(exp);
    dom.historyTransactionsList.appendChild(item);
  });
}

// --- AI SPENDING INSIGHTS GENERATOR ---
function renderInsights() {
  dom.insightsList.innerHTML = '';
  
  const expenses = appState.expenses;
  if (expenses.length === 0) {
    dom.insightsList.innerHTML = `
      <div class="card text-center" style="padding: 40px 20px;">
        <p class="text-muted">No insights available yet. Log some family expenses in Malayalam, Manglish, or English to enable automated analytics!</p>
      </div>
    `;
    return;
  }

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Group by months
  let thisMonthTotal = 0;
  let lastMonthTotal = 0;
  const thisMonthCategories = {};
  const lastMonthCategories = {};
  const memberTotals = {};

  expenses.forEach(exp => {
    const expDate = new Date(exp.date);
    const amt = parseFloat(exp.amount);
    
    // Member contributions
    memberTotals[exp.member] = (memberTotals[exp.member] || 0) + amt;

    if (expDate >= thisMonthStart) {
      thisMonthTotal += amt;
      thisMonthCategories[exp.category] = (thisMonthCategories[exp.category] || 0) + amt;
    } else if (expDate >= lastMonthStart && expDate <= lastMonthEnd) {
      lastMonthTotal += amt;
      lastMonthCategories[exp.category] = (lastMonthCategories[exp.category] || 0) + amt;
    }
  });

  const insights = [];

  // Insight 1: Budget limit checkpoint
  const budgetLimit = appState.budget;
  const percentUsed = budgetLimit > 0 ? Math.round((thisMonthTotal / budgetLimit) * 100) : 0;
  if (percentUsed >= 90) {
    insights.push({
      type: 'danger',
      icon: '🚨',
      title: 'Monthly budget critical!',
      desc: `Your family has already used <b>${percentUsed}%</b> of the monthly budget (₹${thisMonthTotal.toLocaleString('en-IN')} spent out of ₹${budgetLimit.toLocaleString('en-IN')}). Consider pausing non-essential purchases immediately.`
    });
  } else if (percentUsed >= 75) {
    insights.push({
      type: 'warning',
      icon: '⚠️',
      title: 'Approaching monthly budget limit',
      desc: `You have already used <b>${percentUsed}%</b> of your monthly budget. Ensure other family members are informed so they can minimize extra costs.`
    });
  } else if (percentUsed > 0) {
    insights.push({
      type: 'success',
      icon: '✅',
      title: 'Budget is healthy',
      desc: `You have used <b>${percentUsed}%</b> of your budget. Maintain this pace to save around ₹${Math.max(0, budgetLimit - thisMonthTotal).toLocaleString('en-IN')} this month.`
    });
  }

  // Insight 2: Category breakdown check
  // Compare Food category spending (most volatile)
  const thisFood = thisMonthCategories['food'] || 0;
  const lastFood = lastMonthCategories['food'] || 0;
  if (thisFood > 0 && lastFood > 0) {
    const diff = thisFood - lastFood;
    if (diff > 500) {
      insights.push({
        type: 'warning',
        icon: '🍲',
        title: 'Food expense increase detected',
        desc: `Your family spent <b>₹${thisFood.toLocaleString('en-IN')}</b> on food this month, which is ₹${diff.toLocaleString('en-IN')} higher than last month. Reducing restaurant orders by two orders per week could help you save approximately ₹1,000 per month.`
      });
    }
  }

  // Insight 3: Fuel spending check
  const thisFuel = thisMonthCategories['petrol'] || 0;
  const lastFuel = lastMonthCategories['petrol'] || 0;
  if (thisFuel > 2000) {
    insights.push({
      type: 'info',
      icon: '⛽',
      title: 'Optimize fuel costs',
      desc: `Fuel consumption is high (₹${thisFuel.toLocaleString('en-IN')} spent). Combining grocery shopping trips, running errands in single routes, or carpooling to office could save around ₹500 - ₹1,000 monthly.`
    });
  }

  // Insight 4: Highest spender analysis (Family dynamics)
  let maxSpenderName = '';
  let maxSpenderAmt = 0;
  Object.keys(memberTotals).forEach(mId => {
    if (memberTotals[mId] > maxSpenderAmt) {
      maxSpenderAmt = memberTotals[mId];
      const memObj = appState.members.find(m => m.id === mId);
      if (memObj) maxSpenderName = memObj.name;
    }
  });
  if (maxSpenderName) {
    insights.push({
      type: 'info',
      icon: '👨‍👩‍👧‍👦',
      title: `Top contributor: ${maxSpenderName}`,
      desc: `${maxSpenderName} logged the highest total expense of <b>₹${maxSpenderAmt.toLocaleString('en-IN')}</b>. Remember to review major utility bills or grocery payments that one person handles.`
    });
  }

  // Fallback default advice if only few transactions exist
  if (insights.length < 2) {
    insights.push({
      type: 'success',
      icon: '💡',
      title: 'Smart saving tip',
      desc: 'Set recurring calendar reminders to pay KSEB current bills before the due date to avoid late charges. Add them under Bills!'
    });
  }

  // Render cards
  insights.forEach(ins => {
    const card = document.createElement('div');
    card.className = `insight-card ${ins.type}`;
    card.innerHTML = `
      <div class="insight-icon-container">${ins.icon}</div>
      <div class="insight-body">
        <span class="insight-title">${ins.title}</span>
        <p class="insight-desc">${ins.desc}</p>
      </div>
    `;
    dom.insightsList.appendChild(card);
  });
}

// --- PROFILE & SETTINGS MANAGER ---
function renderProfile() {
  // Update Budget Input fields
  dom.settingsBudgetInput.value = appState.budget;

  // Render Family Member tags
  dom.settingsFamilyList.innerHTML = '';
  appState.members.forEach(m => {
    const row = document.createElement('div');
    row.className = 'family-member-item';
    row.innerHTML = `
      <div class="member-info">
        <span class="member-avatar">${m.avatar}</span>
        <span class="member-label">${m.name} <span class="text-muted" style="font-weight:400; font-size:0.75rem;">(${m.role})</span></span>
      </div>
      <div class="member-actions">
        <button class="action-btn delete-member" data-id="${m.id}" title="Delete Member">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    `;
    // Prevent deleting default if only 1 remains
    const deleteBtn = row.querySelector('.delete-member');
    deleteBtn.addEventListener('click', () => handleDeleteMember(m.id));
    if (appState.members.length <= 1) {
      deleteBtn.style.display = 'none';
    }
    
    dom.settingsFamilyList.appendChild(row);
  });

  // Render Custom Category manager tag list
  dom.settingsCategoryList.innerHTML = '';
  appState.categories.forEach(cat => {
    const pill = document.createElement('span');
    pill.className = 'category-pill';
    pill.innerHTML = `
      <span>${cat.icon} ${cat.name}</span>
      <button class="delete-pill-btn" data-id="${cat.id}">×</button>
    `;
    
    const delBtn = pill.querySelector('.delete-pill-btn');
    delBtn.addEventListener('click', () => handleDeleteCategory(cat.id));
    // Protect core categories from being deleted
    const coreIds = ['food', 'groceries', 'petrol', 'transport', 'bills', 'education', 'medical', 'shopping', 'entertainment', 'rent', 'other'];
    if (coreIds.includes(cat.id)) {
      delBtn.style.display = 'none';
    }

    dom.settingsCategoryList.appendChild(pill);
  });

  // Render Pin lock settings
  dom.pinLockToggle.checked = appState.pinLock.enabled;
  if (appState.pinLock.enabled) {
    dom.pinSetupContainer.classList.remove('collapsed');
    dom.securityPinInput.value = appState.pinLock.pin;
  } else {
    dom.pinSetupContainer.classList.add('collapsed');
    dom.securityPinInput.value = '';
  }
}

function handleAddMember() {
  const name = prompt("Enter family member's name (e.g. Ananya, Grandfather):");
  if (!name || name.trim() === '') return;
  
  const role = prompt("Enter role (e.g. Daughter, Grandmother):") || 'Family';
  const id = name.trim().toLowerCase().replace(/\s+/g, '-');
  
  // Prevent duplicate ID
  if (appState.members.some(m => m.id === id)) {
    alert('A member with this name already exists.');
    return;
  }

  const avatar = name.trim().charAt(0).toUpperCase();
  appState.members.push({ id, name: name.trim(), role: role.trim(), avatar });
  saveStateToStorage();
  
  populateFormSelectors();
  renderProfile();
}

function handleDeleteMember(id) {
  if (appState.activeMemberId === id) {
    alert('Cannot delete the active logged-in family member. Switch users first.');
    return;
  }
  if (confirm('Are you sure you want to delete this family member? Their name tags on previous expenses will remain, but you cannot log new expenses under their profile.')) {
    appState.members = appState.members.filter(m => m.id !== id);
    saveStateToStorage();
    
    populateFormSelectors();
    renderProfile();
  }
}

function handleAddCategory() {
  const name = prompt("Enter category name (e.g. Subscriptions, Gifts):");
  if (!name || name.trim() === '') return;

  const icon = prompt("Enter an emoji icon for this category (e.g. 🎁, 📱):") || '📦';
  const id = name.trim().toLowerCase().replace(/\s+/g, '-');

  if (appState.categories.some(c => c.id === id)) {
    alert('Category already exists.');
    return;
  }

  // Palette color generator helper
  const randomColors = ['#ff7043', '#42a5f5', '#26a69a', '#ab47bc', '#ffca28', '#5c6bc0', '#ec407a', '#26c6da', '#ef5350', '#9ccc65'];
  const color = randomColors[Math.floor(Math.random() * randomColors.length)];

  appState.categories.push({ id, name: name.trim(), icon, color });
  saveStateToStorage();

  populateFormSelectors();
  renderProfile();
}

async function handleDeleteCategory(id) {
  if (confirm('Are you sure you want to delete this custom category?')) {
    appState.categories = appState.categories.filter(c => c.id !== id);

    // Relabel previous transactions with deleted category to 'other' — persist
    // each affected expense via the secured update API (server re-checks ownership).
    const affected = appState.expenses.filter(exp => exp.category === id);
    for (const exp of affected) {
      exp.category = 'other';
      try {
        await apiUpdateExpense(exp.id, {
          amount: exp.amount,
          category: exp.category,
          date: exp.date,
          member: exp.member,
          description: exp.description
        });
      } catch (err) {
        console.error('Failed to reassign expense category:', err);
      }
    }

    await saveStateToStorage();

    populateFormSelectors();
    renderProfile();
  }
}

// --- HEADER USER SWITCHER ---
function openMemberDropdown() {
  dom.dropdownMembersList.innerHTML = '';
  
  appState.members.forEach(m => {
    const item = document.createElement('div');
    item.className = `dropdown-member-option ${m.id === appState.activeMemberId ? 'selected' : ''}`;
    item.innerHTML = `
      <div class="member-info">
        <span class="member-avatar">${m.avatar}</span>
        <div>
          <span class="member-label" style="display:block;">${m.name}</span>
          <span class="text-muted" style="font-size:0.7rem;">${m.role}</span>
        </div>
      </div>
      <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    `;
    
    item.addEventListener('click', () => {
      appState.activeMemberId = m.id;
      saveStateToStorage();
      
      // Update UI active header tags
      dom.activeMemberAvatar.textContent = m.avatar;
      dom.activeMemberName.textContent = `${m.name} (${m.role.charAt(0)})`;
      
      // Close modal & reload current screen content
      dom.memberDropdownOverlay.classList.remove('active');
      
      const activeTab = document.querySelector('.nav-tab.active');
      const screenId = activeTab ? activeTab.getAttribute('data-screen') : 'home';
      if (screenId === 'home') renderDashboard();
      else if (screenId === 'history') renderHistory();
    });

    dom.dropdownMembersList.appendChild(item);
  });

  dom.memberDropdownOverlay.classList.add('active');
}

// --- SECURITY PIN LOCK SCREEN ---
let pinInputBuffer = '';

function checkPinScreenLock() {
  if (appState.pinLock && appState.pinLock.enabled && appState.pinLock.pin !== '') {
    dom.pinLockOverlay.classList.add('active');
    pinInputBuffer = '';
    updatePinDots();
  } else {
    dom.pinLockOverlay.classList.remove('active');
  }
}

function updatePinDots() {
  const dots = dom.pinLockOverlay.querySelectorAll('.dot');
  dots.forEach((dot, index) => {
    if (index < pinInputBuffer.length) {
      dot.classList.add('filled');
    } else {
      dot.classList.remove('filled');
    }
  });
}

function handlePinKeyPress(val) {
  if (pinInputBuffer.length < 4) {
    pinInputBuffer += val;
    updatePinDots();
    dom.pinErrorMsg.classList.remove('visible');
    
    if (pinInputBuffer.length === 4) {
      // Validate
      if (pinInputBuffer === appState.pinLock.pin) {
        // Unlock
        dom.pinLockOverlay.classList.remove('active');
        renderDashboard(); // load data on unlock
      } else {
        // Error flash
        dom.pinErrorMsg.classList.add('visible');
        setTimeout(() => {
          pinInputBuffer = '';
          updatePinDots();
        }, 600);
      }
    }
  }
}

// --- DATA EXPORT / IMPORT (scoped server-side to the logged-in user only) ---
async function exportData() {
  try {
    const res = await fetch('/api/data/export');
    if (!res.ok) throw new Error('Export failed.');
    const data = await res.json();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `kudumbam_expense_backup_${getFormattedDate()}.json`);
    dlAnchorElem.click();
  } catch (err) {
    alert('Failed to export data. Please try again.');
  }
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(event) {
    try {
      const importedState = JSON.parse(event.target.result);
      if (!importedState.expenses || typeof importedState.budget !== 'number' || !importedState.categories) {
        alert('Invalid backup JSON format. Please load a valid file exported from this app.');
        return;
      }

      const res = await fetch('/api/data/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importedState)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to import backup.');
        return;
      }
      appState = await res.json();

      alert('App data successfully imported!');
      populateFormSelectors();
      renderDashboard();
      renderProfile();
    } catch (err) {
      alert('Failed to read JSON backup file. Error: ' + err.message);
    }
  };
  reader.readAsText(file);
}

async function resetData() {
  if (confirm('⚠️ WARNING: This will permanently erase ALL logged transactions, budget limits, custom categories, and family members. Are you sure you want to proceed?')) {
    try {
      const res = await fetch('/api/data/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed.');
      appState = await res.json();
      populateFormSelectors();

      // Reset Header avatar values
      const m = appState.members[0];
      dom.activeMemberAvatar.textContent = m.avatar;
      dom.activeMemberName.textContent = `${m.name} (${m.role.charAt(0)})`;

      switchScreen('home');
      alert('App has been reset to factory defaults.');
    } catch (err) {
      alert('Failed to reset data. Please try again.');
    }
  }
}

// --- EVENT BINDINGS & INITS ---
function registerEventListeners() {
  // Navigation tabs
  dom.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const screenId = tab.getAttribute('data-screen');
      switchScreen(screenId);
    });
  });

  // Switch member header triggers
  dom.headerProfileBtn.addEventListener('click', openMemberDropdown);
  
  // Close dropdown overlay on tap background
  dom.memberDropdownOverlay.addEventListener('click', (e) => {
    if (e.target === dom.memberDropdownOverlay) {
      dom.memberDropdownOverlay.classList.remove('active');
    }
  });

  // Home Screen actions
  dom.viewAllExpensesBtn.addEventListener('click', () => {
    switchScreen('history');
  });

  // NLP input actions
  dom.nlpParseBtn.addEventListener('click', () => {
    handleNlpParse(dom.nlpInputField.value);
  });
  dom.nlpInputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleNlpParse(dom.nlpInputField.value);
    }
  });

  // Speech Recognition button triggers
  dom.micButton.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  // Tap example tags to parse
  dom.exampleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const phrase = chip.getAttribute('data-phrase');
      dom.nlpInputField.value = phrase;
      handleNlpParse(phrase);
    });
  });

  // Preview form submit
  dom.expenseEditorForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const editId = dom.editExpenseId.value;
    const expenseData = {
      amount: parseFloat(dom.expAmount.value),
      category: dom.expCategory.value,
      date: dom.expDate.value,
      member: dom.expMember.value,
      description: dom.expDescription.value.trim()
    };

    dom.saveExpenseBtn.disabled = true;

    try {
      if (editId) {
        // Modify — server verifies this expense belongs to the logged-in user
        const updated = await apiUpdateExpense(editId, expenseData);
        const index = appState.expenses.findIndex(x => x.id === editId);
        if (index !== -1) appState.expenses[index] = updated;
      } else {
        // Create new — server associates it with the logged-in user
        const created = await apiCreateExpense(expenseData);
        appState.expenses.unshift(created);
      }

      // Clear NLP forms & slide close
      dom.expenseEditorForm.reset();
      dom.nlpInputField.value = '';
      dom.aiExtractedCard.classList.add('collapsed');
      dom.saveExpenseBtn.textContent = 'Save Expense';

      // Route back to dashboard
      switchScreen('home');
    } catch (err) {
      alert(err.message || 'Failed to save expense. Please try again.');
    } finally {
      dom.saveExpenseBtn.disabled = false;
    }
  });

  dom.aiCancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    dom.expenseEditorForm.reset();
    dom.aiExtractedCard.classList.add('collapsed');
    dom.saveExpenseBtn.textContent = 'Save Expense';
  });

  // History Filter action updates
  dom.historySearch.addEventListener('input', renderHistory);
  dom.filterDate.addEventListener('change', renderHistory);
  dom.filterCategory.addEventListener('change', renderHistory);
  dom.filterMember.addEventListener('change', renderHistory);

  // Settings: Budget submit
  dom.settingsBudgetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    appState.budget = parseInt(dom.settingsBudgetInput.value);
    saveStateToStorage();
    alert('Budget limit updated!');
    renderDashboard();
  });

  // Settings: Add member triggers
  dom.addMemberBtn.addEventListener('click', handleAddMember);
  dom.addCategoryBtn.addEventListener('click', handleAddCategory);

  // Settings: Lock Pin checkboxes
  dom.pinLockToggle.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    if (isChecked) {
      const pin = prompt('Enter a new 4-digit numeric lock PIN:');
      if (pin && /^\d{4}$/.test(pin)) {
        appState.pinLock.enabled = true;
        appState.pinLock.pin = pin;
        saveStateToStorage();
        dom.pinSetupContainer.classList.remove('collapsed');
        dom.securityPinInput.value = pin;
        alert('Security PIN Lock enabled.');
      } else {
        e.target.checked = false;
        alert('Invalid entry. PIN must be exactly 4 digits.');
      }
    } else {
      appState.pinLock.enabled = false;
      appState.pinLock.pin = '';
      saveStateToStorage();
      dom.pinSetupContainer.classList.add('collapsed');
      dom.securityPinInput.value = '';
      alert('Security PIN Lock disabled.');
    }
  });

  // Settings: Change PIN buffer values
  dom.securityPinInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (/^\d{4}$/.test(val)) {
      appState.pinLock.pin = val;
      saveStateToStorage();
    }
  });

  // Data import/export trigger links
  dom.exportDataBtn.addEventListener('click', exportData);
  dom.importDataBtn.addEventListener('click', () => dom.importFileInput.click());
  dom.importFileInput.addEventListener('change', importData);
  dom.resetDataBtn.addEventListener('click', resetData);

  // Lock PIN keyboard numbers
  dom.pinKeys.forEach(key => {
    key.addEventListener('click', () => {
      const val = key.getAttribute('data-val');
      if (val) handlePinKeyPress(val);
    });
  });

  dom.pinKeyClear.addEventListener('click', () => {
    pinInputBuffer = '';
    updatePinDots();
    dom.pinErrorMsg.classList.remove('visible');
  });

  // Account: logout
  dom.logoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to log out?')) {
      logoutUser();
    }
  });
}

// --- BOOTSTRAP APP ON LOAD ---
window.addEventListener('DOMContentLoaded', async () => {
  const authed = await initAppState(); // redirects to /login.html if not authenticated
  if (!authed) return;

  initVoiceRecognition();
  populateFormSelectors();
  registerEventListeners();

  // Update header member values
  const currentMem = appState.members.find(m => m.id === appState.activeMemberId) || appState.members[0];
  if (currentMem) {
    dom.activeMemberAvatar.textContent = currentMem.avatar;
    dom.activeMemberName.textContent = `${currentMem.name} (${currentMem.role.charAt(0)})`;
  }

  // Account info on the profile/settings screen
  if (currentUser) {
    dom.accountName.textContent = currentUser.name;
    dom.accountEmail.textContent = currentUser.email;
  }

  // Start with security lock check (restricts dashboard load if locked)
  checkPinScreenLock();

  if (!dom.pinLockOverlay.classList.contains('active')) {
    // If not locked, render dashboard initially
    renderDashboard();
  }
});
