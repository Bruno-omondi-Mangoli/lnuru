import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function logAnalysis(dealType: string, riskBand: string) {
  try {
    await supabase.from('analyses').insert({ deal_type: dealType, risk_band: riskBand });
  } catch (err) {
    // Logging is non-critical. Never let a logging failure disrupt the user's result.
    console.error('Supabase logging failed (non-critical):', err);
  }
}

export async function fetchImpactStats() {
  try {
    const { count: total } = await supabase.from('analyses').select('*', { count: 'exact', head: true });
    const { count: highRisk } = await supabase
      .from('analyses')
      .select('*', { count: 'exact', head: true })
      .eq('risk_band', 'high');
    return { total: total ?? 0, highRisk: highRisk ?? 0 };
  } catch (err) {
    console.error('Supabase stats fetch failed:', err);
    return null;
  }
}