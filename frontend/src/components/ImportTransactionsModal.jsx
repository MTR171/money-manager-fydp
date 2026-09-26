import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, CheckCircle, AlertTriangle, X } from 'lucide-react';

const RECOGNIZED_CATEGORIES = [
  'Food/Dining',
  'Housing/Rent',
  'Transport',
  'Entertainment',
  'Utilities',
  'Healthcare',
  'Shopping',
  'Other',
  'Savings/Goal Contribution',
];

const CATEGORY_ALIASES = {
  'food': 'Food/Dining',
  'dining': 'Food/Dining',
  'food/dining': 'Food/Dining',
  'housing': 'Housing/Rent',
  'rent': 'Housing/Rent',
  'housing/rent': 'Housing/Rent',
  'transport': 'Transport',
  'transportation': 'Transport',
  'entertainment': 'Entertainment',
  'utilities': 'Utilities',
  'utility': 'Utilities',
  'healthcare': 'Healthcare',
  'health': 'Healthcare',
  'medical': 'Healthcare',
  'shopping': 'Shopping',
  'other': 'Other',
  'income': 'Other',
  'salary': 'Other',
  'savings': 'Savings/Goal Contribution',
  'savings/goal contribution': 'Savings/Goal Contribution',
  'goal': 'Savings/Goal Contribution',
};

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeCategory(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const exact = RECOGNIZED_CATEGORIES.find(c => c.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;
  return CATEGORY_ALIASES[trimmed.toLowerCase()] || null;
}

function validateRow(raw, index) {
  const errors = [];

  // 1. Validate Date (preserve exact calendar date at 12:00 UTC to prevent timezone day shift)
  const rawDate = (raw.date !== undefined && raw.date !== null) ? raw.date : ((raw.Date !== undefined && raw.Date !== null) ? raw.Date : '');
  const parsedDate = rawDate ? new Date(rawDate) : new Date(NaN);
  const validDate = !isNaN(parsedDate.getTime());
  if (!validDate) errors.push('Invalid date');

  let dateISO = null;
  if (validDate) {
    const y = parsedDate.getFullYear();
    const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const d = String(parsedDate.getDate()).padStart(2, '0');
    dateISO = `${y}-${m}-${d}T12:00:00.000Z`;
  }

  // 2. Validate Category
  const rawCategory = (raw.category !== undefined && raw.category !== null) ? raw.category : ((raw.Category !== undefined && raw.Category !== null) ? raw.Category : '');
  const normalizedCat = normalizeCategory(rawCategory);
  if (!normalizedCat) errors.push(`Unrecognized category "${rawCategory || 'empty'}"`);

  // 3. Validate Type
  const rawTypeVal = (raw.type !== undefined && raw.type !== null) ? raw.type : ((raw.Type !== undefined && raw.Type !== null) ? raw.Type : '');
  const rawType = String(rawTypeVal).trim().toLowerCase();
  const validType = rawType === 'income' || rawType === 'expense';
  if (!validType) errors.push('Type must be income or expense');

  // 4. Validate Amount
  const rawAmount = (raw.amount !== undefined && raw.amount !== null) ? raw.amount : ((raw.Amount !== undefined && raw.Amount !== null) ? raw.Amount : '');
  const numAmount = parseFloat(String(rawAmount).replace(/[^0-9.-]/g, ''));
  const validAmount = !isNaN(numAmount) && numAmount > 0;
  if (!validAmount) errors.push('Amount must be > 0');

  // 5. Note
  const rawNote = (raw.note !== undefined && raw.note !== null) ? raw.note : ((raw.Note !== undefined && raw.Note !== null) ? raw.Note : (raw.description || ''));
  const note = String(rawNote).trim();

  return {
    rowNum: index + 1,
    rawDate: String(rawDate),
    dateISO,
    category: normalizedCat || String(rawCategory || '—'),
    type: validType ? rawType : String(rawType || '—'),
    amount: validAmount ? numAmount : rawAmount,
    note,
    isValid: errors.length === 0,
    errors,
  };
}

export default function ImportTransactionsModal({ isOpen, onClose, onCommit, currency = 'USD' }) {
  const [parsedRows, setParsedRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const currencySymbol = { USD: '$', EUR: '€', GBP: '£', BDT: '৳', PKR: '₨' }[currency] || '$';

  if (!isOpen) return null;

  const validRows = parsedRows.filter(r => r.isValid);
  const invalidRows = parsedRows.filter(r => !r.isValid);

  const handleDownloadSample = () => {
    const sampleCSV = [
      'Date,Category,Type,Amount,Note',
      '2026-09-01,Housing/Rent,expense,1200.00,Monthly apartment rent',
      '2026-09-05,Food/Dining,expense,48.50,Weekly grocery run',
      '2026-09-10,Utilities,expense,85.00,Electricity and internet bill',
      '2026-09-15,Other,income,3200.00,Monthly salary deposit',
    ].join('\n');
    const blob = new Blob([sampleCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_transactions_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (file) => {
    if (!file) return;
    setFileName(file.name);
    setParseError('');
    setParsedRows([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String((e.target && e.target.result) || '').trim();
        if (!text) {
          setParseError('The selected file is empty.');
          return;
        }

        if (file.name.toLowerCase().endsWith('.json') || text.startsWith('[') || text.startsWith('{')) {
          const json = JSON.parse(text);
          const arr = Array.isArray(json) ? json : Array.isArray(json.transactions) ? json.transactions : null;
          if (!arr) {
            setParseError('JSON file must contain an array of transaction objects.');
            return;
          }
          setParsedRows(arr.map((item, idx) => validateRow(item, idx)));
        } else {
          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length === 0) {
            setParseError('No rows found in CSV file.');
            return;
          }

          const firstCols = parseCSVLine(lines[0]).map(c => c.toLowerCase());
          const hasHeader =
            firstCols.includes('date') ||
            firstCols.includes('category') ||
            firstCols.includes('amount') ||
            firstCols.includes('type');

          const headers = hasHeader ? firstCols : ['date', 'category', 'type', 'amount', 'note'];
          const dataLines = hasHeader ? lines.slice(1) : lines;

          const rows = dataLines.map((line, idx) => {
            const cols = parseCSVLine(line);
            const obj = {};
            headers.forEach((h, i) => {
              obj[h] = (cols[i] !== undefined && cols[i] !== null) ? cols[i] : '';
            });
            return validateRow(obj, idx);
          });
          setParsedRows(rows);
        }
      } catch (err) {
        setParseError('Failed to parse file. Please upload a valid CSV or JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleCommit = async () => {
    if (validRows.length === 0) return;
    setSubmitting(true);
    try {
      const payloads = validRows.map(r => ({
        amount: Number(r.amount),
        type: r.type,
        category: r.category,
        date: r.dateISO,
        note: r.note || null,
      }));
      await onCommit(payloads);
      setParsedRows([]);
      setFileName('');
      onClose();
    } catch (err) {
      setParseError('Failed to import transactions. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setParsedRows([]);
    setFileName('');
    setParseError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-100 dark:border-slate-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-xl">
              <Upload size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800 dark:text-slate-100">Import Transactions</h2>
              <p className="text-xs text-gray-400 dark:text-slate-400">Upload a .csv or .json file with automatic validation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X size={18} className="text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Top Bar: Upload Dropzone & Sample Template Link */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <FileText size={22} className="text-blue-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">
                  {fileName ? `Selected: ${fileName}` : 'Choose a CSV or JSON file to preview'}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-slate-400">
                  Columns: Date, Category, Type (income/expense), Amount, Note
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadSample}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <Download size={13} /> Download Sample CSV Template
              </button>
              <label className="cursor-pointer flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap">
                <Upload size={13} /> Browse File
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  className="hidden"
                  onChange={e => handleFileChange(e.target.files && e.target.files[0])}
                />
              </label>
            </div>
          </div>

          {parseError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle size={15} className="flex-shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Validation Summary & Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle size={13} /> {validRows.length} Valid
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    invalidRows.length > 0
                      ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}>
                    <AlertTriangle size={13} /> {invalidRows.length} Invalid
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-400">
                    ({parsedRows.length} total rows parsed)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 underline"
                >
                  Clear file
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                    <tr>
                      {['#', 'Date', 'Category', 'Type', 'Amount', 'Note', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                    {parsedRows.map((r) => (
                      <tr key={r.rowNum} className={r.isValid ? 'hover:bg-slate-50/80 dark:hover:bg-slate-700/40' : 'bg-red-50/40 dark:bg-red-950/20'}>
                        <td className="px-3 py-2 text-gray-400 font-mono">{r.rowNum}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-slate-300 whitespace-nowrap">
                          {r.dateISO ? new Date(r.dateISO).toLocaleDateString() : r.rawDate || '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-slate-300">{r.category}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            r.type === 'income'
                              ? 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400'
                              : r.type === 'expense'
                              ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {r.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-semibold text-gray-800 dark:text-slate-200 whitespace-nowrap">
                          {typeof r.amount === 'number' ? `${currencySymbol}${r.amount.toFixed(2)}` : String(r.amount || '—')}
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-slate-400 max-w-[140px] truncate">{r.note || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle size={12} /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium" title={r.errors.join(', ')}>
                              <AlertTriangle size={12} /> {r.errors[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={validRows.length === 0 || submitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <Upload size={14} />
              {submitting ? 'Importing…' : `Import ${validRows.length} Valid Transaction${validRows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
