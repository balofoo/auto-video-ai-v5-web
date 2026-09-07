/* AUTO VIDEO AI V5 - Timeline Engine
   REGRA REAL DA MONTAGEM: cada troca de mídia acontece entre 2 e 10 segundos.
*/
window.TimelineEngine = (() => {
  let scenes = [];

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Divide o tempo total em blocos TODOS válidos (2s <= bloco <= 10s).
  // Não existe mais "sobra" final menor que 2s.
  function makeVariableDurations(totalDuration, minChange, maxChange) {
    const total = Number(totalDuration);
    const min = clamp(Number(minChange) || 2, 2, 10);
    const max = clamp(Number(maxChange) || 10, min, 10);

    if (total < min) return [];

    // Quantidade de cenas possível dentro do intervalo configurado.
    const minScenes = Math.ceil(total / max);
    const maxScenes = Math.floor(total / min);
    if (minScenes > maxScenes) return [];

    // Prefere uma quantidade que gere trocas frequentes e durações variadas.
    const ideal = Math.round(total / randomBetween(4.2, 6.8));
    const sceneCount = clamp(ideal, minScenes, maxScenes);

    const durations = [];
    let remaining = total;

    for (let i = 0; i < sceneCount; i++) {
      const slotsLeft = sceneCount - i - 1;
      const lower = Math.max(min, remaining - max * slotsLeft);
      const upper = Math.min(max, remaining - min * slotsLeft);

      let value;
      if (i === sceneCount - 1) {
        value = remaining;
      } else {
        // Tendência central aleatória + pequena variação para não criar um ritmo fixo.
        const center = randomBetween(lower, upper);
        value = center;
      }

      value = clamp(value, lower, upper);
      durations.push(value);
      remaining -= value;
    }

    // Correção numérica final mantendo a regra.
    const diff = total - durations.reduce((a, b) => a + b, 0);
    durations[durations.length - 1] += diff;

    // Pequena embaralhada para evitar sempre a mesma distribuição visual.
    return shuffle(durations).map(v => Number(v.toFixed(3)));
  }

  // Ajusta a duração das cenas para aproveitar pausas detectadas na fala.
  // As pausas são apenas pontos preferenciais; os limites de 2–10s continuam obrigatórios.
  function makeRhythmDurations(totalDuration, min, max, pauses) {
    if (!Array.isArray(pauses) || !pauses.length) return makeVariableDurations(totalDuration, min, max);
    const targets = [0, ...pauses.filter(t => t > 0 && t < totalDuration), totalDuration];
    const chosen = [];
    let cursor = 0;
    while (cursor < totalDuration - 0.001) {
      const candidates = targets.filter(t => t > cursor + min - 0.05 && t <= cursor + max + 0.05);
      if (candidates.length) {
        // Prefere uma pausa real próxima do centro do intervalo, mantendo ritmo variado.
        const ideal = cursor + randomBetween(min + (max-min)*0.30, min + (max-min)*0.72);
        candidates.sort((a,b) => Math.abs(a-ideal)-Math.abs(b-ideal));
        const cut = candidates[0];
        const d = cut - cursor;
        if (d >= min - 0.05 && d <= max + 0.05) {
          chosen.push(Number(d.toFixed(3)));
          cursor = cut;
          continue;
        }
      }
      // Se não há pausa válida, cria um bloco variável normal.
      const remain = totalDuration - cursor;
      if (remain <= max + 0.001) {
        if (remain >= min - 0.001) chosen.push(Number(remain.toFixed(3)));
        break;
      }
      const d = Math.min(max, Math.max(min, randomBetween(min, max)));
      chosen.push(Number(d.toFixed(3)));
      cursor += d;
    }
    const sum = chosen.reduce((a,b)=>a+b,0);
    if (!chosen.length || Math.abs(sum-totalDuration)>0.02) return makeVariableDurations(totalDuration,min,max);
    chosen[chosen.length-1] = Number((chosen[chosen.length-1] + (totalDuration-sum)).toFixed(3));
    if (chosen.some(d=>d<min-0.02 || d>max+0.02)) return makeVariableDurations(totalDuration,min,max);
    return chosen;
  }

  function build({
    visuals,
    totalDuration = 60,
    minChange = 2,
    maxChange = 10,
    mode = "smart",
    avoidRepeat = true,
    patternBreak = true,
    narrationPauses = []
  }) {
    scenes = [];
    if (!visuals.length || totalDuration < 2) return scenes;

    const min = clamp(Number(minChange) || 2, 2, 10);
    const max = clamp(Number(maxChange) || 10, min, 10);
    const durations = makeRhythmDurations(totalDuration, min, max, narrationPauses);

    if (!durations.length) return scenes;

    let lastId = null;
    let lastType = null;
    let cursor = 0;

    durations.forEach((sceneDuration, index) => {
      let eligible = visuals.filter(v => !avoidRepeat || v.id !== lastId);
      if (!eligible.length) eligible = visuals;

      if (mode === "alternate" && eligible.length > 1) {
        const wanted = lastType === "image" ? "video" : "image";
        const preferred = eligible.filter(v => v.type === wanted);
        if (preferred.length) eligible = preferred;
      }

      let candidates = shuffle(eligible);
      let selected;

      if (mode === "random") {
        selected = candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        selected = candidates[index % candidates.length];
      }

      const breakTypes = patternBreak
        ? ["cut", "zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down", "zoom-pan", "crossfade"]
        : ["cut"];
      const breakType = breakTypes[Math.floor(Math.random() * breakTypes.length)];

      const start = cursor;
      const end = index === durations.length - 1
        ? Number(totalDuration)
        : Number((cursor + sceneDuration).toFixed(3));

      scenes.push({
        id: `scene-${index + 1}`,
        mediaId: selected.id,
        mediaUrl: selected.url,
        mediaType: selected.type,
        name: selected.file.name,
        start: Number(start.toFixed(3)),
        duration: Number((end - start).toFixed(3)),
        end: Number(end.toFixed(3)),
        breakType,
        semantic: inferSemantic(selected.file.name),
        rhythmAligned: Array.isArray(narrationPauses) && narrationPauses.length > 0
      });

      cursor = end;
      lastId = selected.id;
      lastType = selected.type;
    });

    // Última garantia: nenhum bloco fora do intervalo.
    const valid = scenes.every((s, i) => {
      const isLast = i === scenes.length - 1;
      return s.duration >= min - 0.001 && s.duration <= max + 0.001 &&
        (isLast ? Math.abs(s.end - totalDuration) < 0.01 : true);
    });

    if (!valid) {
      // Não publica uma timeline inválida.
      scenes = [];
    }

    return scenes;
  }

  function inferSemantic(filename) {
    const text = filename.toLowerCase();
    const map = [
      ["trabalho", "work"], ["worker", "work"], ["fabrica", "work"],
      ["dinheiro", "money"], ["money", "money"], ["riqueza", "wealth"],
      ["feliz", "happy"], ["happy", "happy"], ["triste", "sad"],
      ["sad", "sad"], ["medo", "fear"], ["fear", "fear"],
      ["cidade", "city"], ["natureza", "nature"], ["nature", "nature"],
      ["pessoa", "person"], ["person", "person"], ["negocio", "business"],
      ["business", "business"]
    ];
    for (const [key, value] of map) if (text.includes(key)) return value;
    return "generic";
  }

  function getScenes() { return scenes; }

  function score() {
    if (!scenes.length) return { visual: 0, breaks: 0, repeat: 0, retention: 0 };

    const unique = new Set(scenes.map(s => s.mediaId)).size;
    const visual = Math.round(Math.min(100,
      unique / scenes.length * 100 + Math.min(20, scenes.length * 2)
    ));

    const breakVariety = new Set(scenes.map(s => s.breakType)).size;
    const breaks = Math.round(Math.min(100,
      breakVariety * 15 + Math.min(30, scenes.length * 2)
    ));

    let repeats = 0;
    for (let i = 1; i < scenes.length; i++) {
      if (scenes[i].mediaId === scenes[i - 1].mediaId) repeats++;
    }
    const repeat = Math.round(Math.max(0,
      100 - (repeats / Math.max(1, scenes.length - 1)) * 100
    ));

    const durationVariety = new Set(scenes.map(s => s.duration.toFixed(1))).size;
    const retention = Math.round(
      visual * 0.30 + breaks * 0.25 + repeat * 0.25 +
      Math.min(100, durationVariety * 10) * 0.20
    );

    return { visual, breaks, repeat, retention };
  }

  return { build, getScenes, score, makeVariableDurations };
})();
