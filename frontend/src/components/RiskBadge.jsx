import React from 'react';

export default function RiskBadge({ category }) {
  const styles = {
    LOW: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    MEDIUM: 'bg-amber-100 text-amber-800 border-amber-300',
    HIGH: 'bg-rose-100 text-rose-800 border-rose-300'
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase border ${styles[category] || styles.MEDIUM}`}>
      {category || 'MEDIUM'} RISK
    </span>
  );
}