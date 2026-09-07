/* AUTO VIDEO AI V5 - Main Application */
(() => {
  const $ = id => document.getElementById(id);

  const audioInput = $("audioInput");
  const imageInput = $("imageInput");
  const videoInput = $("videoInput");
  const musicInput = $("musicInput");
  const autoEditBtn = $("autoEditBtn");
  const saveProjectBtn = $("saveProjectBtn");
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
  const motionMode = $("motionMode");
  const motionIntensity = $("motionIntensity");
  const motionEnabled = $("motionEnabled");
  const motionIntensityValue = $("motionIntensityValue");
  let motionFrame = null;

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

  function motionTransform(scene, progress) {
    if (!motionEnabled.checked) return "translate3d(0,0,0) scale(1) rotate(0deg)";
    const intensity = Math.max(0, Math.min(1, Number(motionIntensity.value || 55) / 100));
    const mode = motionMode.value || "cinematic";
    const t = Math.max(0, Math.min(1, progress));
    const smooth = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;
    const strength = 1 + intensity;
    let scale = 1.02, x = 0, y = 0, rot = 0;

    const kind = scene.motionPattern || scene.breakType || "zoom-in";
    if (mode === "zoom") {
      scale = 1.02 + 0.09 * intensity * smooth;
      x = -1.5 * intensity * smooth;
      y = -0.8 * intensity * smooth;
    } else if (mode === "pan") {
      scale = 1.06 + 0.025 * intensity;
      x = (t - 0.5) * 10 * intensity;
      y = Math.sin(t * Math.PI) * 1.5 * intensity;
    } else if (mode === "subtle") {
      scale = 1.015 + 0.035 * intensity;
      x = Math.sin(t * Math.PI * 2) * 2.2 * intensity;
      y = Math.cos(t * Math.PI * 2) * 1.2 * intensity;
      rot = Math.sin(t * Math.PI * 2) * 0.18 * intensity;
    } else if (kind === "pan-left") {
      scale = 1.06 + 0.025 * intensity; x = (0.5 - t) * 9 * intensity; y = Math.sin(t*Math.PI)*1.2*intensity;
    } else if (kind === "pan-right") {
      scale = 1.06 + 0.025 * intensity; x = (t - 0.5) * 9 * intensity; y = -Math.sin(t*Math.PI)*1.2*intensity;
    } else if (kind === "pan-up") {
      scale = 1.06 + 0.025 * intensity; y = (0.5 - t) * 8 * intensity; x = Math.sin(t*Math.PI)*1.2*intensity;
    } else if (kind === "pan-down") {
      scale = 1.06 + 0.025 * intensity; y = (t - 0.5) * 8 * intensity; x = -Math.sin(t*Math.PI)*1.2*intensity;
    } else if (kind === "zoom-out") {
      scale = 1.11 - 0.09 * intensity * smooth; x = (t-0.5)*2.5*intensity; y = (0.5-t)*1.5*intensity;
    } else if (kind === "zoom-pan") {
      scale = 1.02 + 0.10 * intensity * smooth; x = (t-0.5)*7*intensity; y = (0.5-t)*4*intensity;
      rot = Math.sin(t*Math.PI) * 0.15 * intensity;
    } else {
      // Default cinematográfico: aproximação + pequena deriva.
      scale = 1.02 + 0.09 * intensity * smooth;
      x = Math.sin(t * Math.PI) * 2.8 * intensity;
      y = (t - 0.5) * -2.2 * intensity;
      rot = Math.sin(t * Math.PI) * 0.12 * intensity;
    }
    return `translate3d(${x.toFixed(3)}%,${y.toFixed(3)}%,0) scale(${scale.toFixed(4)}) rotate(${rot.toFixed(3)}deg)`;
  }

  function animateCurrentScene() {
    if (!scenes.length || !playing) return;
    const scene = scenes[currentSceneIndex];
    const media = preview.querySelector(".scene-media");
    if (scene && media) {
      const progress = scene.duration > 0 ? (elapsed - scene.start) / scene.duration : 0;
      media.style.transform = motionTransform(scene, progress);
      media.style.animation = "none";
    }
    motionFrame = requestAnimationFrame(animateCurrentScene);
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
      img.className = "scene-media animated-media cinematic-motion";
      img.style.animation = "none";
      img.style.transform = motionTransform(scene, scene.duration ? (elapsed-scene.start)/scene.duration : 0);
      preview.appendChild(img);
    } else {
      const video = document.createElement("video");
      video.src = scene.mediaUrl;
      video.muted = true;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.className = "scene-media animated-media cinematic-motion";
      video.style.animation = "none";
      video.style.transform = motionTransform(scene, scene.duration ? (elapsed-scene.start)/scene.duration : 0);
      preview.appendChild(video);
      video.play().catch(() => {});
    }
    previewStatus.textContent = `${scene.name} • ${scene.breakType} • ${scene.duration.toFixed(1)}s • movimento cinematográfico`;
    renderCaption(elapsed);
    if (playing) { cancelAnimationFrame(motionFrame); motionFrame = requestAnimationFrame(animateCurrentScene); }
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
    cancelAnimationFrame(motionFrame);
    motionFrame = requestAnimationFrame(animateCurrentScene);
  }

  function pause() {
    playing = false;
    clearInterval(timer);
    if (narrationPlayer) narrationPlayer.pause();
    if (musicPlayer) musicPlayer.pause();
    cancelAnimationFrame(motionFrame);
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
  if (motionIntensity) motionIntensity.addEventListener("input", () => { motionIntensityValue.textContent = `${motionIntensity.value}%`; });
  if (motionMode) motionMode.addEventListener("change", () => { if (scenes.length) showScene(currentSceneIndex); });
  if (motionEnabled) motionEnabled.addEventListener("change", () => { if (scenes.length) showScene(currentSceneIndex); });

  formatSelect.addEventListener("change", updateFormat);
  autoEditBtn.addEventListener("click", autoEdit);
  saveProjectBtn.addEventListener("click", saveProject);
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
