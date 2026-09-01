function includesAny(text, words) {
  return words.some((w) => text.includes(w));
}

function scoreMessage(text) {
  const t = (text || '').toLowerCase();
  let score = 0;
  const reasons = [];

  const illegal = [
    'droga', 'cocaina', 'eroina', 'fentanyl', 'arma da fuoco', 'bomba',
    'esplosivo', 'omicidio', 'ammazzare', 'uccidere', 'terrorismo',
    'pedofil', 'abuso minore', 'stupro'
  ];
  const hate = ['odio razziale', 'vai a morire', 'ti ammazzo'];
  const toxic = ['idiota', 'stupido', 'cretino', 'vaffanculo', 'pezzo di merda'];
  const fun = ['haha', 'ahah', 'lol', '😂', '🤣', 'bello', 'fantastico', 'grazie', 'wow', '🔥', '❤️', 'festa', 'bravo', 'che figata'];
  const kind = ['per favore', 'scusa', 'buongiorno', 'buonasera', 'congratulazioni', 'forza'];

  if (includesAny(t, illegal)) { score -= 18; reasons.push('contenuto potenzialmente illegale'); }
  if (includesAny(t, hate)) { score -= 14; reasons.push('attacco alle persone'); }
  if (includesAny(t, toxic)) { score -= 6; reasons.push('tono aggressivo'); }
  const funHits = fun.filter((w) => t.includes(w)).length;
  if (funHits) { score += Math.min(10, funHits * 3); reasons.push('energia positiva'); }
  if (includesAny(t, kind)) { score += 4; reasons.push('cortesia'); }

  const len = (text || '').trim().length;
  if (len > 20 && len < 280) score += 2;
  if (/youtube\.com|youtu\.be/.test(t)) { score += 3; reasons.push('condivisione video'); }

  score = Math.max(-20, Math.min(20, score));
  if (!reasons.length) reasons.push(score >= 0 ? 'messaggio neutrale-positivo' : 'messaggio freddo');

  let label = 'neutro';
  if (score >= 8) label = 'godimento alto';
  else if (score >= 3) label = 'piacevole';
  else if (score <= -10) label = 'violazione / tossico';
  else if (score < 0) label = 'poco godibile';

  return { score, label, comment: `IA · ${label} · ${[...new Set(reasons)].join(', ')}` };
}

function youtubeId(text) {
  const m = (text || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

module.exports = { scoreMessage, youtubeId };
