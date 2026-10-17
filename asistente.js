/* =====================================================================
   asistente.js · Asistente del panel de administración (chat + voz)
   Requiere que el panel exponga su cliente de Supabase como window.__sb
   (una línea en index.html: window.__sb = sb;).
   - Conversa con la función de Supabase "asistente-panel" (la llave de la IA vive ahí, no aquí).
   - Voz: usa las voces gratuitas del propio navegador/teléfono (speechSynthesis). No cuesta nada.
   - Micrófono: dictado gratuito del navegador (Chrome/Edge/Android). Si no existe, el botón se oculta.
   - Las acciones que modifican datos salen como tarjeta con "Confirmar": nada se guarda sin tu toque.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__asistenteListo) return;
  window.__asistenteListo = true;

  /* helpers: inicio */
  function limpiarParaVoz(t) {
    return String(t || '')
      .replace(/https?:\/\/\S+/g, 'enlace')
      .replace(/[*_#`>~|\[\]{}]/g, ' ')
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function trocear(t, max) {
    max = max || 170;
    var frases = String(t).match(/[^.!?…]+[.!?…]*\s*/g) || [String(t)];
    var trozos = [], actual = '';
    frases.forEach(function (f) {
      f = f.trim();
      if (!f) return;
      if ((actual + ' ' + f).trim().length <= max) { actual = (actual + ' ' + f).trim(); return; }
      if (actual) trozos.push(actual);
      actual = '';
      while (f.length > max) {
        var corte = f.lastIndexOf(',', max);
        if (corte < 40) corte = f.lastIndexOf(' ', max);
        if (corte < 1) corte = max;
        trozos.push(f.slice(0, corte + 1).trim());
        f = f.slice(corte + 1).trim();
      }
      actual = f;
    });
    if (actual) trozos.push(actual);
    return trozos;
  }
  /* helpers: fin */

  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento: no pasa nada */ } }

  function el(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  var CSS = '\
#asist-fab{position:fixed;right:18px;bottom:18px;z-index:90;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;\
 background:var(--verde-800,#234131);color:#fff;font-size:26px;box-shadow:0 8px 24px rgba(18,33,25,.3);display:none;align-items:center;justify-content:center}\
#asist-fab:hover{background:var(--verde-700,#2d503e)}\
#asist-panel{position:fixed;right:18px;bottom:18px;z-index:95;width:min(410px,calc(100vw - 24px));height:min(660px,calc(100vh - 24px));\
 background:#fff;border:1px solid var(--borde,#e2e8e3);border-radius:16px;box-shadow:0 20px 40px rgba(18,33,25,.25);display:none;flex-direction:column;overflow:hidden;font-size:14px;color:var(--tinta,#232d27)}\
#asist-panel.abierto{display:flex}\
.asist-cab{display:flex;align-items:center;gap:6px;padding:10px 12px;background:var(--verde-900,#1a3124);color:#fff}\
.asist-cab strong{flex:1;font-size:15px}\
.asist-cab button,.asist-cab select{background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:8px;padding:6px 9px;cursor:pointer;font-size:13px;max-width:130px}\
.asist-cab select option{color:#111}\
.asist-cab button:hover{background:rgba(255,255,255,.25)}\
#asist-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;background:var(--arena-50,#f7f9f7)}\
.asist-b{max-width:88%;padding:9px 12px;border-radius:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}\
.asist-b.yo{align-self:flex-end;background:var(--verde-700,#2d503e);color:#fff;border-bottom-right-radius:4px}\
.asist-b.bot{align-self:flex-start;background:#fff;border:1px solid var(--borde,#e2e8e3);border-bottom-left-radius:4px}\
.asist-b.err{align-self:flex-start;background:var(--rojo-50,#fdf2f2);color:var(--rojo-600,#c23e3e);border:1px solid rgba(194,62,62,.25)}\
.asist-b.pensando{color:var(--tinta-suave,#66736a);font-style:italic}\
.asist-chips{display:flex;flex-wrap:wrap;gap:6px}\
.asist-chips button{background:#fff;border:1px solid var(--borde,#e2e8e3);border-radius:999px;padding:6px 11px;font-size:12.5px;cursor:pointer;color:var(--verde-800,#234131)}\
.asist-chips button:hover{border-color:var(--verde-500,#528c6e);background:var(--verde-50,#f0f6f2)}\
.asist-card{align-self:stretch;background:#fff;border:2px solid var(--ocre-500,#d49741);border-radius:12px;padding:12px}\
.asist-card.hablando{animation:asistPulso 1.3s ease-in-out infinite}\
.asist-card.hecha{border-color:var(--verde-500,#528c6e);animation:none}\
.asist-card.cancelada{opacity:.55;border-color:var(--borde,#e2e8e3);animation:none}\
@keyframes asistPulso{0%,100%{box-shadow:0 0 0 0 rgba(212,151,65,.45)}50%{box-shadow:0 0 0 6px rgba(212,151,65,0)}}\
.asist-card h4{margin:0 0 4px;font-size:14px}\
.asist-card .sub{font-size:12px;color:var(--tinta-suave,#66736a);margin-bottom:8px}\
.asist-card table{width:100%;border-collapse:collapse;font-size:13px}\
.asist-card td,.asist-card th{padding:4px 6px;border-bottom:1px solid var(--borde-suave,#edf1ee);text-align:left;vertical-align:top}\
.asist-card th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--tinta-suave,#66736a)}\
.asist-card td.antes{color:var(--tinta-suave,#66736a);text-decoration:line-through}\
.asist-card td.antes.nuevo{text-decoration:none}\
.asist-card td.despues{font-weight:600;color:var(--verde-800,#234131)}\
.asist-card .aviso{margin:8px 0 0;font-size:12.5px;color:var(--ocre-600,#9c6f2f);background:var(--ocre-100,#fbf3e5);border-radius:8px;padding:6px 8px}\
.asist-card .acc{display:flex;gap:8px;margin-top:10px}\
.asist-card .acc button{flex:1;padding:9px;border-radius:8px;border:1px solid var(--borde,#e2e8e3);cursor:pointer;font-weight:600;background:#fff}\
.asist-card .acc button.ok{background:var(--verde-800,#234131);color:#fff;border-color:var(--verde-800,#234131)}\
.asist-card .acc button:disabled{opacity:.6;cursor:default}\
.asist-pie{display:flex;gap:6px;padding:10px;border-top:1px solid var(--borde,#e2e8e3);background:#fff}\
.asist-pie input{flex:1;min-width:0;padding:10px 12px;border:1px solid var(--borde,#e2e8e3);border-radius:10px;font-size:14px}\
.asist-pie button{border:0;border-radius:10px;padding:0 13px;cursor:pointer;font-size:17px;background:var(--verde-800,#234131);color:#fff}\
.asist-pie button#asist-mic{background:var(--arena-200,#e3e7e2);color:var(--tinta,#232d27)}\
.asist-pie button#asist-mic.grabando{background:var(--rojo-600,#c23e3e);color:#fff}\
@media (max-width:600px){#asist-panel{inset:0;width:auto;height:auto;border-radius:0;right:0;bottom:0}#asist-fab{right:14px;bottom:14px}}';

  async function iniciar() {
    for (var i = 0; i < 60 && !window.__sb; i++) await new Promise(function (r) { setTimeout(r, 100); });
    var sb = window.__sb;
    if (!sb) { console.warn('asistente.js: no encontré window.__sb (agrega "window.__sb = sb;" en index.html).'); return; }

    var estilo = el('style'); estilo.textContent = CSS; document.head.appendChild(estilo);

    var fab = el('button'); fab.id = 'asist-fab'; fab.type = 'button'; fab.title = 'Asistente'; fab.setAttribute('aria-label', 'Abrir el asistente'); fab.textContent = '🤖';
    var panel = el('aside'); panel.id = 'asist-panel'; panel.setAttribute('aria-label', 'Asistente');
    panel.innerHTML =
      '<div class="asist-cab"><strong>🤖 Asistente</strong>' +
      '<select id="asist-voz" title="Voz" aria-label="Elegir voz"></select>' +
      '<button type="button" id="asist-sonido" title="Activar o silenciar la voz" aria-label="Voz">🔊</button>' +
      '<button type="button" id="asist-parar" title="Callar" aria-label="Callar">⏹</button>' +
      '<button type="button" id="asist-nuevo" title="Nueva conversación" aria-label="Nueva conversación">↺</button>' +
      '<button type="button" id="asist-cerrar" title="Cerrar" aria-label="Cerrar">✕</button></div>' +
      '<div id="asist-msgs" aria-live="polite"></div>' +
      '<form class="asist-pie" id="asist-form"><button type="button" id="asist-mic" title="Hablarle" aria-label="Dictar">🎤</button>' +
      '<input id="asist-in" type="text" autocomplete="off" placeholder="Escribe o toca el micrófono…" aria-label="Mensaje">' +
      '<button type="submit" aria-label="Enviar">➤</button></form>';
    document.body.appendChild(fab); document.body.appendChild(panel);

    var $ = function (id) { return panel.querySelector('#' + id); };
    var chat = $('asist-msgs'), input = $('asist-in'), selVoz = $('asist-voz'), btnSonido = $('asist-sonido');
    var historial = [], ocupado = false;

    /* ---------- voz (speechSynthesis) ---------- */
    var hayVoz = 'speechSynthesis' in window;
    var vozOn = leer('asist_voz_on') !== '0';
    var vozNombre = leer('asist_voz_nombre') || '';
    var voz = null;

    function pintarSonido() { btnSonido.textContent = vozOn ? '🔊' : '🔇'; }
    function cargarVoces() {
      if (!hayVoz) { selVoz.style.display = 'none'; return; }
      var todas = speechSynthesis.getVoices();
      var es = todas.filter(function (v) { return /^es([-_]|$)/i.test(v.lang); });
      selVoz.innerHTML = '';
      var auto = el('option', '', 'Voz automática'); auto.value = ''; selVoz.appendChild(auto);
      es.forEach(function (v) { var o = el('option', '', v.name + ' (' + v.lang + ')'); o.value = v.name; selVoz.appendChild(o); });
      var pref = ['es-VE', 'es-MX', 'es-US', 'es-419', 'es-CO', 'es-AR', 'es-ES'];
      voz = null;
      if (vozNombre) voz = es.filter(function (v) { return v.name === vozNombre; })[0] || null;
      for (var i = 0; !voz && i < pref.length; i++) voz = es.filter(function (v) { return v.lang.replace('_', '-') === pref[i]; })[0] || null;
      if (!voz) voz = es[0] || null;
      selVoz.value = vozNombre && es.some(function (v) { return v.name === vozNombre; }) ? vozNombre : '';
    }
    if (hayVoz) { cargarVoces(); speechSynthesis.onvoiceschanged = cargarVoces; }
    pintarSonido();

    function detenerVoz() { if (hayVoz) speechSynthesis.cancel(); document.querySelectorAll('.asist-card.hablando').forEach(function (c) { c.classList.remove('hablando'); }); }
    function desbloquearVoz() { // en móviles la primera voz debe nacer de un toque del usuario
      if (!hayVoz || !vozOn) return;
      try { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* nada */ }
    }
    function hablar(texto, tarjetas) {
      if (!hayVoz || !vozOn) return;
      var trozos = trocear(limpiarParaVoz(texto));
      if (!trozos.length) return;
      speechSynthesis.cancel();
      (tarjetas || []).forEach(function (c) { c.classList.add('hablando'); });
      var quitar = function () { (tarjetas || []).forEach(function (c) { c.classList.remove('hablando'); }); };
      trozos.forEach(function (t, i) {
        var u = new SpeechSynthesisUtterance(t);
        u.lang = (voz && voz.lang) || 'es-MX';
        if (voz) u.voice = voz;
        u.rate = 1.02;
        if (i === trozos.length - 1) { u.onend = quitar; u.onerror = quitar; }
        speechSynthesis.speak(u);
      });
    }
    selVoz.onchange = function () { vozNombre = selVoz.value; guardar('asist_voz_nombre', vozNombre); cargarVoces(); hablar('Hola, así sueno ahora.'); };
    btnSonido.onclick = function () { vozOn = !vozOn; guardar('asist_voz_on', vozOn ? '1' : '0'); pintarSonido(); if (!vozOn) detenerVoz(); };
    $('asist-parar').onclick = detenerVoz;

    /* ---------- mensajes ---------- */
    function burbuja(clase, texto) {
      var b = el('div', 'asist-b ' + clase, texto);
      chat.appendChild(b); chat.scrollTop = chat.scrollHeight; return b;
    }
    function bienvenida() {
      historial = []; chat.innerHTML = '';
      burbuja('bot', 'Hola, soy tu asistente. Puedo buscar clientes, compras y comisiones, y preparar eventos para que tú los confirmes. Los pagos los apruebas tú a mano. ¿Qué necesitas?');
      var chips = el('div', 'asist-chips');
      ['¿Qué comisiones hay pendientes?', 'Ventas de este mes', 'Eventos disponibles', 'Busca a un cliente por su nombre'].forEach(function (t) {
        var b = el('button', '', t); b.type = 'button';
        b.onclick = function () { if (t.indexOf('Busca') === 0) { input.value = 'Busca a '; input.focus(); } else enviar(t); };
        chips.appendChild(b);
      });
      chat.appendChild(chips);
    }

    function tarjeta(p) {
      var c = el('div', 'asist-card');
      c.appendChild(el('h4', '', p.titulo));
      c.appendChild(el('div', 'sub', 'Esto es lo que se guardaría. Nada cambia hasta que confirmes.'));
      var t = el('table');
      var cab = el('tr'); ['Campo', 'Antes', 'Después'].forEach(function (x) { cab.appendChild(el('th', '', x)); }); t.appendChild(cab);
      (p.filas || []).forEach(function (f) {
        var tr = el('tr');
        tr.appendChild(el('td', '', f.campo));
        tr.appendChild(el('td', 'antes' + (f.antes === '—' ? ' nuevo' : ''), f.antes));
        tr.appendChild(el('td', 'despues', f.despues));
        t.appendChild(tr);
      });
      c.appendChild(t);
      (p.avisos || []).forEach(function (a) { c.appendChild(el('div', 'aviso', '⚠️ ' + a)); });
      var acc = el('div', 'acc');
      var ok = el('button', 'ok', 'Confirmar'); ok.type = 'button';
      var no = el('button', '', 'Cancelar'); no.type = 'button';
      acc.appendChild(ok); acc.appendChild(no); c.appendChild(acc);

      no.onclick = function () {
        detenerVoz(); c.classList.add('cancelada'); acc.remove();
        historial.push({ role: 'user', content: '(Cancelé la acción propuesta: ' + p.titulo + ')' });
      };
      ok.onclick = async function () {
        ok.disabled = true; no.disabled = true; ok.textContent = 'Guardando…'; detenerVoz();
        var r = await llamar({ ejecutar: { tool: p.tool, args: p.args } });
        if (r && r.ok) {
          c.classList.add('hecha'); acc.remove();
          c.appendChild(el('div', 'sub', '✅ ' + r.mensaje));
          historial.push({ role: 'user', content: '(Confirmé y se ejecutó: ' + p.titulo + ')' });
          burbuja('bot', r.mensaje + ' Abre la sección correspondiente del panel y recárgala para verlo.');
          hablar(r.mensaje);
        } else {
          ok.disabled = false; no.disabled = false; ok.textContent = 'Confirmar';
          burbuja('err', (r && r.error) || 'No se pudo guardar.');
        }
      };
      return c;
    }

    async function llamar(body) {
      try {
        var res = await sb.functions.invoke('asistente-panel', { body: body });
        if (res.error) {
          var m = 'No se pudo conectar con el asistente.';
          try { var j = await res.error.context.json(); if (j && j.error) m = j.error; } catch (e) { /* se queda el mensaje genérico */ }
          return { error: m };
        }
        return res.data || { error: 'El asistente no devolvió nada.' };
      } catch (e) { return { error: 'No se pudo conectar con el asistente.' }; }
    }

    async function enviar(texto) {
      texto = (texto || '').trim();
      if (!texto || ocupado) return;
      ocupado = true; input.value = '';
      var chips = chat.querySelector('.asist-chips'); if (chips) chips.remove();
      desbloquearVoz(); detenerVoz();
      burbuja('yo', texto); historial.push({ role: 'user', content: texto });
      var espera = burbuja('bot pensando', 'Pensando…');
      var r = await llamar({ mensajes: historial });
      espera.remove();
      if (r.error) { burbuja('err', r.error); historial.pop(); ocupado = false; return; }
      burbuja('bot', r.respuesta);
      var tarjetas = (r.propuestas || []).map(function (p) { var c = tarjeta(p); chat.appendChild(c); return c; });
      chat.scrollTop = chat.scrollHeight;
      historial.push({
        role: 'assistant',
        content: r.respuesta + (tarjetas.length ? '\n[Propuesta pendiente de confirmación: ' + r.propuestas.map(function (p) { return p.titulo; }).join('; ') + ']' : ''),
      });
      hablar(r.respuesta, tarjetas);
      ocupado = false;
    }

    $('asist-form').onsubmit = function (e) { e.preventDefault(); enviar(input.value); };
    $('asist-nuevo').onclick = function () { detenerVoz(); bienvenida(); };

    /* ---------- micrófono (dictado gratuito del navegador) ---------- */
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var btnMic = $('asist-mic');
    if (!SR) { btnMic.style.display = 'none'; }
    else {
      btnMic.onclick = function () {
        detenerVoz(); desbloquearVoz();
        var rec = new SR(); rec.lang = 'es-VE'; rec.interimResults = false; rec.maxAlternatives = 1;
        btnMic.classList.add('grabando');
        rec.onresult = function (e) { var t = e.results[0][0].transcript; enviar(t); };
        rec.onerror = function () { btnMic.classList.remove('grabando'); };
        rec.onend = function () { btnMic.classList.remove('grabando'); };
        try { rec.start(); } catch (e) { btnMic.classList.remove('grabando'); }
      };
    }

    /* ---------- abrir / cerrar / sesión ---------- */
    function abrir() { panel.classList.add('abierto'); fab.style.display = 'none'; if (!chat.children.length) bienvenida(); setTimeout(function () { input.focus(); }, 50); }
    function cerrar() { detenerVoz(); panel.classList.remove('abierto'); fab.style.display = 'flex'; }
    fab.onclick = abrir; $('asist-cerrar').onclick = cerrar;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('abierto')) cerrar(); });

    function mostrar(haySesion) {
      if (haySesion) { if (!panel.classList.contains('abierto')) fab.style.display = 'flex'; }
      else { detenerVoz(); panel.classList.remove('abierto'); fab.style.display = 'none'; historial = []; chat.innerHTML = ''; }
    }
    var s = await sb.auth.getSession();
    mostrar(!!(s && s.data && s.data.session));
    sb.auth.onAuthStateChange(function (_ev, ses) { mostrar(!!ses); });
  }

  iniciar();
})();
