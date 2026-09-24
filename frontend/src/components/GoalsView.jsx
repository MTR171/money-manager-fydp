import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Target, Pencil, X } from 'lucide-react';
import apiClient from '../api/client';

const fmt = (amount, currency = 'BDT') => {
  const symbols = { USD: '$', EUR: '€', GBP: '£', BDT: '৳', PKR: '₨' };
  const sym = symbols[currency] || '৳';
  return `${sym}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export default function GoalsView({ currency = 'BDT', onGoalDeposit, onSync }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal visibility
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({ title: '', target_amount: '', current_amount: '0', deadline: '', icon: '🎯' });
  const [depositAmount, setDepositAmount] = useState('');
  const [editForm, setEditForm] = useState({ title: '', target_amount: '', deadline: '', icon: '' });

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

  useEffect(() => { fetchGoals(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/api/goals/', {
        ...createForm,
        target_amount: Number(createForm.target_amount),
        current_amount: Number(createForm.current_amount) || 0,
        deadline: createForm.deadline || null,
      });
      setIsCreateOpen(false);
      setCreateForm({ title: '', target_amount: '', current_amount: '0', deadline: '', icon: '🎯' });
      fetchGoals();
    } catch (err) { console.error(err); }
  };

  const openEdit = (goal) => {
    setSelectedGoal(goal);
    setEditForm({
      title: goal.title,
      target_amount: goal.target_amount,
      deadline: goal.deadline ? goal.deadline.slice(0, 10) : '',
      icon: goal.icon,
    });
    setIsEditOpen(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!selectedGoal) return;
    try {
      const payload = {
        title: editForm.title,
        target_amount: Number(editForm.target_amount),
        icon: editForm.icon,
        deadline: editForm.deadline ? new Date(editForm.deadline).toISOString() : null,
      };
      const res = await apiClient.put(`/api/goals/${selectedGoal.id}`, payload);
      setGoals(prev => prev.map(g => g.id === selectedGoal.id ? res.data : g));
      setIsEditOpen(false);
      setSelectedGoal(null);
    } catch (err) { console.error(err); }
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!selectedGoal) return;
    try {
      await apiClient.patch(`/api/goals/${selectedGoal.id}/deposit`, { amount: Number(depositAmount) });
      setIsDepositOpen(false);
      setDepositAmount('');
      await fetchGoals();
      onGoalDeposit?.();
      onSync?.();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this goal?')) return;
    try {
      await apiClient.delete(`/api/goals/${id}`);
      fetchGoals();
    } catch (err) { console.error(err); }
  };

  const calculateProgress = (current, target) => {
    if (!target) return 0;
    return Math.min(Math.round((current / target) * 100), 100);
  };

  const getProgressBarColor = (progress, deadline, current, target) => {
    if (current >= target) return 'bg-green-500';
    if (deadline && new Date(deadline) < new Date()) return 'bg-red-500';
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

  const inputCls = 'w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:bg-slate-800 dark:border-slate-600 dark:text-gray-100';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Saving Goals</h1>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-semibold"
        >
          <Plus size={16} /> New Goal
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm animate-pulse border border-slate-100 dark:border-slate-700">
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-12 text-center flex flex-col items-center border border-slate-100 dark:border-slate-700">
          <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
            <Target className="w-12 h-12 text-blue-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">No goals yet</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Create your first savings goal!</p>
          <button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-semibold">
            <Plus size={16} /> Create Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map((goal) => {
            const progress = calculateProgress(goal.current_amount, goal.target_amount);
            const colorClass = getProgressBarColor(progress, goal.deadline, goal.current_amount, goal.target_amount);
            return (
              <div key={goal.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all duration-200">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{goal.icon}</span>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{goal.title}</h3>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <button
                      onClick={() => { setSelectedGoal(goal); setIsDepositOpen(true); }}
                      className="px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 text-xs font-semibold border border-green-200 dark:border-green-700"
                    >
                      + Deposit
                    </button>
                    <button
                      onClick={() => openEdit(goal)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      title="Edit goal"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Delete goal"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="mb-2 flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>{fmt(goal.current_amount, currency)} / {fmt(goal.target_amount, currency)} saved</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{progress}%</span>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 mb-4">
                  <div className={`${colorClass} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${progress}%` }} />
                </div>

                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <Calendar size={13} />
                  <span>{getDaysUntil(goal.deadline)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setIsCreateOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Create New Goal</h2>
              <button onClick={() => setIsCreateOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"><X size={17} className="text-gray-500" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className={labelCls}>Title</label><input required type="text" className={inputCls} value={createForm.title} onChange={e => setCreateForm({...createForm, title: e.target.value})} /></div>
              <div><label className={labelCls}>Target Amount</label><input required type="number" step="0.01" className={inputCls} value={createForm.target_amount} onChange={e => setCreateForm({...createForm, target_amount: e.target.value})} /></div>
              <div><label className={labelCls}>Starting Amount <span className="text-gray-400">(Optional)</span></label><input type="number" step="0.01" className={inputCls} value={createForm.current_amount} onChange={e => setCreateForm({...createForm, current_amount: e.target.value})} /></div>
              <div><label className={labelCls}>Deadline <span className="text-gray-400">(Optional)</span></label><input type="date" className={inputCls} value={createForm.deadline} onChange={e => setCreateForm({...createForm, deadline: e.target.value})} /></div>
              <div><label className={labelCls}>Icon (Emoji)</label><input required type="text" className={inputCls} value={createForm.icon} onChange={e => setCreateForm({...createForm, icon: e.target.value})} /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold">Create Goal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {isEditOpen && selectedGoal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setIsEditOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Edit Goal</h2>
              <button onClick={() => setIsEditOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"><X size={17} className="text-gray-500" /></button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div><label className={labelCls}>Title</label><input required type="text" className={inputCls} value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} /></div>
              <div><label className={labelCls}>Target Amount</label><input required type="number" step="0.01" className={inputCls} value={editForm.target_amount} onChange={e => setEditForm({...editForm, target_amount: e.target.value})} /></div>
              <div><label className={labelCls}>Deadline <span className="text-gray-400">(Optional)</span></label><input type="date" className={inputCls} value={editForm.deadline} onChange={e => setEditForm({...editForm, deadline: e.target.value})} /></div>
              <div><label className={labelCls}>Icon (Emoji)</label><input required type="text" className={inputCls} value={editForm.icon} onChange={e => setEditForm({...editForm, icon: e.target.value})} /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsEditOpen(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Deposit Modal ─────────────────────────────────────────────────── */}
      {isDepositOpen && selectedGoal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setIsDepositOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Deposit to {selectedGoal.title}</h2>
              <button onClick={() => setIsDepositOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"><X size={17} className="text-gray-500" /></button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Progress: {fmt(selectedGoal.current_amount, currency)} / {fmt(selectedGoal.target_amount, currency)}</p>
            <form onSubmit={handleDeposit}>
              <div className="mb-5">
                <label className={labelCls}>Amount</label>
                <input required autoFocus type="number" step="0.01" min="0.01" className={inputCls} value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsDepositOpen(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold">Deposit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
