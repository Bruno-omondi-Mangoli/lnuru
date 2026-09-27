import { NextRequest, NextResponse } from 'next/server';
import { buildExplanationPrompt, STATIC_FALLBACK_EXPLANATION } from '@/lib/prompts';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dealType, headline, headlineNumber, detail, affordBand, affordLabel, ratioPct } = body;

  const prompt = buildExplanationPrompt({ dealType, headline, headlineNumber, detail, affordBand, affordLabel, ratioPct });

  // TEMP DEBUG: confirm env vars are actually present in this deployed function
  console.log('DEBUG: GROQ_API_KEY present:', !!process.env.GROQ_API_KEY);
  console.log('DEBUG: GROQ_CHAT_MODEL value:', process.env.GROQ_CHAT_MODEL);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 500,
      }),
    });

    const data = await response.json();

    // TEMP DEBUG: log the full raw response
    console.log('DEBUG: response.status:', response.status);
    console.log('DEBUG: raw Groq response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const text = data.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error('Empty response from Groq');
    }

    return NextResponse.json({ explanation: text, source: 'ai' });
  } catch (err) {
    console.error('Groq explanation failed, using fallback:', err);
    return NextResponse.json({
      explanation: STATIC_FALLBACK_EXPLANATION(dealType),
      source: 'fallback',
    });
  }
}