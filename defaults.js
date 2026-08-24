// defaults.js — default categories/members/seed-expenses for a brand-new account 
const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Food', icon: '🍲', color: '#ff7043' },
  { id: 'groceries', name: 'Groceries', icon: '🛒', color: '#42a5f5' },
  { id: 'petrol', name: 'Petrol/Fuel', icon: '⛽', color: '#26a69a' },
  { id: 'transport', name: 'Transport', icon: '🚌', color: '#ab47bc' },
  { id: 'bills', name: 'Bills', icon: '🔌', color: '#ffca28' },
  { id: 'education', name: 'Education', icon: '🎓', color: '#5c6bc0' },
  { id: 'medical', name: 'Medical', icon: '🏥', color: '#ec407a' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#26c6da' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#ef5350' },
  { id: 'rent', name: 'Rent', icon: '🏠', color: '#9ccc65' },
  { id: 'other', name: 'Other', icon: '📦', color: '#78909c' }
];

const DEFAULT_MEMBERS = [
  { id: 'me', name: 'Me', role: 'Account Owner', avatar: 'M' }
];

const DEFAULT_PIN_LOCK = { enabled: false, pin: '' };
const DEFAULT_BUDGET = 30000;

module.exports = { DEFAULT_CATEGORIES, DEFAULT_MEMBERS, DEFAULT_PIN_LOCK, DEFAULT_BUDGET };
