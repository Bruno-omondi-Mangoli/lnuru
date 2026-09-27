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

export type Band = 'unknown' | 'high' | 'moderate' | 'lower';

function classifyRatio(disposable: number, repayment: number, income: number): { band: Band; ratio: number | null } {
  if (income <= 0) return { band: 'unknown', ratio: null };
  if (disposable <= 0) return { band: 'high', ratio: null };
  const ratio = repayment / disposable;
  if (ratio > 0.5) return { band: 'high', ratio };
  if (ratio > 0.3) return { band: 'moderate', ratio };
  return { band: 'lower', ratio };
}

// Used for Mortgage: repayment is already a genuine monthly figure.
export function affordability(monthlyRepayment: number, monthlyIncome: number, monthlyExpenditure: number) {
  const disposable = monthlyIncome - monthlyExpenditure;
  const { band, ratio } = classifyRatio(disposable, monthlyRepayment, monthlyIncome);
  const labels: Record<Band, string> = {
    unknown: 'Add your monthly income to see if you can afford this.',
    high:
      disposable <= 0
        ? "You have no monthly surplus right now — this repayment would come out of money you don't have spare."
        : 'This repayment would take up most of what you have left each month. High risk of falling behind.',
    moderate: 'This repayment takes a significant share of your monthly surplus. Manageable, but leaves little room for surprises.',
    lower: 'This repayment fits comfortably within your monthly surplus, based on what you told us.',
  };
  return { disposable, ratio, band, label: labels[band] };
}

// Used for Digital/SACCO/Shylock: gives two honest read-outs instead of one.
// "immediate" asks: can this one repayment be absorbed by a normal month's surplus?
// "recurring" asks: what would this cost if it became a monthly habit (the debt-cycle warning)?
export function shortTermAffordability(
  totalRepay: number,
  days: number,
  monthlyIncome: number,
  monthlyExpenditure: number
) {
  const disposable = monthlyIncome - monthlyExpenditure;

  const immediateClass = classifyRatio(disposable, totalRepay, monthlyIncome);
  const immediateLabels: Record<Band, string> = {
    unknown: 'Add your monthly income to see if you can afford this.',
    high:
      disposable <= 0
        ? "You have no monthly surplus right now — this repayment would come out of money you don't have spare."
        : 'This one repayment alone would use up most of what you have left this month.',
    moderate: 'This one repayment would take a real chunk of what you have left this month, but should be manageable on its own.',
    lower: 'This one repayment fits comfortably within what you have left this month.',
  };

  const monthlyEquivalentRepay = totalRepay * (30 / days);
  const recurringClass = classifyRatio(disposable, monthlyEquivalentRepay, monthlyIncome);
  const recurringLabels: Record<Band, string> = {
    unknown: 'Add your monthly income to see the cost of borrowing like this regularly.',
    high:
      disposable <= 0
        ? "If you kept taking loans like this, the repayments would come out of money you don't have spare each month."
        : 'If you kept taking loans like this every month, it would eat up most of your monthly surplus. This is how short-term borrowing turns into a debt cycle.',
    moderate: 'If you kept borrowing like this every month, it would take a significant share of your monthly surplus.',
    lower: 'Even if you kept borrowing like this every month, it would fit comfortably within your monthly surplus.',
  };

  return {
    immediate: {
      disposable,
      ratio: immediateClass.ratio,
      band: immediateClass.band,
      label: immediateLabels[immediateClass.band],
    },
    recurring: {
      disposable,
      ratio: recurringClass.ratio,
      band: recurringClass.band,
      label: recurringLabels[recurringClass.band],
      monthlyEquivalentRepay: Math.round(monthlyEquivalentRepay),
    },
  };
}