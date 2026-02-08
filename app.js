'use strict';

const CFG = window.PASIFAE_CFG;

const $ = (id) => document.getElementById(id);

const elStatus = $("statusPill");
const elTime = $("timePill");
const elToast = $("toast");

const form = $("orderForm");
const btnRefresh = $("btnRefresh");
const btnClear = $("btnClear");
const btnWA = $("btnWA");
const btnOpenSheet = $("btnOpenSheet");

const dlClientes = $("dlClientes");
const dlProductos = $("dlProductos");
const dlRevistas = $("dlRevistas");

const recentTbody = $("recentTbody");
const recentMeta = $("recentMeta");
const btnLoadRecent = $("btnLoadRecent");

// ✅ NUEVO: total live
const elHintTotal = $("hintTotal");

function nowStr(){
  const d = new Date();
  return d.toLocaleString("es-CO", { hour12: true });
}

function toast(msg, ok=true){
  if(!elToast) return;
  elToast.textContent = msg;
  elToast.style.color = ok ? "rgba(31,41,55,.85)" : "#8a1f2c";
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>{ elToast.textContent = ""; }, 2600);
}

function setStatus(text, good){
  if(!elStatus) return;
  elStatus.textContent = text;
  elStatus.style.borderColor = good ? "rgba(47,111,98,.18)" : "rgba(138,31,44,.22)";
  elStatus.style.background = good ? "rgba(47,111,98,.08)" : "rgba(138,31,44,.08)";
}

function sanitizePhone(raw){
  const s = String(raw || "").trim();
  const digits = s.replace(/\D+/g, "");
  if(!digits) return "";
  if(digits.startsWith("57")) return digits;
  if(digits.length === 10) return "57" + digits;
  return digits;
}

function waLink(phone, message){
  const p = sanitizePhone(phone);
  if(!p) return null;
  return `https://wa.me/${p}?text=${encodeURIComponent(message || "Hola 👋")}`;
}

/** ---------- Dinero / números ---------- */
function parseCOP(raw){
  // Acepta: 12000, "12.000", "$ 12.000", "12,000" etc
  if(raw === null || raw === undefined) return 0;
  const s = String(raw).trim();
  if(!s) return 0;
  const cleaned = s
    .replace(/\s+/g, "")
    .replace(/\$/g, "")
    .replace(/\./g, "")   // miles
    .replace(/,/g, ".");  // por si meten coma decimal
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function clampQty(n){
  const x = Number(n);
  if(!Number.isFinite(x) || x <= 0) return 1;
  return Math.floor(x);
}

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

/** ✅ NUEVO: total estimado en vivo */
function updateLiveTotal(){
  if(!elHintTotal) return;

  const qty = clampQty($("cantidad")?.value || 1);
  const precioUnit = parseCOP($("precioUnitario")?.value || "");
  const total = precioUnit * qty;

  // Mantén el texto base + agrega total estimado
  const base = "Tip: El total se calcula con Cantidad × Precio unitario (y el backend lo guarda como histórico).";
  const extra = (precioUnit > 0)
    ? `<span class="muted"> · </span><b>Total estimado:</b> ${money.format(total)}`
    : `<span class="muted"> · </span><b>Total estimado:</b> —`;

  elHintTotal.innerHTML = base + extra;
}

function requireWebApp(){
  const ok = CFG.WEBAPP_URL && CFG.WEBAPP_URL.includes("script.google.com");
  if(!ok){
    setStatus("Falta pegar WEBAPP_URL", false);
    toast("Pega la URL del Web App en config.js (WEBAPP_URL).", false);
  }
  return ok;
}

/** ---------- API (sin preflight) ---------- */
async function api(action, payloadObj){
  if(!requireWebApp()) throw new Error("WEBAPP_URL no configurada");

  const body = new URLSearchParams();
  body.set("token", CFG.TOKEN);
  body.set("action", action);
  if(payloadObj !== undefined) body.set("payload", JSON.stringify(payloadObj));

  const res = await fetch(CFG.WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body
  });

  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); }
  catch { throw new Error("Respuesta no-JSON del servidor: " + txt.slice(0, 140)); }

  if(!data || data.ok !== true){
    throw new Error(data?.error || "Error desconocido");
  }
  return data;
}

