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
  let motionFrame = null;
  let mediaElement = null;

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

  function getMotionPlan(index) {
    const plans = [
      ["zoom-in", 0,0,1.00,0, 2,-1,1.13,.10],
      ["pan-right", -5,0,1.08,0, 5,0,1.08,0],
      ["zoom-out", 3,1,1.13,.08, -1,0,1.00,0],
      ["pan-left", 5,0,1.08,0, -5,0,1.08,0],
      ["push-diagonal", -3,3,1.03,-.08, 3,-3,1.12,.08],
      ["pull-diagonal", 3,-2,1.12,.08, -3,2,1.02,-.08],
      ["pan-down", 0,-4,1.08,0, 0,4,1.08,0],
      ["pan-up", 0,4,1.08,0, 0,-4,1.08,0]
    ];
    const q = plans[index % plans.length];
    return {name:q[0], from:{x:q[1],y:q[2],s:q[3],r:q[4]}, to:{x:q[5],y:q[6],s:q[7],r:q[8]}};
  }

  function applyMotion(progress) {
    if (!mediaElement || !scenes.length) return;
    const scene = scenes[currentSceneIndex];
    if (!scene || scene.mediaType !== "image") return;
    const m = getMotionPlan(currentSceneIndex);
    const p = Math.max(0, Math.min(1, progress));
    const e = p < .5 ? 4*p*p*p : 1-Math.pow(-2*p+2,3)/2;
    const x=m.from.x+(m.to.x-m.from.x)*e;
    const y=m.from.y+(m.to.y-m.from.y)*e;
    const s=m.from.s+(m.to.s-m.from.s)*e;
    const r=m.from.r+(m.to.r-m.from.r)*e;
    mediaElement.style.transform=`translate3d(${x}%,${y}%,0) scale(${s}) rotate(${r}deg)`;
  }

  function stopMotion() {
    if (motionFrame) cancelAnimationFrame(motionFrame);
    motionFrame = null;
  }

  function startMotion() {
    stopMotion();
    const animate=()=>{
      if(!playing || !mediaElement) return;
      if(scenes[currentSceneIndex]?.mediaType==="image"){
        applyMotion((elapsed-scenes[currentSceneIndex].start)/scenes[currentSceneIndex].duration);
      }
      motionFrame=requestAnimationFrame(animate);
    };
    motionFrame=requestAnimationFrame(animate);
  }

  function showScene(index) {
    if (!scenes.length || index < 0 || index >= scenes.length) return;
    stopMotion();
    currentSceneIndex=index;
    const scene=scenes[index];
    preview.innerHTML="";
    mediaElement=null;

    if(scene.mediaType==="image"){
      const img=document.createElement("img");
      img.src=scene.mediaUrl;
      img.alt=scene.name;
      img.style.width="100%";
      img.style.height="100%";
      img.style.objectFit="cover";
      img.style.willChange="transform";
      preview.appendChild(img);
      mediaElement=img;
      applyMotion((elapsed-scene.start)/scene.duration);
    }else{
      const video=document.createElement("video");
      video.src=scene.mediaUrl;
      video.muted=true;
      video.autoplay=true;
      video.loop=true;
      video.playsInline=true;
      video.style.width="100%";
      video.style.height="100%";
      video.style.objectFit="cover";
      preview.appendChild(video);
      mediaElement=video;
    }

    const move=scene.mediaType==="image" ? getMotionPlan(index).name : "vídeo";
    previewStatus.textContent=`${scene.name} • ${scene.breakType} • ${scene.duration.toFixed(1)}s • movimento: ${move}`;
    if(playing) startMotion();
  }

  function findSceneAt(time) {
    return scenes.findIndex(s => time >= s.start && time < s.end);
  }

  function tick() {
    if (!playing || !scenes.length) return;
    elapsed = Math.min(duration, elapsed + 0.1);

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
    } else if (mediaElement && scenes[idx]?.mediaType === "image") {
      applyMotion((elapsed - scenes[idx].start) / scenes[idx].duration);
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
    startMotion();
  }

  function pause() {
    playing = false;
    clearInterval(timer);
    stopMotion();
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

    previewStatus.textContent = "Construindo montagem variável de 2–10s...";

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

    if (!scenes.length) {
      toast("Não foi possível montar uma timeline válida. Use duração mínima de 2s e máxima de 10s.");
      previewStatus.textContent = "Erro na montagem";
      return;
    }

    currentSceneIndex = 0;
    elapsed = 0;
    renderTimeline();
    showScene(0);

    const actualMin = Math.min(...scenes.map(s => s.duration));
    const actualMax = Math.max(...scenes.map(s => s.duration));
    toast(`Montagem criada: ${scenes.length} cenas, mudanças reais de ${actualMin.toFixed(1)}s a ${actualMax.toFixed(1)}s.`);
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
