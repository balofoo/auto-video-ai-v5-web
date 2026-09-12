const videos=[
{title:"O mistério que ninguém conseguiu explicar",channel:"Canal Horizonte",views:"184 mil",age:"18h",eng:"9,8%",score:96,icon:"🌋"},
{title:"A história perdida que voltou a aparecer",channel:"Arquivo Secreto",views:"121 mil",age:"21h",eng:"8,7%",score:92,icon:"🏺"},
{title:"AFRO HOUSE — Deep Night Session",channel:"Mystic Waves",views:"97 mil",age:"14h",eng:"11,2%",score:89,icon:"🎧"},
{title:"O que aconteceu naquela noite?",channel:"Depois da Meia-Noite",views:"76 mil",age:"9h",eng:"10,1%",score:87,icon:"🌙"},
{title:"A descoberta que mudou tudo",channel:"Curiosidade Real",views:"64 mil",age:"2d",eng:"7,9%",score:84,icon:"🔎"},
{title:"Como essa pequena cidade desapareceu",channel:"Histórias do Mundo",views:"51 mil",age:"2d",eng:"7,4%",score:81,icon:"🏚️"}];
const channels=[
["Canal Horizonte","12,4 mil","+82%","95"],["Mystic Waves","8,7 mil","+71%","92"],
["Arquivo Secreto","31,2 mil","+61%","89"],["Depois da Meia-Noite","18,1 mil","+54%","87"],["Curiosidade Real","6,3 mil","+48%","85"]];
const $=id=>document.getElementById(id);
function render(){ $("videoResults").innerHTML=videos.map(v=>`<article class="video"><div class="thumb">${v.icon}</div><div class="body"><h3>${v.title}</h3><div class="meta">Canal: ${v.channel}<br>👁 ${v.views} • há ${v.age}<br>💬 Engajamento: ${v.eng}</div><div class="score">VIRAL SCORE <b>${v.score}/100</b> ${v.score>=90?"🔥🔥🔥":"🔥🔥"}</div></div></article>`).join("");$("channelResults").innerHTML=channels.map(c=>`<tr><td>${c[0]}</td><td>${c[1]}</td><td class="up">${c[2]}</td><td>🔥 ${c[3]}</td></tr>`).join("")}
$("analyze").onclick=()=>{const q=$("query").value.trim()||"tendências gerais";$("status").textContent="Analisando...";$("resultLabel").textContent="Tema: "+q;setTimeout(()=>{$("statVideos").textContent=videos.length;$("statChannels").textContent=channels.length;$("statScore").textContent=Math.max(...videos.map(v=>v.score))+"/100";$("status").textContent="Concluído";render()},350)};
$("query").onkeydown=e=>{if(e.key==="Enter")$("analyze").click()};