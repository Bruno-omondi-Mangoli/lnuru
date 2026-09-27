export function trueCost(principal: number, upfrontFee: number, interestAmount: number, days: number) {
  const net = principal - upfrontFee;
  const totalRepay = principal + interestAmount;
  const cost = totalRepay - net;
  const annualPct = (cost / net) * (365 / days) * 100;
  return {
    net: Math.round(net),
    totalRepay: Math.round(totalRepay),
    cost: Math.round(cost),
    annualPct: Math.round(annualPct),
  };
}

export function mortgagePayment(principal: number, annualRatePct: number, years: number) {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  const monthlyPayment = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalRepay = monthlyPayment * n;
  return {
    monthlyPayment: Math.round(monthlyPayment),
    totalRepay: Math.round(totalRepay),
    totalInterest: Math.round(totalRepay - principal),
  };
}

export function affordability(monthlyRepayment: number, monthlyIncome: number, monthlyExpenditure: number) {
  const disposable = monthlyIncome - monthlyExpenditure;
  if (monthlyIncome <= 0) {
    return { disposable, ratio: null, band: 'unknown' as const, label: 'Add your monthly income to see if you can afford this.' };
  }
  if (disposable <= 0) {
    return { disposable, ratio: null, band: 'high' as const, label: "You have no monthly surplus right now — this repayment would come out of money you don't have spare." };
  }
  const ratio = monthlyRepayment / disposable;
  if (ratio > 0.5) return { disposable, ratio, band: 'high' as const, label: 'This repayment would take up most of what you have left each month. High risk of falling behind.' };
  if (ratio > 0.3) return { disposable, ratio, band: 'moderate' as const, label: 'This repayment takes a significant share of your monthly surplus. Manageable, but leaves little room for surprises.' };
  return { disposable, ratio, band: 'lower' as const, label: 'This repayment fits comfortably within your monthly surplus, based on what you told us.' };
}

// Normalizes a short-term (days-based) repayment burden onto a monthly basis
// so it can be compared against monthly disposable income.
export function monthlyEquivalent(totalRepay: number, days: number) {
  return totalRepay * (30 / days);
}