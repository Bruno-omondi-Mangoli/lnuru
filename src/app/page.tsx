'use client';

import { useRef, useState } from 'react';
import { trueCost, mortgagePayment, affordability, shortTermAffordability } from '@/lib/calculators';

type DealType = 'digital' | 'sacco' | 'shylock' | 'mortgage';

const DEAL_LABELS: Record<DealType, string> = {
  digital: 'Digital Loan',
  sacco: 'SACCO Loan',
  shylock: 'Shylock / Informal Lender',
  mortgage: 'Mortgage',
};

function formatKSh(amount: number) {
  return `KSh ${Math.round(amount).toLocaleString('en-KE')}`;
}

type SingleAfford = ReturnType<typeof affordability>;
type DualAfford = ReturnType<typeof shortTermAffordability>;

type Result = {
  headline: string;
  headlineNumber: string;
  detail: string;
  dealType: DealType;
  afford: SingleAfford | DualAfford;
};

function isDual(afford: SingleAfford | DualAfford): afford is DualAfford {
  return 'immediate' in afford;
}

type VoiceState = 'idle' | 'recording' | 'transcribing' | 'extracting';

export default function Home() {
  const [dealType, setDealType] = useState<DealType | null>(null);
  const [step, setStep] = useState<'select' | 'form' | 'result'>('select');

  const [principal, setPrincipal] = useState('');
  const [upfrontFee, setUpfrontFee] = useState('');
  const [interestAmount, setInterestAmount] = useState('');
  const [days, setDays] = useState('30');
  const [collateral, setCollateral] = useState('');

  const [mortgagePrincipal, setMortgagePrincipal] = useState('');
  const [annualRatePct, setAnnualRatePct] = useState('');
  const [years, setYears] = useState('');

  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [monthlyExpenditure, setMonthlyExpenditure] = useState('');

  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  const [explanation, setExplanation] = useState('');
  const [explaining, setExplaining] = useState(false);

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceError, setVoiceError] = useState('');
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function selectDeal(type: DealType) {
    setDealType(type);
    setStep('form');
    setError('');
  }

  function reset() {
    setDealType(null);
    setStep('select');
    setResult(null);
    setError('');
    setExplanation('');
    setExplaining(false);
    setPrincipal('');
    setUpfrontFee('');
    setInterestAmount('');
    setDays('30');
    setCollateral('');
    setMortgagePrincipal('');
    setAnnualRatePct('');
    setYears('');
    setMonthlyIncome('');
    setMonthlyExpenditure('');
    setVoiceState('idle');
    setVoiceError('');
    setTranscript('');
  }

  async function startRecording() {
    setVoiceError('');
    setTranscript('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        await handleRecordingComplete(blob);
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setVoiceState('recording');
    } catch {
      setVoiceError('Could not access your microphone. Please check permissions, or use the form below.');
      setVoiceState('idle');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setVoiceState('transcribing');
  }

  async function handleRecordingComplete(blob: Blob) {
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      const transcribeRes = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const transcribeData = await transcribeRes.json();

      if (!transcribeData.transcript) {
        setVoiceError("We couldn't hear that clearly. Please try again, or fill in the form below.");
        setVoiceState('idle');
        return;
      }

      setTranscript(transcribeData.transcript);
      setVoiceState('extracting');

      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcribeData.transcript }),
      });
      const extractData = await extractRes.json();

      if (extractData.principal == null && extractData.interestAmount == null) {
        setVoiceError("We couldn't find clear loan numbers in what you said. Check the transcript below, then fill in the form manually.");
        setVoiceState('idle');
        return;
      }

      if (extractData.principal != null) setPrincipal(String(extractData.principal));
      if (extractData.upfrontFee != null) setUpfrontFee(String(extractData.upfrontFee));
      if (extractData.interestAmount != null) setInterestAmount(String(extractData.interestAmount));
      if (extractData.days != null) setDays(String(extractData.days));

      setVoiceError('');
      setVoiceState('idle');
    } catch {
      setVoiceError('Something went wrong processing your voice input. Please fill in the form below.');
      setVoiceState('idle');
    }
  }

  async function fetchExplanation(type: DealType, r: Result) {
    setExplaining(true);
    setExplanation('');
    try {
      const afford = r.afford;
      const payload = isDual(afford)
        ? {
            dealType: type,
            headline: r.headline,
            headlineNumber: r.headlineNumber,
            detail: r.detail,
            immediateBand: afford.immediate.band,
            immediateLabel: afford.immediate.label,
            immediateRatioPct: afford.immediate.ratio !== null ? Math.round(afford.immediate.ratio * 100) : null,
            recurringBand: afford.recurring.band,
            recurringLabel: afford.recurring.label,
            recurringRatioPct: afford.recurring.ratio !== null ? Math.round(afford.recurring.ratio * 100) : null,
          }
        : {
            dealType: type,
            headline: r.headline,
            headlineNumber: r.headlineNumber,
            detail: r.detail,
            affordBand: afford.band,
            affordLabel: afford.label,
            ratioPct: afford.ratio !== null ? Math.round(afford.ratio * 100) : null,
          };

      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setExplanation(data.explanation);
    } catch {
      setExplanation(
        'Here are your numbers as calculated above. This information is for your awareness only. The decision is yours.'
      );
    } finally {
      setExplaining(false);
    }
  }

  function compute() {
    setError('');
    const income = parseFloat(monthlyIncome) || 0;
    const expenditure = parseFloat(monthlyExpenditure) || 0;

    if (!dealType) {
      setError('Please select a deal type.');
      return;
    }

    try {
      let r: Result;

      if (dealType === 'mortgage') {
        const p = parseFloat(mortgagePrincipal);
        const rate = parseFloat(annualRatePct);
        const yrs = parseFloat(years);
        if (!p || !rate || !yrs) {
          setError('Please fill in principal, rate, and years.');
          return;
        }
        const m = mortgagePayment(p, rate, yrs);
        const afford = affordability(m.monthlyPayment, income, expenditure);
        r = {
          headline: 'Monthly payment',
          headlineNumber: formatKSh(m.monthlyPayment),
          detail: `Total repayment over ${yrs} years: ${formatKSh(m.totalRepay)}. Total interest: ${formatKSh(
            m.totalInterest
          )}.`,
          dealType: 'mortgage',
          afford,
        };
      } else {
        const p = parseFloat(principal);
        const fee = parseFloat(upfrontFee) || 0;
        const interest = parseFloat(interestAmount);
        const d = parseFloat(days);
        if (!p || !interest || !d) {
          setError('Please fill in principal, interest amount, and days.');
          return;
        }
        const c = trueCost(p, fee, interest, d);
        const afford = shortTermAffordability(c.totalRepay, d, income, expenditure);
        r = {
          headline: 'True annual cost',
          headlineNumber: `${c.annualPct}%`,
          detail: `You'd repay ${formatKSh(c.totalRepay)} in total (cost of ${formatKSh(c.cost)}) over ${d} days.${
            dealType === 'shylock' && collateral ? ` Collateral held: ${collateral}.` : ''
          }`,
          dealType,
          afford,
        };
      }

      setResult(r);
      setStep('result');
      fetchExplanation(dealType, r);
    } catch {
      setError('Something went wrong with the calculation. Please check your numbers.');
    }
  }

  const bandStyles: Record<string, string> = {
    high: 'border-red-500 bg-red-50 text-red-800',
    moderate: 'border-yellow-500 bg-yellow-50 text-yellow-800',
    lower: 'border-green-500 bg-green-50 text-green-800',
    unknown: 'border-gray-400 bg-gray-50 text-gray-700',
  };

  return (
    <main className="min-h-screen bg-blue-50 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-1 text-green-700">Lnuru</h1>
        <p className="text-center text-gray-600 text-sm mb-1">Know the real cost. Know if you can afford it.</p>
        <p className="text-center text-xs text-gray-500 mb-6">
          This gives you information, not financial advice. You decide.
        </p>

        {step === 'select' && (
          <div className="space-y-3">
            {(Object.keys(DEAL_LABELS) as DealType[]).map((type) => (
              <button
                key={type}
                onClick={() => selectDeal(type)}
                className="w-full py-4 rounded-xl bg-white border border-blue-200 shadow-sm font-medium text-left px-4 hover:border-green-500 text-gray-900"
              >
                {DEAL_LABELS[type]}
              </button>
            ))}
          </div>
        )}

        {step === 'form' && dealType && (
          <div className="space-y-4 bg-white p-5 rounded-xl border border-blue-200">
            <h2 className="font-semibold text-lg text-green-700">{DEAL_LABELS[dealType]}</h2>

            {dealType === 'digital' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <p className="text-sm text-gray-700">Speak your loan terms, or fill in the form below manually.</p>
                {voiceState === 'idle' && (
                  <button
                    onClick={startRecording}
                    className="w-full py-2 rounded-lg bg-green-600 text-white text-sm font-medium"
                  >
                    Speak loan terms
                  </button>
                )}
                {voiceState === 'recording' && (
                  <button
                    onClick={stopRecording}
                    className="w-full py-2 rounded-lg bg-red-600 text-white text-sm font-medium animate-pulse"
                  >
                    Recording, tap to stop
                  </button>
                )}
                {voiceState === 'transcribing' && (
                  <p className="text-sm text-gray-500 italic text-center">Transcribing...</p>
                )}
                {voiceState === 'extracting' && (
                  <p className="text-sm text-gray-500 italic text-center">Reading out the numbers...</p>
                )}
                {voiceError && <p className="text-red-600 text-xs">{voiceError}</p>}
                {transcript && (
                  <p className="text-xs text-gray-600 italic">Heard: &ldquo;{transcript}&rdquo;</p>
                )}
                {(principal || interestAmount) && voiceState === 'idle' && (
                  <p className="text-xs text-green-700 font-medium">
                    Numbers filled in below from your voice. Check them before continuing.
                  </p>
                )}
              </div>
            )}

            {dealType === 'mortgage' ? (
              <>
                <Field label="Property / loan principal (KSh)" value={mortgagePrincipal} onChange={setMortgagePrincipal} />
                <Field label="Annual interest rate (%)" value={annualRatePct} onChange={setAnnualRatePct} />
                <Field label="Loan term (years)" value={years} onChange={setYears} />
                <p className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  Lnuru does not verify legal title, property valuation, or lender legitimacy. A decision this size
                  deserves review by a qualified financial or legal advisor.
                </p>
              </>
            ) : (
              <>
                <Field label="Amount borrowed (KSh)" value={principal} onChange={setPrincipal} />
                <Field label="Upfront fee (KSh, if any)" value={upfrontFee} onChange={setUpfrontFee} />
                <Field label="Interest amount (KSh)" value={interestAmount} onChange={setInterestAmount} />
                <Field label="Repayment period (days)" value={days} onChange={setDays} />
                {dealType === 'shylock' && (
                  <Field
                    label="Collateral held (e.g. phone, ID, logbook)"
                    value={collateral}
                    onChange={setCollateral}
                    type="text"
                  />
                )}
              </>
            )}

            <hr className="my-2 border-blue-200" />
            <Field label="Your monthly income (KSh)" value={monthlyIncome} onChange={setMonthlyIncome} />
            <Field label="Your monthly expenditure (KSh)" value={monthlyExpenditure} onChange={setMonthlyExpenditure} />
            <p className="text-xs text-gray-500">
              Your income and expenditure are used only to calculate this result and are not stored.
            </p>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button onClick={reset} className="flex-1 py-2 rounded-lg border border-blue-300 text-gray-700">
                Back
              </button>
              <button onClick={compute} className="flex-1 py-2 rounded-lg bg-green-600 text-white font-medium">
                Check this deal
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-xl border border-blue-200 text-center">
              <p className="text-sm text-gray-600">{result.headline}</p>
              <p className="text-4xl font-extrabold my-2 text-green-700">{result.headlineNumber}</p>
              <p className="text-sm text-gray-700">{result.detail}</p>
            </div>

            {isDual(result.afford) ? (
              <>
                <div className={`p-5 rounded-xl border-2 ${bandStyles[result.afford.immediate.band]}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">This repayment</p>
                  <p className="font-semibold mb-1">
                    {result.afford.immediate.band === 'unknown' ? 'Unknown' : result.afford.immediate.band.toUpperCase()}
                  </p>
                  <p className="text-sm">{result.afford.immediate.label}</p>
                  {result.afford.immediate.ratio !== null && (
                    <p className="text-xs mt-2 opacity-75">
                      Uses about {Math.round(result.afford.immediate.ratio * 100)}% of a normal month's surplus.
                    </p>
                  )}
                </div>

                <div className={`p-5 rounded-xl border-2 ${bandStyles[result.afford.recurring.band]}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">
                    If this became a monthly habit
                  </p>
                  <p className="font-semibold mb-1">
                    {result.afford.recurring.band === 'unknown' ? 'Unknown' : result.afford.recurring.band.toUpperCase()}
                  </p>
                  <p className="text-sm">{result.afford.recurring.label}</p>
                  {result.afford.recurring.ratio !== null && (
                    <p className="text-xs mt-2 opacity-75">
                      Would use about {Math.round(result.afford.recurring.ratio * 100)}% of a normal month's surplus,
                      equivalent to {formatKSh(result.afford.recurring.monthlyEquivalentRepay)} per month.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className={`p-5 rounded-xl border-2 ${bandStyles[result.afford.band]}`}>
                <p className="font-semibold mb-1">
                  Affordability: {result.afford.band === 'unknown' ? 'Unknown' : result.afford.band.toUpperCase()}
                </p>
                <p className="text-sm">{result.afford.label}</p>
                {result.afford.ratio !== null && (
                  <p className="text-xs mt-2 opacity-75">
                    Monthly disposable income: {formatKSh(result.afford.disposable)}. Repayment ratio:{' '}
                    {Math.round(result.afford.ratio * 100)}%
                  </p>
                )}
              </div>
            )}

            <div className="bg-white p-5 rounded-xl border border-blue-200">
              {explaining ? (
                <p className="text-sm text-gray-500 italic">Generating explanation...</p>
              ) : (
                <p className="text-sm text-gray-800">{explanation}</p>
              )}
            </div>

            <button onClick={reset} className="w-full py-2 rounded-lg border border-blue-300 text-gray-700">
              Check another deal
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          Demo data shown is synthetic and for illustration only. Not real financial records.
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'number',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'number' | 'text';
}) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-blue-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
      />
    </div>
  );
}