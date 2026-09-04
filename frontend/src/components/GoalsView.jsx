import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Target } from 'lucide-react';
import apiClient from '../api/client';

const fmt = (amount, currency = 'BDT') => {
  const symbols = { USD: '$', EUR: '€', GBP: '£', BDT: '৳', PKR: '₨' };
  const sym = symbols[currency] || '৳';
  return `${sym}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export default function GoalsView({ currency = 'BDT' }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({ title: '', target_amount: '', current_amount: '0', deadline: '', icon: '🎯' });
  const [depositAmount, setDepositAmount] = useState('');

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/goals/');
      setGoals(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/api/goals/', {
        ...createForm,
        target_amount: Number(createForm.target_amount),
        current_amount: Number(createForm.current_amount) || 0,
        deadline: createForm.deadline || null
      });
      setIsCreateOpen(false);
      setCreateForm({ title: '', target_amount: '', current_amount: '0', deadline: '', icon: '🎯' });
      fetchGoals();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!selectedGoal) return;
    try {
      await apiClient.patch(`/api/goals/${selectedGoal.id}/deposit`, { amount: Number(depositAmount) });
      setIsDepositOpen(false);
      setDepositAmount('');
      fetchGoals();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this goal?')) return;
    try {
      await apiClient.delete(`/api/goals/${id}`);
      fetchGoals();
    } catch (err) {
      console.error(err);
    }
  };

  const calculateProgress = (current, target) => {
    if (!target) return 0;
    return Math.min(Math.round((current / target) * 100), 100);
  };

  const getProgressBarColor = (progress, deadline, current, target) => {
    if (current >= target) return 'bg-green-500';
    if (deadline && new Date(deadline) < new Date()) return 'bg-red-500';
    if (progress < 75) return 'bg-green-500';
    if (progress >= 75) return 'bg-amber-500';
    return 'bg-green-500';
  };

  const getDaysUntil = (deadline) => {
    if (!deadline) return 'No deadline';
    const diff = new Date(deadline) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Past due';
    if (days === 0) return 'Due today';
    return `${days} days left`;
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Saving Goals</h1>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} /> New Goal
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center flex flex-col items-center">
          <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <Target className="w-12 h-12 text-blue-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No goals yet</h2>
          <p className="text-slate-500 mb-6">Create your first goal!</p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={18} /> Create Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map((goal) => {
            const progress = calculateProgress(goal.current_amount, goal.target_amount);
            const colorClass = getProgressBarColor(progress, goal.deadline, goal.current_amount, goal.target_amount);
            
            return (
              <div key={goal.id} className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{goal.icon}</span>
                    <h3 className="text-lg font-semibold text-slate-800">{goal.title}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSelectedGoal(goal); setIsDepositOpen(true); }}
                      className="px-3 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 text-sm font-medium"
                    >
                      + Deposit
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="mb-2 flex justify-between text-sm text-slate-600">
                  <span>{fmt(goal.current_amount, currency)} / {fmt(goal.target_amount, currency)} saved</span>
                  <span className="font-semibold text-slate-800">{progress}%</span>
                </div>
                
                <div className="w-full bg-slate-100 rounded-full h-3 mb-4">
                  <div
                    className={`${colorClass} h-3 rounded-full transition-all duration-500`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>

                <div className="flex items-center text-sm text-slate-500 gap-1 mt-4 border-t pt-4">
                  <Calendar size={14} />
                  <span>{getDaysUntil(goal.deadline)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Create New Goal</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input required type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={createForm.title} onChange={e => setCreateForm({...createForm, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Target Amount</label>
                <input required type="number" step="0.01" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={createForm.target_amount} onChange={e => setCreateForm({...createForm, target_amount: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Current Amount (Optional)</label>
                <input type="number" step="0.01" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={createForm.current_amount} onChange={e => setCreateForm({...createForm, current_amount: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Deadline (Optional)</label>
                <input type="date" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={createForm.deadline} onChange={e => setCreateForm({...createForm, deadline: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Icon (Emoji)</label>
                <input required type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={createForm.icon} onChange={e => setCreateForm({...createForm, icon: e.target.value})} />
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {isDepositOpen && selectedGoal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-2">Deposit to {selectedGoal.title}</h2>
            <p className="text-sm text-slate-500 mb-4">Current progress: {fmt(selectedGoal.current_amount, currency)} / {fmt(selectedGoal.target_amount, currency)}</p>
            <form onSubmit={handleDeposit}>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input required autoFocus type="number" step="0.01" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsDepositOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Deposit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
