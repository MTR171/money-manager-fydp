import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, CheckCircle, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import apiClient from '../api/client';

const fmt = (amount, currency = 'BDT') => {
  const symbols = { USD: '$', EUR: '€', GBP: '£', BDT: '৳', PKR: '₨' };
  const sym = symbols[currency] || '৳';
  return `${sym}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const CATEGORIES = ['Food/Dining', 'Housing/Rent', 'Transport', 'Entertainment', 'Utilities', 'Healthcare', 'Shopping', 'Other'];
const FREQUENCIES = ['one-time', 'weekly', 'monthly', 'yearly'];

export default function BillsView({ currency = 'BDT', onBillPaid, onSync }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPaidCollapsed, setIsPaidCollapsed] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    title: '', amount: '', due_date: '', recurring_frequency: 'monthly', category: 'Housing/Rent'
  });

  const fetchBills = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/bills/');
      // Sort by due_date asc
      const sorted = res.data.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      setBills(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/api/bills/', {
        ...form,
        amount: Number(form.amount)
      });
      setIsModalOpen(false);
      setForm({ title: '', amount: '', due_date: '', recurring_frequency: 'monthly', category: 'Housing/Rent' });
      fetchBills();
      onSync?.();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePaid = async (id) => {
    try {
      await apiClient.patch(`/api/bills/${id}/toggle-paid`);
      await fetchBills();
      onBillPaid?.();
      onSync?.();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this bill?')) return;
    try {
      await apiClient.delete(`/api/bills/${id}`);
      fetchBills();
    } catch (err) {
      console.error(err);
    }
  };

  const getDaysInfo = (dueDate) => {
    const diff = new Date(dueDate) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return { text: 'Overdue', color: 'bg-red-100 text-red-700 border-red-200' };
    if (days === 0) return { text: 'Due Today', color: 'bg-red-100 text-red-700 border-red-200' };
    if (days <= 3) return { text: `In ${days} days`, color: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { text: `In ${days} days`, color: 'bg-green-100 text-green-700 border-green-200' };
  };

  const upcomingBills = bills.filter(b => !b.is_paid);
  const paidBills = bills.filter(b => b.is_paid);

  const totalUpcoming = upcomingBills.reduce((acc, b) => acc + Number(b.amount), 0);
  const overdueCount = upcomingBills.filter(b => {
    const diff = new Date(b.due_date) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) < 0;
  }).length;

  const renderBillRow = (bill) => {
    const daysInfo = getDaysInfo(bill.due_date);
    return (
      <div key={bill.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-3 gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-800">{bill.title}</h3>
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{bill.category}</span>
            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full capitalize">{bill.recurring_frequency.replace('-', ' ')}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="font-medium text-slate-900">{fmt(bill.amount, currency)}</span>
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              <span>{new Date(bill.due_date).toLocaleDateString()}</span>
            </div>
            {!bill.is_paid && (
              <span className={`text-xs px-2 py-0.5 rounded-md border ${daysInfo.color}`}>
                {daysInfo.text}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={() => handleTogglePaid(bill.id)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              bill.is_paid 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <CheckCircle size={18} />
            {bill.is_paid ? 'Paid' : 'Mark Paid'}
          </button>
          <button 
            onClick={() => handleDelete(bill.id)}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Bills & Subscriptions</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} /> Add Bill
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Total Upcoming</p>
            <p className="text-2xl font-bold text-slate-800">{fmt(totalUpcoming, currency)}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${overdueCount > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Overdue Bills</p>
            <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {overdueCount}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Upcoming Bills</h2>
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-white border border-slate-100 rounded-xl animate-pulse"></div>)}
          </div>
        ) : upcomingBills.length > 0 ? (
          <div>{upcomingBills.map(renderBillRow)}</div>
        ) : (
          <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300">
            <p className="text-slate-500">No upcoming bills!</p>
          </div>
        )}
      </div>

      <div>
        <button 
          onClick={() => setIsPaidCollapsed(!isPaidCollapsed)}
          className="flex items-center gap-2 text-lg font-semibold text-slate-800 mb-4 hover:text-slate-600"
        >
          {isPaidCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
          Paid Bills ({paidBills.length})
        </button>
        
        {!isPaidCollapsed && (
          <div>
            {paidBills.length > 0 ? (
              <div className="opacity-75">{paidBills.map(renderBillRow)}</div>
            ) : (
              <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-500">No paid bills yet.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Add New Bill</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input required type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount</label>
                  <input required type="number" step="0.01" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Due Date</label>
                  <input required type="date" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Frequency</label>
                  <select className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={form.recurring_frequency} onChange={e => setForm({...form, recurring_frequency: e.target.value})}>
                    {FREQUENCIES.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Bill</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
