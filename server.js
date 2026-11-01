require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_PROMPT = `You are an expert web developer that builds webpages and small apps.
Rules:
- Reply with ONE complete, self-contained HTML document and nothing else.
- Put all CSS in a <style> tag and all JavaScript in a <script> tag inside that same file.
- Do not use external files, images, or libraries. Use inline SVG or CSS for visuals.
- Make the page responsive and good-looking on phones.
- When given existing code and a change request, return the full updated document with only the requested changes.
- Never add explanations or markdown. Output only the HTML.`;

// Pull the HTML out if the model wraps it in a ``` code fence.
function extractHtml(text) {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

app.post('/api/generate', async (req, res) => {
  const { prompt, currentCode } = req.body || {};

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY is missing. Add it to your .env file.' });
  }
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Please describe what you want to build.' });
  }

  const userMessage = currentCode
    ? `Current page code:\n\n${currentCode}\n\nRequested change: ${prompt}`
    : prompt;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.error?.message || 'The AI request failed.';
      return res.status(response.status).json({ error: message });
    }

    const text = data.choices?.[0]?.message?.content || '';
    res.json({ code: extractHtml(text) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not reach the AI service. Check your internet connection.' });
  }
});

app.listen(PORT, () => {
  console.log(`AI Builder running at http://localhost:${PORT}`);
});