async function apiGet(action){
  if(!requireWebApp()) throw new Error("WEBAPP_URL no configurada");
  const url = new URL(CFG.WEBAPP_URL);
  url.searchParams.set("token", CFG.TOKEN);
  url.searchParams.set("action", action);

  const res = await fetch(url.toString(), { method: "GET" });
  const data = await res.json();
  if(!data || data.ok !== true){
    throw new Error(data?.error || "Error desconocido");
  }
  return data;
}

/** ---------- Lists ---------- */
function fillDatalist(dl, arr){
  if(!dl) return;
  dl.innerHTML = "";
  (arr || []).forEach(v=>{
    const opt = document.createElement("option");
    opt.value = v;
    dl.appendChild(opt);
  });
}

async function loadMeta(){
  setStatus("Conectando…", true);
  elTime.textContent = nowStr();

  if(btnOpenSheet) btnOpenSheet.href = CFG.SHEET_URL;

  const meta = await apiGet("meta");
  fillDatalist(dlClientes, meta.clientes || []);
  fillDatalist(dlProductos, meta.productos || []);
  fillDatalist(dlRevistas, meta.revistas || []);

  setStatus("Conectado ✅", true);
  elTime.textContent = "Listas: " + nowStr();
}

function clearForm(){
  form.reset();
  $("cantidad").value = 1;
  $("estado").value = "Nuevo";
  const p = $("precioUnitario");
  if(p) p.value = "";
  $("cliente").focus();
  updateLiveTotal(); // ✅
}

function getFormData(){
  const cliente = $("cliente").value.trim();
  const whatsapp = $("whatsapp").value.trim();
  const producto = $("producto").value.trim();
  const cantidad = clampQty($("cantidad").value || 1);
  const revista = $("revista").value.trim();
  const edicion = $("edicion").value.trim();
  const pagina = $("pagina").value.trim();
  const estado = $("estado").value.trim() || "Nuevo";
  const notas = $("notas").value.trim();
  const vendedor = $("vendedor").value.trim();

  const precioRaw = $("precioUnitario") ? $("precioUnitario").value : "";
  const precioUnit = parseCOP(precioRaw);

  return {
    FechaHora: new Date().toISOString(),
    Cliente: cliente,
    WhatsApp: whatsapp,
    Producto: producto,
    Cantidad: cantidad,
    PrecioUnitario: precioUnit,
    Revista: revista,
    Edicion: edicion,
    Pagina: pagina,
    Estado: estado,
    Notas: notas,
    Vendedor: vendedor
  };
}

