import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

// 🎨 Harmonized Coffee Color Palette
const coffeeColors = {
  "Americano": "#6F4E37",            // deep espresso brown
  "Americano with Milk": "#A67B5B",  // warm latte tone
  "Cappuccino": "#C4A484",           // beige cappuccino foam
  "Cocoa": "#D2691E",                // chocolate
  "Cortado": "#C68642",              // caramel gold
  "Espresso": "#3E2723",             // darkest roast
  "Hot Chocolate": "#8B4513",        // rich cocoa
  "Latte": "#EED8AE"                 // light milky beige
};


function formatMoney(n) {
  if (!isFinite(n)) return '$0';
  return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function CoffeeDashboard() {
  const [raw, setRaw] = useState([]);
  const [coffee, setCoffee] = useState('All');
  const [minMonth, setMinMonth] = useState(1);
  const [maxMonth, setMaxMonth] = useState(12);

  // load excel
  useEffect(() => {
    fetch('/Coffee_Sales_Cleaned.xlsx')
      .then((r) => r.arrayBuffer())
      .then((ab) => {
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws);
        setRaw(json);
      })
      .catch((e) => console.error('Excel load error', e));
  }, []);

  // normalize + filter
const data = useMemo(() => {
  return raw.map((d) => {
    const get = (keys) =>
      keys.map((k) => d[k]).find((v) => v !== undefined && v !== null) || '';

    const salesRaw = get(['Sales_amount', 'sales_amount', 'Sales Amount']);
    const sales = parseFloat(salesRaw.toString().replace(/[$,\\s]/g, '')) || 0;
    const Monthsort = Number(get(['Monthsort', 'Month Sort', 'monthsort', 'Month']));
    const coffee_name = get(['coffee_name', 'Coffee Name', 'coffee']);
    const transaction_id = get(['transaction_id', 'Transaction ID', 'transactio_id', 'id']);
    const Time_of_Day = get(['Time_of_Day', 'Time of Day', 'time_of_day', 'Time']);
    return { sales, Monthsort, coffee_name, transaction_id, Time_of_Day };
  });
}, [raw]);


  const coffeeOptions = useMemo(() => {
    const set = new Set(data.map(d => d.coffee_name).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter(d => {
      const coffeeOk = coffee === 'All' || d.coffee_name === coffee;
      const monthOk = d.Monthsort >= minMonth && d.Monthsort <= maxMonth;
      return coffeeOk && monthOk;
    });
  }, [data, coffee, minMonth, maxMonth]);

  // KPIs
  const totalSales = useMemo(() => filtered.reduce((s, d) => s + d.sales, 0), [filtered]);
  const totalTransactions = useMemo(() => new Set(filtered.map(d => d.transaction_id)).size, [filtered]);
  const avgValue = totalTransactions ? totalSales / totalTransactions : 0;

  // Sales by Time of Day
  const timeSlots = ['Morning', 'Afternoon', 'Night'];
  const salesByTime = useMemo(() => {
    return timeSlots.map(slot => {
      const slotSales = filtered.filter(d => d.Time_of_Day === slot).reduce((s, d) => s + d.sales, 0);
      return { Time_of_Day: slot, Sales: Number(slotSales.toFixed(2)) };
    });
  }, [filtered]);

  const peakTime = useMemo(() => {
    const sorted = [...salesByTime].sort((a,b) => b.Sales - a.Sales);
    return sorted[0]?.Time_of_Day || '-';
  }, [salesByTime]);

  // Top 3 overall
  const top3Overall = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      map.set(r.coffee_name, (map.get(r.coffee_name) || 0) + r.sales);
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total: Number(total.toFixed(2)) }))
      .sort((a,b) => b.total - a.total)
      .slice(0,3);
  }, [filtered]);

  // Top 3 per time slot (for 3 mini charts)
  const top3BySlot = useMemo(() => {
    const res = {};
    for (const slot of timeSlots) {
      const map = new Map();
      for (const r of filtered.filter(d => d.Time_of_Day === slot)) {
        map.set(r.coffee_name, (map.get(r.coffee_name) || 0) + r.sales);
      }
      const arr = Array.from(map.entries())
        .map(([name, total]) => ({ name, total: Number(total.toFixed(2)) }))
        .sort((a,b) => b.total - a.total)
        .slice(0,3);
      res[slot] = arr;
    }
    return res;
  }, [filtered]);

  return (
    <div className="p-6 min-h-screen space-y-6">
      <h1 className="text-3xl font-bold text-amber-900">Coffee Behavior Clustering</h1>

      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card"><div className="text-sm opacity-70">Total Sales</div><div className="kpi">{formatMoney(totalSales)}</div></div>
        <div className="card"><div className="text-sm opacity-70">Total Transactions</div><div className="kpi">{totalTransactions}</div></div>
        <div className="card"><div className="text-sm opacity-70">Avg Sales Value</div><div className="kpi">{formatMoney(avgValue)}</div></div>
        <div className="card"><div className="text-sm opacity-70">Peak Time of Day</div><div className="kpi">{peakTime}</div></div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
          {/* Coffee */}
          <div className="flex flex-col gap-2 items-start w-full md:w-1/3">
            <label className="text-sm font-medium">Coffee Name</label>
            <select
              className="border rounded-xl p-2 w-full"
              value={coffee}
              onChange={(e)=>setCoffee(e.target.value)}
            >
              {coffeeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          {/* Month range */}
          <div className="flex flex-col gap-3 w-full md:w-2/3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Month Range</span>
              <span className="text-sm">From <b>{minMonth}</b> to <b>{maxMonth}</b></span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs w-20">Start</label>
                <input type="range" min="1" max="12" step="1" value={minMonth}
                  onChange={(e)=> setMinMonth(Math.min(Number(e.target.value), maxMonth))}
                  className="w-full"/>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs w-20">End</label>
                <input type="range" min="1" max="12" step="1" value={maxMonth}
                  onChange={(e)=> setMaxMonth(Math.max(Number(e.target.value), minMonth))}
                  className="w-full"/>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sales by Time of Day */}
      <div className="card">
        <h2 className="text-xl mb-2">Sales by Time of Day</h2>
        <div style={{ width: '100%', height: 320 }}>
<ResponsiveContainer width="100%" height={320}>
  <BarChart data={salesByTime} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
    <XAxis dataKey="Time_of_Day" />
    <YAxis />
    <Tooltip />
    <Legend />

    {Object.keys(salesByTime[0] || {})
      .filter((key) => key !== "Time_of_Day")
      .map((key) => (
        <Bar
          key={key}
          dataKey={key}
          fill={coffeeColors[key] || "#C4A484"}
          radius={[8, 8, 0, 0]}
        />
      ))}
  </BarChart>
</ResponsiveContainer>

        </div>
      </div>

      {/* Top 3 Overall + Tables per slot */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-lg mb-2">Top 3 Coffee Sales (Filtered)</h2>
          <table className="table">
            <thead><tr><th>Coffee Name</th><th>Total Sales</th></tr></thead>
            <tbody>
              {top3Overall.map((r, i) => (
                <tr key={i}><td>{r.name}</td><td>{formatMoney(r.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2 className="text-lg mb-4">Time-of-Day Metrics</h2>
          <table className="table">
            <thead><tr><th>Time of Day</th><th>Sales</th><th>Transactions</th><th>Avg / Txn</th></tr></thead>
            <tbody>
              {['Morning','Afternoon','Night'].map(slot => {
                const slotRows = filtered.filter(d => d.Time_of_Day === slot);
                const s = slotRows.reduce((a,b)=>a+b.sales, 0);
                const t = new Set(slotRows.map(d=>d.transaction_id)).size;
                const avg = t? s/t : 0;
                return <tr key={slot}><td>{slot}</td><td>{formatMoney(s)}</td><td>{t}</td><td>{formatMoney(avg)}</td></tr>
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Three small charts: top 3 per time slot */}
      <div className="grid md:grid-cols-3 gap-4">
        {timeSlots.map(slot => (
          <div key={slot} className="card">
            <h3 className="mb-2">{slot}: Top 3 Best Sellers</h3>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={top3BySlot[slot]}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                    {top3BySlot[slot].map((entry, index) => (
                      <Cell
                        key={`cell-${slot}-${index}`}
                        fill={coffeeColors[entry.name] || "#C4A484"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      <footer className="text-xs opacity-60 pt-4">All visuals react to filters in real time.</footer>
    </div>
  );
}