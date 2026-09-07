/* AUTO VIDEO AI V5 - Media Engine */
window.MediaEngine = (() => {
  const state = {
    images: [],
    videos: [],
    audio: null,
    music: null
  };

  function addFiles(fileList, type) {
    [...fileList].forEach(file => {
      const item = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        file,
        type,
        url: URL.createObjectURL(file)
      };
      if (type === "image") state.images.push(item);
      if (type === "video") state.videos.push(item);
    });
    return state;
  }

  function setAudio(file) {
    if (state.audio?.url) URL.revokeObjectURL(state.audio.url);
    state.audio = file ? {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      file, type: "audio", url: URL.createObjectURL(file)
    } : null;
  }

  function setMusic(file) {
    if (state.music?.url) URL.revokeObjectURL(state.music.url);
    state.music = file ? {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      file, type: "music", url: URL.createObjectURL(file)
    } : null;
  }

  function getAllVisuals() {
    return [...state.images, ...state.videos];
  }

  function renderList(element, items) {
    element.innerHTML = "";
    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "media-item";
      if (item.type === "image") {
        const img = document.createElement("img");
        img.className = "media-thumb";
        img.src = item.url;
        row.appendChild(img);
      } else {
        const icon = document.createElement("div");
        icon.className = "media-thumb";
        icon.style.display = "grid";
        icon.style.placeItems = "center";
        icon.textContent = "🎬";
        row.appendChild(icon);
      }
      const name = document.createElement("span");
      name.textContent = item.file.name;
      row.appendChild(name);
      element.appendChild(row);
    });
  }

  function clear() {
    [...state.images, ...state.videos, state.audio, state.music].filter(Boolean)
      .forEach(item => URL.revokeObjectURL(item.url));
    state.images = [];
    state.videos = [];
    state.audio = null;
    state.music = null;
  }

  return { state, addFiles, setAudio, setMusic, getAllVisuals, renderList, clear };
})();