/** ---------- Recent orders ---------- */
function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function renderRecent(rows){
  if(!recentTbody) return;
  recentTbody.innerHTML = "";

  if(!rows || !rows.length){
    recentTbody.innerHTML = `<tr><td colspan="7" class="muted">No hay pedidos todavía. Qué belleza: el vacío.</td></tr>`;
    recentMeta.textContent = "—";
    return;
  }

  const frag = document.createDocumentFragment();
  rows.forEach(r=>{
    const tr = document.createElement("tr");

    const phone = r.WhatsApp || "";
    const qty = clampQty(r.Cantidad || 1);

    const precioUnit = parseCOP(r.PrecioUnitario ?? r.precioUnitario ?? "");
    const total = parseCOP(r.Total ?? r.total ?? "") || (precioUnit * qty);

    const priceLine = precioUnit
      ? `\n• Precio: ${money.format(precioUnit)}\n• Total: ${money.format(total)}`
      : "";

    const wa = waLink(phone,
      `Hola 👋\n\nSoy Pasifae. Tengo tu pedido de:\n• ${r.Producto || ""} x${qty}${priceLine}\n\n¿Confirmamos?`
    );

    tr.innerHTML = `
      <td>${esc(r.FechaHora || "")}</td>
      <td>${esc(r.Cliente || "")}</td>
      <td>
        ${esc(r.Producto || "")}
        <span class="muted">x${esc(qty)}</span>
        ${precioUnit ? `<div class="muted small">${esc(money.format(precioUnit))} · ${esc(money.format(total))}</div>` : ``}
      </td>
      <td>${esc(r.Revista || "")} <span class="muted">${esc(r.Edicion || "")}</span></td>
      <td>${esc(r.Pagina || "")}</td>
      <td><span class="badge">${esc(r.Estado || "Nuevo")}</span></td>
      <td>
        ${wa ? `<a class="btn btn--ghost" href="${wa}" target="_blank" rel="noopener">WA</a>` : `<span class="muted">—</span>`}
      </td>
    `;
    frag.appendChild(tr);
  });

  recentTbody.appendChild(frag);
  recentMeta.textContent = `Mostrando ${rows.length} · ${nowStr()}`;
}

async function loadRecent(){
  const data = await apiGet("recent");
  renderRecent(data.rows || []);
}

/** ---------- Events ---------- */
btnRefresh?.addEventListener("click", async ()=>{
  try{
    await loadMeta();
    await loadRecent();
    toast("Listas recargadas ✅");
  }catch(err){
    setStatus("Error de conexión", false);
    toast(err.message || "Error", false);
  }
});

btnLoadRecent?.addEventListener("click", async ()=>{
  try{
    await loadRecent();
    toast("Últimos pedidos actualizados ✅");
  }catch(err){
    toast(err.message || "Error", false);
  }
});

btnClear?.addEventListener("click", ()=> clearForm());

btnWA?.addEventListener("click", ()=>{
  const phone = $("whatsapp").value;
  const name = $("cliente").value || "Hola";
  const link = waLink(phone, `Hola 👋\n\nSoy ${name}.`);
  if(!link){
    toast("Pon un WhatsApp para abrir chat.", false);
    return;
  }
  window.open(link, "_blank", "noopener");
});

form?.addEventListener("submit", async (e)=>{
  e.preventDefault();

  try{
    const payload = getFormData();

    if(!payload.Cliente || !payload.Producto || !payload.Revista){
      toast("Cliente, Producto y Revista son obligatorios.", false);
      return;
    }

    const priceInputExists = !!$("precioUnitario");
    if(priceInputExists && payload.PrecioUnitario <= 0){
      toast("Ojo: Precio unitario está en 0. Si es intencional, ignora 😅", true);
    }

    $("btnSave").disabled = true;
    await api("addOrder", payload);

    toast("Guardado ✅");
    clearForm();

    await loadMeta();
    await loadRecent();

  }catch(err){
    setStatus("Error", false);
    toast(err.message || "Error guardando", false);
  }finally{
    $("btnSave").disabled = false;
    elTime.textContent = nowStr();
  }
});

/** ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", async ()=>{
  elTime.textContent = nowStr();

  // ✅ Live total listeners
  const qtyEl = $("cantidad");
  const priceEl = $("precioUnitario");
  qtyEl?.addEventListener("input", updateLiveTotal);
  qtyEl?.addEventListener("change", updateLiveTotal);
  priceEl?.addEventListener("input", updateLiveTotal);
  priceEl?.addEventListener("change", updateLiveTotal);

  // Pintar estado inicial del total
  updateLiveTotal();

  try{
    await loadMeta();
    await loadRecent();
  }catch(err){
    setStatus("Sin conexión", false);
    toast((err && err.message) ? err.message : "No se pudo conectar.", false);
    renderRecent([]);
  }
});
