/* AUTO VIDEO AI V5 - Timeline + Pattern Break Engine */
window.TimelineEngine = (() => {
  let scenes = [];

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  }

  /*
    REGRA CENTRAL DO V5:
    - cada imagem/vídeo permanece entre 2 e 10 segundos;
    - a duração NÃO é fixa;
    - a próxima mudança recebe uma duração variável;
    - o motor evita repetir a mesma mídia em sequência;
    - o Pattern Break pode antecipar a troca quando a cena muda.
  */
  function build({
    visuals,
    totalDuration = 60,
    minChange = 2,
    maxChange = 10,
    mode = "smart",
    avoidRepeat = true,
    patternBreak = true
  }) {
    scenes = [];
    if (!visuals.length || totalDuration <= 0) return scenes;

    minChange = clamp(Number(minChange) || 2, 2, 10);
    maxChange = clamp(Number(maxChange) || 10, minChange, 10);

    let remaining = totalDuration;
    let lastId = null;
    let index = 0;
    let lastType = null;

    while (remaining > 0.05 && scenes.length < 500) {
      const eligible = visuals.filter(v => !avoidRepeat || v.id !== lastId);
      let candidates = eligible.length ? eligible : visuals;

      if (mode === "alternate" && candidates.length > 1) {
        const wanted = lastType === "image" ? "video" : "image";
        const preferred = candidates.filter(v => v.type === wanted);
        if (preferred.length) candidates = preferred;
      }

      // Mistura de seleção sequencial e aleatória para não criar um padrão previsível.
      let selected;
      if (mode === "random") {
        selected = candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        const shuffled = shuffle(candidates);
        selected = shuffled[index % shuffled.length];
      }

      // Duração variável entre 2 e 10 segundos.
      // Se faltar pouco para o fim, a última cena é ajustada sem sair da regra.
      let duration = randomBetween(minChange, maxChange);
      duration = Math.min(duration, remaining);

      // Evita criar uma cena residual menor que 2 s:
      if (remaining > minChange && remaining - duration < minChange) {
        duration = remaining - minChange;
      }

      if (duration < minChange && remaining >= minChange) {
        duration = minChange;
      }

      duration = Math.min(duration, remaining);

      // Pattern Break: a troca continua obrigatória dentro do intervalo configurado,
      // mas algumas mudanças recebem um tratamento visual diferente.
      const breakType = patternBreak ? [
        "cut", "zoom-in", "zoom-out", "pan-left", "pan-right", "crossfade"
      ][Math.floor(Math.random() * 6)] : "cut";

      scenes.push({
        id: `scene-${scenes.length + 1}`,
        mediaId: selected.id,
        mediaUrl: selected.url,
        mediaType: selected.type,
        name: selected.file.name,
        start: totalDuration - remaining,
        duration: Math.max(0.1, duration),
        end: totalDuration - remaining + Math.max(0.1, duration),
        breakType,
        semantic: inferSemantic(selected.file.name)
      });

      remaining -= duration;
      lastId = selected.id;
      lastType = selected.type;
      index++;
    }

    // Corrige qualquer diferença de arredondamento na última cena.
    if (scenes.length) {
      const last = scenes[scenes.length - 1];
      const diff = totalDuration - last.end;
      last.duration += diff;
      last.end = totalDuration;
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
    const visual = Math.round(Math.min(100, unique / scenes.length * 100 + Math.min(20, scenes.length * 2)));

    const breakVariety = new Set(scenes.map(s => s.breakType)).size;
    const breaks = Math.round(Math.min(100, breakVariety * 15 + Math.min(30, scenes.length * 2)));

    let repeats = 0;
    for (let i = 1; i < scenes.length; i++) {
      if (scenes[i].mediaId === scenes[i - 1].mediaId) repeats++;
    }
    const repeat = Math.round(Math.max(0, 100 - (repeats / Math.max(1, scenes.length - 1)) * 100));
    const retention = Math.round(visual * 0.35 + breaks * 0.35 + repeat * 0.30);

    return { visual, breaks, repeat, retention };
  }

  return { build, getScenes, score };
})();
