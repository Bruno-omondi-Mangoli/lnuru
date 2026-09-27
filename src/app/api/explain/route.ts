import { NextRequest, NextResponse } from 'next/server';
import {
  buildMortgageExplanationPrompt,
  buildLoanExplanationPrompt,
  STATIC_FALLBACK_EXPLANATION,
} from '@/lib/prompts';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dealType, headline, headlineNumber, detail } = body;

  const prompt =
    dealType === 'mortgage'
      ? buildMortgageExplanationPrompt({
          headline,
          headlineNumber,
          detail,
          affordBand: body.affordBand,
          affordLabel: body.affordLabel,
          ratioPct: body.ratioPct,
        })
      : buildLoanExplanationPrompt({
          dealType,
          headlineNumber,
          detail,
          immediateBand: body.immediateBand,
          immediateLabel: body.immediateLabel,
          immediateRatioPct: body.immediateRatioPct,
          recurringBand: body.recurringBand,
          recurringLabel: body.recurringLabel,
          recurringRatioPct: body.recurringRatioPct,
        });

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
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();

    // TEMP DEBUG: see why the response ended (length = truncated, stop = finished normally)
    console.log('DEBUG: finish_reason:', data.choices?.[0]?.finish_reason);
    console.log('DEBUG: completion_tokens used:', data.usage?.completion_tokens);

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