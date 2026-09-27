import { NextRequest, NextResponse } from 'next/server';
import { buildExtractionPrompt } from '@/lib/prompts';

export async function POST(req: NextRequest) {
  const { transcript } = await req.json();

  if (!transcript || typeof transcript !== 'string') {
    return NextResponse.json({ principal: null, upfrontFee: null, interestAmount: null, days: null, error: 'No transcript' });
  }

  const prompt = buildExtractionPrompt(transcript);

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
        temperature: 0,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';

    // Strip markdown code fences if the model added them despite instructions
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Extraction JSON parse failed. Raw output:', raw);
      return NextResponse.json({ principal: null, upfrontFee: null, interestAmount: null, days: null, error: 'Parse failed' });
    }

    return NextResponse.json({
      principal: typeof parsed.principal === 'number' ? parsed.principal : null,
      upfrontFee: typeof parsed.upfrontFee === 'number' ? parsed.upfrontFee : null,
      interestAmount: typeof parsed.interestAmount === 'number' ? parsed.interestAmount : null,
      days: typeof parsed.days === 'number' ? parsed.days : null,
    });
  } catch (err) {
    console.error('Extraction failed:', err);
    return NextResponse.json({ principal: null, upfrontFee: null, interestAmount: null, days: null, error: 'Extraction failed' });
  }
}