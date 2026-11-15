// Orígenes que pueden llamar a esta función (tu app)
const PERMITIDOS = (process.env.ALLOWED_ORIGINS || '').split(',');

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (PERMITIDOS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
  if (!PERMITIDOS.includes(origin)) return res.status(403).json({ error: 'Origen no permitido' });

  const { pregunta, ficha } = req.body || {};
  if (!pregunta || !ficha || String(pregunta).length > 300) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }

  const prompt =
    'Eres el asistente de un mapa para astronautas en Marte. Responde en español simple, ' +
    'máximo 3 frases. Usa SOLO los datos de este JSON; si falta algo di "No tengo ese dato". ' +
    'No calcules ni inventes números.\n\nDATOS:\n' + JSON.stringify(ficha) +
    '\n\nPREGUNTA: ' + pregunta;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
      }
    );
    if (!r.ok) return res.status(502).json({ error: 'Gemini falló' }); // la app usa la plantilla
    const data = await r.json();
    const texto = (data?.candidates?.[0]?.content?.parts || [])
    .filter(p => p.text && !p.thought)
    .map(p => p.text)
    .join('')
    .trim();
  if (!texto) return res.status(502).json({ error: 'Respuesta vacía' });
    return res.status(200).json({ texto });
  } catch {
    return res.status(502).json({ error: 'Sin respuesta' });
  }
}
