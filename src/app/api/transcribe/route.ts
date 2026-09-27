import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ transcript: '', error: 'No audio received' }, { status: 200 });
    }

    const groqForm = new FormData();
    groqForm.append('file', audioFile, 'recording.webm');
    groqForm.append('model', 'whisper-large-v3-turbo');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: groqForm,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq transcription error:', response.status, errText);
      return NextResponse.json({ transcript: '', error: 'Transcription failed' }, { status: 200 });
    }

    const data = await response.json();
    return NextResponse.json({ transcript: data.text || '' });
  } catch (err) {
    console.error('Transcription route error:', err);
    return NextResponse.json({ transcript: '', error: 'Transcription failed' }, { status: 200 });
  }
}