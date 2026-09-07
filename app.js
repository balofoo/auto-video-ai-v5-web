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

  async function handleAudio() {
    const file = audioInput.files[0];
    if (!file) return;
    MediaEngine.setAudio(file);
    duration = await detectAudioDuration(file);
    totalTime.textContent = fmt(duration);
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

    timelineInfo.textContent = `${scenes.length} cenas • trocas entre ${Number(minChange.value)} e ${Number(maxChange.value)} segundos`;

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

  function showScene(index) {
    if (!scenes.length) return;
    const scene = scenes[index];
    preview.innerHTML = "";

    if (scene.mediaType === "image") {
      const img = document.createElement("img");
      img.src = scene.mediaUrl;
      img.alt = scene.name;
      preview.appendChild(img);
    } else {
      const video = document.createElement("video");
      video.src = scene.mediaUrl;
      video.muted = true;
      video.autoplay = true;
      video.loop = true;
      preview.appendChild(video);
    }

    previewStatus.textContent = `${scene.name} • ${scene.breakType} • ${scene.duration.toFixed(1)}s`;
  }

  function findSceneAt(time) {
    return scenes.findIndex(s => time >= s.start && time < s.end);
  }

  function tick() {
    if (!playing || !scenes.length) return;
    elapsed += 0.1;

    if (elapsed >= duration) {
      elapsed = duration;
      playing = false;
      clearInterval(timer);
      $("playBtn").textContent = "▶";
    }

    const idx = Math.max(0, findSceneAt(elapsed));
    if (idx !== currentSceneIndex) {
      currentSceneIndex = idx;
      showScene(idx);
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
    clearInterval(timer);
    timer = setInterval(tick, 100);
  }

  function pause() {
    playing = false;
    clearInterval(timer);
    $("playBtn").textContent = "▶";
  }

  function stop() {
    pause();
    elapsed = 0;
    currentSceneIndex = 0;
    seekBar.value = 0;
    currentTime.textContent = "00:00";
    if (scenes.length) showScene(0);
  }

  function seek(value) {
    elapsed = (Number(value) / 100) * duration;
    currentSceneIndex = Math.max(0, findSceneAt(elapsed));
    currentTime.textContent = fmt(elapsed);
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

    previewStatus.textContent = "Construindo montagem...";

    // Garante que o algoritmo respeite o intervalo de 2–10 segundos.
    scenes = TimelineEngine.build({
      visuals,
      totalDuration: Math.max(2, duration),
      minChange: min,
      maxChange: max,
      mode: changeMode.value,
      avoidRepeat: avoidRepeat.checked,
      patternBreak: patternBreak.checked
    });

    currentSceneIndex = 0;
    elapsed = 0;
    renderTimeline();
    showScene(0);

    toast(`Montagem criada com ${scenes.length} cenas. Cada troca ocorre entre ${min}s e ${max}s.`);
  }

  function saveProject() {
    const project = {
      app: "AUTO VIDEO AI V5",
      version: "V5.0",
      format: formatSelect.value,
      duration,
      patternBreak: patternBreak.checked,
      changeInterval: {
        min: Number(minChange.value),
        max: Number(maxChange.value)
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
  $("playBtn").addEventListener("click", play);
  $("pauseBtn").addEventListener("click", pause);
  $("stopBtn").addEventListener("click", stop);
  seekBar.addEventListener("input", e => seek(e.target.value));

  updateFormat();
  renderMediaLists();
  totalTime.textContent = fmt(duration);
})();
