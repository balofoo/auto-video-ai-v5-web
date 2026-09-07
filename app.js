/* AUTO VIDEO AI V5 - Main Application */
(() => {
  const $ = id => document.getElementById(id);

  const audioInput = $("audioInput");
  const imageInput = $("imageInput");
  const videoInput = $("videoInput");
  const musicInput = $("musicInput");
  const autoEditBtn = $("autoEditBtn");
  const saveProjectBtn = $("saveProjectBtn");
  const downloadVideoBtn = $("downloadVideoBtn");
  const preview = $("preview");
  const formatSelect = $("formatSelect");
  const minChange = $("minChange");
  const maxChange = $("maxChange");
  const changeMode = $("changeMode");
  const avoidRepeat = $("avoidRepeat");
  const patternBreak = $("patternBreak");
  const captionsEnabled = $("captionsEnabled");
  const captionStyle = $("captionStyle");
  const transcriptInput = $("transcriptInput");
  const generateCaptionsBtn = $("generateCaptionsBtn");
  const captionInfo = $("captionInfo");
  const autoTranscribeBtn = $("autoTranscribeBtn");
  const transcribeInfo = $("transcribeInfo");
  const timeline = $("timeline");
  const timelineInfo = $("timelineInfo");
  const previewStatus = $("previewStatus");
  const seekBar = $("seekBar");
  const currentTime = $("currentTime");
  const totalTime = $("totalTime");

  let scenes = [];
  let duration = 60;
  let playing = false;
  let timer = null;
  let currentSceneIndex = 0;
  let elapsed = 0;
  let narrationPlayer = null;
  let musicPlayer = null;
  let captions = [];

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2200);
  }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function renderMediaLists() {
    MediaEngine.renderList($("imageList"), MediaEngine.state.images);
    MediaEngine.renderList($("videoList"), MediaEngine.state.videos);
    $("audioInfo").textContent = MediaEngine.state.audio
      ? MediaEngine.state.audio.file.name : "Nenhum áudio selecionado";
    $("musicInfo").textContent = MediaEngine.state.music
      ? MediaEngine.state.music.file.name : "Nenhuma música selecionada";
  }

  function detectAudioDuration(file) {
    return new Promise(resolve => {
      if (!file) return resolve(60);
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const d = Number.isFinite(audio.duration) ? audio.duration : 60;
        URL.revokeObjectURL(audio.src);
        resolve(d);
      };
      audio.onerror = () => resolve(60);
      audio.src = URL.createObjectURL(file);
    });
  }

  // V5.2: detecta pausas/respirações da narração no próprio navegador.
  // Não envia o áudio para nenhum servidor.
  async function detectNarrationRhythm(file) {
    if (!file) return [];
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      const channel = buffer.getChannelData(0);
      const sampleRate = buffer.sampleRate;
      const frameSize = Math.max(256, Math.floor(sampleRate * 0.04));
      const hop = Math.max(128, Math.floor(frameSize * 0.5));
      const rms = [];
      for (let i = 0; i + frameSize < channel.length; i += hop) {
        let sum = 0;
        for (let j = 0; j < frameSize; j++) sum += channel[i + j] * channel[i + j];
        rms.push(Math.sqrt(sum / frameSize));
      }
      const sorted = [...rms].sort((a,b)=>a-b);
      const floor = sorted[Math.floor(sorted.length * 0.18)] || 0.002;
      const threshold = Math.max(0.006, floor * 2.2);
      const pauses = [];
      let quietStart = null;
      const minQuietFrames = Math.max(3, Math.floor(0.32 * sampleRate / hop));
      let quietFrames = 0;
      for (let i = 0; i < rms.length; i++) {
        if (rms[i] < threshold) {
          if (quietStart === null) quietStart = i;
          quietFrames++;
        } else {
          if (quietStart !== null && quietFrames >= minQuietFrames) {
            const t = ((quietStart + Math.floor(quietFrames / 2)) * hop) / sampleRate;
            if (t > 1.0 && t < duration - 0.6) pauses.push(Number(t.toFixed(2)));
          }
          quietStart = null;
          quietFrames = 0;
        }
      }
      await ctx.close();
      // Remove pausas muito próximas para não gerar cortes nervosos.
      return pauses.filter((t,i,a) => i === 0 || t - a[i-1] >= 1.5).slice(0, 120);
    } catch (e) {
      console.warn('V5.2: análise de ritmo indisponível', e);
      return [];
    }
  }

  async function handleAudio() {
    const file = audioInput.files[0];
    if (!file) return;
    MediaEngine.setAudio(file);
    if (narrationPlayer) narrationPlayer.pause();
    narrationPlayer = new Audio(MediaEngine.state.audio.url);
    narrationPlayer.preload = "auto";
    narrationPlayer.volume = 1;
    duration = await detectAudioDuration(file);
    totalTime.textContent = fmt(duration);
    previewStatus.textContent = "Analisando ritmo da narração...";
    window.av5NarrationPauses = await detectNarrationRhythm(file);
    renderMediaLists();
    toast(`Narração carregada: ${fmt(duration)}`);
  }

  function handleImages() {
    MediaEngine.addFiles(imageInput.files, "image");
    renderMediaLists();
    toast(`${imageInput.files.length} imagem(ns) adicionada(s)`);
  }

  function handleVideos() {
    MediaEngine.addFiles(videoInput.files, "video");
    renderMediaLists();
    toast(`${videoInput.files.length} vídeo(s) adicionado(s)`);
  }

  function handleMusic() {
    const file = musicInput.files[0];
    if (!file) return;
    MediaEngine.setMusic(file);
    if (musicPlayer) musicPlayer.pause();
    musicPlayer = new Audio(MediaEngine.state.music.url);
    musicPlayer.preload = "auto";
    musicPlayer.loop = true;
    musicPlayer.volume = 0.22;
    renderMediaLists();
    toast("Música adicionada");
  }

  function updateFormat() {
    preview.classList.remove("ratio-16-9", "ratio-9-16", "ratio-1-1");
    preview.classList.add(
      formatSelect.value === "9:16" ? "ratio-9-16" :
      formatSelect.value === "1:1" ? "ratio-1-1" : "ratio-16-9"
    );
  }

  function renderTimeline() {
    // A timeline exibida aqui é a mesma timeline usada pelo player.
    // Cada cena carrega sua duração real, e o player troca a mídia no instante de end.

    timeline.innerHTML = "";
    $("timelineScale").innerHTML = "";

    scenes.forEach((scene, i) => {
      const el = document.createElement("div");
      el.className = "scene" + (["zoom-in", "zoom-out", "crossfade"].includes(scene.breakType) ? " break" : "");
      el.style.width = `${Math.max(90, scene.duration * 45)}px`;

      if (scene.mediaType === "image") {
        const img = document.createElement("img");
        img.src = scene.mediaUrl;
        img.alt = scene.name;
        el.appendChild(img);
      } else {
        const video = document.createElement("video");
        video.src = scene.mediaUrl;
        video.muted = true;
        video.preload = "metadata";
        el.appendChild(video);
      }

      const dur = document.createElement("div");
      dur.className = "duration";
      dur.textContent = `${scene.duration.toFixed(1)}s`;
      el.appendChild(dur);

      const label = document.createElement("div");
      label.className = "scene-label";
      label.textContent = `${i + 1}. ${scene.breakType}`;
      el.appendChild(label);

      el.title = `${scene.name}\n${scene.duration.toFixed(1)}s\nMudança: ${scene.breakType}`;
      el.onclick = () => {
        elapsed = scene.start;
        currentSceneIndex = i;
        showScene(i);
      };

      timeline.appendChild(el);
    });

    const minActual = scenes.length ? Math.min(...scenes.map(s => s.duration)) : 0;
    const maxActual = scenes.length ? Math.max(...scenes.map(s => s.duration)) : 0;
    const avgActual = scenes.length
      ? scenes.reduce((sum, s) => sum + s.duration, 0) / scenes.length
      : 0;
    timelineInfo.textContent = scenes.length
      ? `${scenes.length} cenas • duração real: ${minActual.toFixed(1)}–${maxActual.toFixed(1)}s • média ${avgActual.toFixed(1)}s`
      : "0 cenas";

    for (let t = 0; t <= duration; t += Math.max(1, duration / 10)) {
      const mark = document.createElement("span");
      mark.textContent = fmt(t);
      mark.style.left = `${(t / duration) * 100}%`;
      $("timelineScale").appendChild(mark);
    }

    const scores = TimelineEngine.score();
    $("visualScore").textContent = scores.visual;
    $("breakScore").textContent = scores.breaks;
    $("repeatScore").textContent = scores.repeat;
    $("retentionScore").textContent = scores.retention;
  }

  function cleanCaptionText(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  // V5.3.1: sincronização baseada no áudio.
  // A transcrição é dividida em blocos curtos e o tempo de cada bloco é
  // calculado pelo número de palavras, usando as pausas reais detectadas
  // na narração como pontos de ajuste. Assim a legenda acompanha a fala,
  // em vez de simplesmente seguir as trocas de imagem.
  function buildCaptionsFromTranscript() {
    const text = cleanCaptionText(transcriptInput.value || "");
    if (!text) {
      captions = [];
      captionInfo.textContent = "Cole a transcrição para gerar legendas sincronizadas.";
      return false;
    }

    const sentences = text.match(/[^.!?…]+[.!?…]?/g)?.map(cleanCaptionText).filter(Boolean) || [text];
    const blocks = [];
    sentences.forEach(sentence => {
      const words = sentence.split(/\s+/).filter(Boolean);
      // Legendas curtas facilitam leitura e acompanham melhor a fala.
      for (let i = 0; i < words.length; i += 8) {
        blocks.push(words.slice(i, i + 8).join(" "));
      }
    });
    if (!blocks.length || duration <= 0) return false;

    const pauses = (window.av5NarrationPauses || [])
      .filter(t => Number.isFinite(t) && t > 0.1 && t < duration - 0.1)
      .sort((a,b) => a-b);

    const totalWords = blocks.reduce((sum, b) => sum + b.split(/\s+/).length, 0);
    const targetWordsPerSecond = totalWords / duration;
    let cursor = 0;
    const result = [];

    blocks.forEach((block, i) => {
      const wordCount = block.split(/\s+/).length;
      const rawLength = Math.max(1.0, wordCount / Math.max(0.8, targetWordsPerSecond));
      let end = Math.min(duration, cursor + rawLength);

      // Se houver uma pausa próxima, encaixa a saída da legenda nela.
      const nearbyPause = pauses.find(p => p > cursor + 0.45 && p <= Math.min(duration, cursor + rawLength + 0.9));
      if (nearbyPause) end = nearbyPause;

      // Evita blocos excessivamente longos ou curtos.
      end = Math.min(duration, Math.max(cursor + 0.9, end));
      if (i === blocks.length - 1) end = duration;

      result.push({
        text: block,
        start: Number(cursor.toFixed(3)),
        end: Number(end.toFixed(3))
      });
      cursor = end;
    });

    // Distribuição de erro: garante cobertura até o final sem sobreposição.
    if (result.length) {
      const scale = duration / Math.max(duration, result[result.length - 1].end);
      if (scale !== 1) {
        result.forEach(c => {
          c.start = Number((c.start * scale).toFixed(3));
          c.end = Number((c.end * scale).toFixed(3));
        });
      }
      result[result.length - 1].end = Number(duration.toFixed(3));
    }

    captions = result.filter(c => c.end > c.start + 0.05);
    captionInfo.textContent = `${captions.length} legenda(s) sincronizada(s) com a narração`;
    return captions.length > 0;
  }

  let whisperPipeline = null;

  async function getWhisperPipeline() {
    if (whisperPipeline) return whisperPipeline;
    transcribeInfo.textContent = "Carregando o Whisper no navegador... na primeira vez pode demorar.";
    autoTranscribeBtn.disabled = true;
    try {
      const mod = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/+esm");
      if (mod.env) {
        mod.env.allowRemoteModels = true;
        mod.env.allowLocalModels = false;
      }
      whisperPipeline = await mod.pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
        device: "wasm",
        dtype: "q8"
      });
      transcribeInfo.textContent = "Whisper carregado. A transcrição será processada localmente no navegador.";
      return whisperPipeline;
    } finally {
      autoTranscribeBtn.disabled = false;
    }
  }

  async function decodeMono16k(file) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
    const targetRate = 16000;
    const targetLength = Math.ceil(decoded.duration * targetRate);
    const offline = new OfflineAudioContext(1, targetLength, targetRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    await ctx.close();
    return rendered.getChannelData(0);
  }

  function captionsFromWhisper(chunks, totalDuration) {
    const out = [];
    for (const chunk of (chunks || [])) {
      if (!chunk || !Array.isArray(chunk.timestamp)) continue;
      let start = Number(chunk.timestamp[0]);
      let end = Number(chunk.timestamp[1]);
      const text = cleanCaptionText(chunk.text || "");
      if (!text || !Number.isFinite(start)) continue;
      if (!Number.isFinite(end) || end <= start) end = Math.min(totalDuration, start + 2.5);
      start = Math.max(0, start);
      end = Math.min(totalDuration, Math.max(start + 0.15, end));
      out.push({ text, start:Number(start.toFixed(3)), end:Number(end.toFixed(3)) });
    }
    return out.filter(c => c.end > c.start).sort((a,b)=>a.start-b.start);
  }

  async function autoTranscribe() {
    const file = MediaEngine.state.audio?.file;
    if (!file) {
      toast("Adicione a narração primeiro.");
      return;
    }
    autoTranscribeBtn.disabled = true;
    transcribeInfo.textContent = "Preparando o áudio para o Whisper...";
    try {
      const audio = await decodeMono16k(file);
      const transcriber = await getWhisperPipeline();
      transcribeInfo.textContent = "Transcrevendo... isso pode levar algum tempo em computadores mais lentos.";
      const result = await transcriber(audio, {
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
        language: "portuguese",
        task: "transcribe"
      });
      const text = cleanCaptionText(result?.text || "");
      transcriptInput.value = text;
      const whisperCaps = captionsFromWhisper(result?.chunks, duration);
      if (whisperCaps.length) {
        captions = whisperCaps;
        captionsEnabled.checked = true;
        captionInfo.textContent = `${captions.length} legenda(s) gerada(s) pelo Whisper com timestamps reais`;
        renderCaption(elapsed);
        toast("Transcrição automática concluída e legendas sincronizadas");
      } else if (text) {
        captionsEnabled.checked = true;
        buildCaptionsFromTranscript();
        renderCaption(elapsed);
        toast("Transcrição concluída; sincronização aproximada aplicada");
      } else {
        throw new Error("O Whisper não retornou texto.");
      }
      transcribeInfo.textContent = "Pronto. A transcrição e os timestamps foram gerados no navegador.";
    } catch (e) {
      console.error("V5.4 Whisper", e);
      transcribeInfo.textContent = "Não foi possível transcrever automaticamente. Verifique a conexão para carregar o modelo e tente novamente.";
      toast("Falha na transcrição automática");
    } finally {
      autoTranscribeBtn.disabled = false;
    }
  }

  function currentCaption(time) {
    return captions.find(c => time >= c.start && time < c.end) || null;
  }

  function renderCaption(time) {
    const old = preview.querySelector(".caption-overlay");
    if (old) old.remove();
    if (!captionsEnabled.checked) return;
    const cap = currentCaption(time);
    if (!cap) return;
    const wrap = document.createElement("div");
    wrap.className = `caption-overlay ${captionStyle.value || "clean"}`;
    const text = document.createElement("div");
    text.className = "caption-text";
    text.textContent = cap.text;
    wrap.appendChild(text);
    preview.appendChild(wrap);
  }

  function showScene(index) {
    if (!scenes.length || index < 0 || index >= scenes.length) return;
    const scene = scenes[index];
    preview.innerHTML = "";

    preview.classList.remove("effect-zoom-in", "effect-zoom-out", "effect-crossfade", "effect-pan-left", "effect-pan-right", "effect-pan-up", "effect-pan-down", "effect-zoom-pan", "effect-cut");
    preview.classList.add(`effect-${scene.breakType}`);
    preview.style.setProperty("--scene-duration", `${Math.max(2, scene.duration)}s`);

    if (scene.mediaType === "image") {
      const img = document.createElement("img");
      img.src = scene.mediaUrl;
      img.alt = scene.name;
      img.className = "scene-media animated-media";
      preview.appendChild(img);
    } else {
      const video = document.createElement("video");
      video.src = scene.mediaUrl;
      video.muted = true;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.className = "scene-media animated-media";
      preview.appendChild(video);
      video.play().catch(() => {});
    }

    previewStatus.textContent = `${scene.name} • ${scene.breakType} • ${scene.duration.toFixed(1)}s`;
    renderCaption(elapsed);
  }

  function findSceneAt(time) {
    return scenes.findIndex(s => time >= s.start && time < s.end);
  }

  function syncAudio() {
    if (narrationPlayer) {
      const target = Math.min(elapsed, Number.isFinite(narrationPlayer.duration) ? narrationPlayer.duration : elapsed);
      if (Math.abs(narrationPlayer.currentTime - target) > 0.35) narrationPlayer.currentTime = target;
    }
    if (musicPlayer && Number.isFinite(musicPlayer.duration) && musicPlayer.duration > 0) {
      const target = elapsed % musicPlayer.duration;
      if (Math.abs(musicPlayer.currentTime - target) > 0.5) musicPlayer.currentTime = target;
    }
  }

  function tick() {
    if (!playing || !scenes.length) return;
    elapsed = Math.min(duration, elapsed + 0.1);
    syncAudio();

    if (elapsed >= duration) {
      elapsed = duration;
      playing = false;
      clearInterval(timer);
      $("playBtn").textContent = "▶";
    }

    const idx = Math.max(0, Math.min(scenes.length - 1, findSceneAt(elapsed)));
    if (idx !== currentSceneIndex) {
      currentSceneIndex = idx;
      showScene(idx);
    } else {
      renderCaption(elapsed);
    }

    seekBar.value = duration ? (elapsed / duration) * 100 : 0;
    currentTime.textContent = fmt(elapsed);
  }

  function play() {
    if (!scenes.length) {
      toast("Faça a montagem automática primeiro.");
      return;
    }
    playing = true;
    $("playBtn").textContent = "⏸";
    syncAudio();
    if (narrationPlayer) narrationPlayer.play().catch(() => {});
    if (musicPlayer) musicPlayer.play().catch(() => {});
    clearInterval(timer);
    timer = setInterval(tick, 100);
  }

  function pause() {
    playing = false;
    clearInterval(timer);
    if (narrationPlayer) narrationPlayer.pause();
    if (musicPlayer) musicPlayer.pause();
    $("playBtn").textContent = "▶";
  }

  function stop() {
    pause();
    elapsed = 0;
    currentSceneIndex = 0;
    seekBar.value = 0;
    currentTime.textContent = "00:00";
    if (narrationPlayer) narrationPlayer.currentTime = 0;
    if (musicPlayer) musicPlayer.currentTime = 0;
    if (scenes.length) showScene(0);
  }

  function seek(value) {
    elapsed = (Number(value) / 100) * duration;
    currentSceneIndex = Math.max(0, findSceneAt(elapsed));
    currentTime.textContent = fmt(elapsed);
    syncAudio();
    if (scenes.length) showScene(currentSceneIndex);
  }

  async function autoEdit() {
    const visuals = MediaEngine.getAllVisuals();
    if (!visuals.length) {
      toast("Adicione pelo menos uma imagem ou vídeo.");
      return;
    }

    const min = Math.max(2, Math.min(10, Number(minChange.value) || 2));
    const max = Math.max(min, Math.min(10, Number(maxChange.value) || 10));

    minChange.value = min;
    maxChange.value = max;

    previewStatus.textContent = "Construindo montagem variável de 2–10s...";

    // Garante que o algoritmo respeite o intervalo de 2–10 segundos.
    scenes = TimelineEngine.build({
      visuals,
      totalDuration: Math.max(2, duration),
      minChange: min,
      maxChange: max,
      mode: changeMode.value,
      avoidRepeat: avoidRepeat.checked,
      patternBreak: patternBreak.checked,
      narrationPauses: window.av5NarrationPauses || []
    });

    if (!scenes.length) {
      toast("Não foi possível montar uma timeline válida. Use duração mínima de 2s e máxima de 10s.");
      previewStatus.textContent = "Erro na montagem";
      return;
    }

    currentSceneIndex = 0;
    elapsed = 0;
    renderTimeline();
    showScene(0);
    if (captionsEnabled.checked) buildCaptionsFromTranscript();
    else { captions = []; captionInfo.textContent = "Legendas desligadas"; }
    renderCaption(0);

    const actualMin = Math.min(...scenes.map(s => s.duration));
    const actualMax = Math.max(...scenes.map(s => s.duration));
    toast(`Montagem criada: ${scenes.length} cenas, mudanças reais de ${actualMin.toFixed(1)}s a ${actualMax.toFixed(1)}s.`);
  }

  function makeExportOverlay(text) {
    const el = document.createElement("div");
    el.className = "export-progress";
    el.innerHTML = `<strong>🎬 Gerando vídeo...</strong><span>${text}</span>`;
    document.body.appendChild(el);
    return el;
  }

  function exportCanvasFrame(ctx, canvas, scene, timeInScene) {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#05070b";
    ctx.fillRect(0, 0, w, h);

    const media = scene.__exportMedia;
    if (!media) return;

    const progress = scene.duration ? Math.max(0, Math.min(1, timeInScene / scene.duration)) : 0;
    const eased = progress < .5 ? 4*progress*progress*progress : 1-Math.pow(-2*progress+2,3)/2;
    const plans = [
      {x0:0,y0:0,s0:1,x1:2,y1:-1,s1:1.13,r0:0,r1:.10},
      {x0:-5,y0:0,s0:1.08,x1:5,y1:0,s1:1.08,r0:0,r1:0},
      {x0:3,y0:1,s0:1.13,x1:-1,y1:0,s1:1,r0:.08,r1:0},
      {x0:5,y0:0,s0:1.08,x1:-5,y1:0,s1:1.08,r0:0,r1:0},
      {x0:-3,y0:3,s0:1.03,x1:3,y1:-3,s1:1.12,r0:-.08,r1:.08},
      {x0:3,y0:-2,s0:1.12,x1:-3,y1:2,s1:1.02,r0:.08,r1:-.08},
      {x0:0,y0:-4,s0:1.08,x1:0,y1:4,s1:1.08,r0:0,r1:0},
      {x0:0,y0:4,s0:1.08,x1:0,y1:-4,s1:1.08,r0:0,r1:0}
    ];
    const m = plans[scene.__index % plans.length];
    const x = m.x0 + (m.x1-m.x0)*eased;
    const y = m.y0 + (m.y1-m.y0)*eased;
    const scale = m.s0 + (m.s1-m.s0)*eased;
    const rot = m.r0 + (m.r1-m.r0)*eased;

    const vw = media.videoWidth || media.naturalWidth || media.width;
    const vh = media.videoHeight || media.naturalHeight || media.height;
    if (!vw || !vh) return;
    const cover = Math.max(w/vw, h/vh) * scale;
    const dw = vw*cover, dh = vh*cover;
    const dx = (w-dw)/2 + (x/100)*w;
    const dy = (h-dh)/2 + (y/100)*h;

    ctx.save();
    ctx.translate(w/2,h/2);
    ctx.rotate(rot*Math.PI/180);
    ctx.translate(-w/2,-h/2);
    ctx.drawImage(media, dx, dy, dw, dh);
    ctx.restore();

    const cap = captionsEnabled.checked ? currentCaption(scene.start + timeInScene) : null;
    if (cap) {
      const fontSize = Math.max(24, Math.round(h * (captionStyle.value === "bold" ? .045 : .035)));
      ctx.font = `800 ${fontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const maxWidth = w * .84;
      const words = cap.text.split(/\s+/);
      const lines=[]; let line="";
      for (const word of words) {
        const test = line ? line+" "+word : word;
        if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line=word; } else line=test;
      }
      if (line) lines.push(line);
      const lineH=fontSize*1.18, boxH=lines.length*lineH+18, y0=h-h*.11-boxH/2;
      if (captionStyle.value === "box") { ctx.fillStyle="rgba(0,0,0,.68)"; ctx.roundRect(w*.08,y0-boxH/2,w*.84,boxH,12); ctx.fill(); }
      ctx.fillStyle="#fff"; ctx.shadowColor="rgba(0,0,0,.95)"; ctx.shadowBlur=8;
      lines.forEach((ln,i)=>ctx.fillText(ln,w/2,y0+i*lineH));
      ctx.shadowBlur=0;
    }
  }

  async function downloadVideo() {
    if (!scenes.length) { toast("Faça a montagem automática primeiro."); return; }
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      toast("Seu navegador não suporta exportação de vídeo neste formato.");
      return;
    }
    downloadVideoBtn.disabled = true;
    const overlay = makeExportOverlay("Preparando mídia...");
    try {
      const canvas=document.createElement("canvas");
      const ratio=formatSelect.value;
      if (ratio === "9:16") { canvas.width=720; canvas.height=1280; }
      else if (ratio === "1:1") { canvas.width=1080; canvas.height=1080; }
      else { canvas.width=1280; canvas.height=720; }
      const ctx=canvas.getContext("2d");
      const stream=canvas.captureStream(30);
      const AC=window.AudioContext||window.webkitAudioContext;
      const ac=new AC();
      const destination=ac.createMediaStreamDestination();
      const audioEls=[];
      const connectAudio=async(file,volume,loop=false)=>{
        if(!file) return null;
        const el=new Audio(URL.createObjectURL(file));
        el.preload="auto"; el.loop=loop; el.volume=volume;
        const src=ac.createMediaElementSource(el); const gain=ac.createGain(); gain.gain.value=volume;
        src.connect(gain).connect(destination); audioEls.push(el); return el;
      };
      const narration=await connectAudio(MediaEngine.state.audio?.file,1,false);
      const music=await connectAudio(MediaEngine.state.music?.file,.22,true);
      const tracks=destination.stream.getAudioTracks();
      tracks.forEach(t=>stream.addTrack(t));

      overlay.querySelector("span").textContent="Carregando imagens e vídeos...";
      for(let i=0;i<scenes.length;i++){
        const scene=scenes[i]; scene.__index=i;
        const media=scene.mediaType==='image' ? new Image() : document.createElement('video');
        if(scene.mediaType==='video'){ media.muted=true; media.playsInline=true; media.preload='auto'; }
        media.src=scene.mediaUrl;
        await new Promise((resolve,reject)=>{ media.onload=resolve; media.onloadeddata=resolve; media.onerror=reject; });
        scene.__exportMedia=media;
      }

      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";
      const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:7000000});
      const chunks=[];
      recorder.ondataavailable=e=>{if(e.data.size) chunks.push(e.data)};
      const stopped=new Promise(resolve=>recorder.onstop=resolve);
      recorder.start(200);
      await ac.resume();
      if(narration){ narration.currentTime=0; await narration.play().catch(()=>{}); }
      if(music){ music.currentTime=0; await music.play().catch(()=>{}); }

      const fps=30, startTime=performance.now();
      let frame=0;
      for(let t=0;t<duration;t+=1/fps){
        const idx=Math.max(0,Math.min(scenes.length-1,findSceneAt(t)));
        const scene=scenes[idx];
        exportCanvasFrame(ctx,canvas,scene,t-scene.start);
        elapsed=t; currentSceneIndex=idx;
        seekBar.value=duration?(t/duration)*100:0; currentTime.textContent=fmt(t);
        if(frame++%15===0) overlay.querySelector("span").textContent=`Renderizando ${Math.round((t/duration)*100)}%`;
        await new Promise(r=>setTimeout(r,1000/fps));
      }
      recorder.stop(); await stopped;
      audioEls.forEach(e=>{e.pause(); URL.revokeObjectURL(e.src)}); await ac.close();
      const blob=new Blob(chunks,{type:mime});
      const url=URL.createObjectURL(blob); const a=document.createElement('a');
      a.href=url; a.download=`auto-video-ai-v5-${Date.now()}.webm`; a.click();
      setTimeout(()=>URL.revokeObjectURL(url),5000);
      overlay.remove(); toast("Vídeo exportado e pronto para baixar");
    } catch(e) {
      console.error(e); overlay.remove(); toast("Não foi possível exportar o vídeo. Tente novamente.");
    } finally { downloadVideoBtn.disabled=false; }
  }

  function saveProject() {
    const project = {
      app: "AUTO VIDEO AI V5",
      version: "V5.4",
      format: formatSelect.value,
      duration,
      patternBreak: patternBreak.checked,
      changeInterval: {
        min: Number(minChange.value),
        max: Number(maxChange.value)
      },
      captions: {
        enabled: captionsEnabled.checked,
        style: captionStyle.value,
        transcript: transcriptInput.value,
        items: captions
      },
      scenes: scenes.map(s => ({
        mediaId: s.mediaId,
        name: s.name,
        mediaType: s.mediaType,
        start: s.start,
        duration: s.duration,
        end: s.end,
        breakType: s.breakType,
        semantic: s.semantic
      }))
    };

    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "auto-video-ai-v5-projeto.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Projeto salvo em JSON");
  }

  audioInput.addEventListener("change", handleAudio);
  imageInput.addEventListener("change", handleImages);
  videoInput.addEventListener("change", handleVideos);
  musicInput.addEventListener("change", handleMusic);
  formatSelect.addEventListener("change", updateFormat);
  autoEditBtn.addEventListener("click", autoEdit);
  saveProjectBtn.addEventListener("click", saveProject);
  downloadVideoBtn.addEventListener("click", downloadVideo);
  autoTranscribeBtn.addEventListener("click", autoTranscribe);
  generateCaptionsBtn.addEventListener("click", () => {
    if (!scenes.length) { toast("Faça a montagem automática primeiro."); return; }
    captionsEnabled.checked = true;
    if (buildCaptionsFromTranscript()) { renderCaption(elapsed); toast("Legendas geradas e sincronizadas"); }
  });
  captionsEnabled.addEventListener("change", () => {
    if (captionsEnabled.checked && scenes.length && transcriptInput.value.trim()) buildCaptionsFromTranscript();
    else if (!captionsEnabled.checked) { captions = []; captionInfo.textContent = "Legendas desligadas"; }
    renderCaption(elapsed);
  });
  captionStyle.addEventListener("change", () => renderCaption(elapsed));
  transcriptInput.addEventListener("input", () => {
    if (captionsEnabled.checked && scenes.length && transcriptInput.value.trim()) buildCaptionsFromTranscript();
    renderCaption(elapsed);
  });
  $("playBtn").addEventListener("click", play);
  $("pauseBtn").addEventListener("click", pause);
  $("stopBtn").addEventListener("click", stop);
  seekBar.addEventListener("input", e => seek(e.target.value));

  updateFormat();
  renderMediaLists();
  totalTime.textContent = fmt(duration);
})();
