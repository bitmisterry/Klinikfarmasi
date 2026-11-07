const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { medicineName, activeSubstance, strength, form } = body;

    if (!medicineName && !activeSubstance) {
      return Response.json({ error: 'medicineName or activeSubstance required' }, { status: 400 });
    }

    const query = `${activeSubstance || medicineName} ${strength || ''} ${form || ''}`.trim();
    const today = new Date().toISOString().split('T')[0];

    const prompt = `Anda adalah asisten informasi obat klinis. Berdasarkan HANYA sumber farmakologi terpercaya (Medscape, MIMS, Drugs.com), berikan ringkasan informasi obat untuk "${medicineName || activeSubstance}" (${query}).

Berikan output JSON dengan struktur:
{
  "summary": "Ringkasan maksimal 200 kata: indikasi utama, dosis umum dewasa, kontraindikasi penting, efek samping sering, perhatian khusus, kategori kehamilan",
  "sources": [
    {"source": "Medscape", "url": "url_asli", "accessedDate": "${today}"},
    {"source": "Drugs.com", "url": "url_asli", "accessedDate": "${today}"}
  ],
  "disclaimer": "Decision support untuk tenaga kesehatan, bukan keputusan otomatis"
}

PENTING:
- Hanya gunakan informasi dari Medscape, MIMS, atau Drugs.com
- Sertakan URL sumber yang sebenarnya di field url
- Jika tidak menemukan info, nyatakan dengan jelas
- Bahasa Indonesia`;

    const result = await db.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                source: { type: 'string' },
                url: { type: 'string' },
                accessedDate: { type: 'string' }
              }
            }
          },
          disclaimer: { type: 'string' }
        }
      }
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}