import React, { useState } from 'react';
import { X, Plus, DollarSign } from 'lucide-react';
import { transactionsAPI } from '../api/client';

const CATEGORIES = ['Food/Dining', 'Housing/Rent', 'Transport', 'Entertainment', 'Utilities', 'Healthcare', 'Shopping', 'Other'];

const TransactionModal = ({ isOpen, onClose, onSuccess, currency = 'USD' }) => {
  const [form, setForm] = useState({
    amount: '',
    type: 'expense',
    category: 'Food/Dining',
    date: new Date().toISOString().split('T')[0],
    note: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currencySymbol = { USD: '$', EUR: '€', GBP: '£', BDT: '৳', PKR: '₨' }[currency] || '$';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        amount: parseFloat(form.amount),
        type: form.type,
        category: form.category,
        date: new Date(form.date).toISOString(),
        note: form.note || null,
      };
      await transactionsAPI.create(payload);
      setForm({ amount: '', type: 'expense', category: 'Food/Dining', date: new Date().toISOString().split('T')[0], note: '' });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Plus size={18} className="text-blue-600" />
            </div>
            Add Transaction
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
            <div className="flex gap-2">
              {['expense', 'income'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, type: t }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    form.type === t
                      ? t === 'expense' ? 'bg-red-500 text-white shadow-sm' : 'bg-green-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t === 'expense' ? '💸 Expense' : '💰 Income'}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">{currencySymbol}</span>
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0.01"
                className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Note (optional)</label>
            <input
              type="text"
              name="note"
              value={form.note}
              onChange={handleChange}
              placeholder="Add a note..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
            }`}
          >
            {loading ? 'Adding...' : 'Add Transaction'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
