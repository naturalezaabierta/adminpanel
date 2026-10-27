/* =====================================================================
   novedades.js · Pestaña "Novedades por correo" del panel de administración
   Envío masivo de lo nuevo (productos, experiencias, creativos) a embajadores y afiliados.
   Requiere window.__sb (index.html ya lo expone). Habla con la función de Supabase
   "enviar-novedades"; la llave de Brevo vive allá, no aquí.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__novedadesListo) return;
  window.__novedadesListo = true;

  const sb = () => window.__sb;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const TIPOS = { productos_servicios: 'producto', eventos_experiencias: 'experiencia', creativos: 'creativo' };
  const ETIQ = { producto: '🌿 Producto', experiencia: '🎫 Experiencia', creativo: '🎨 Creativo' };
  let loteActivo = null;

  function aviso(txt, malo) {
    const d = document.createElement('div');
    d.textContent = txt;
    d.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;max-width:90vw;padding:10px 16px;border-radius:8px;font-size:14px;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);background:' + (malo ? '#a12b2b' : '#1f3323');
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 4000);
  }

  async function llamar(cuerpo) {
    const { data, error } = await sb().functions.invoke('enviar-novedades', { body: cuerpo });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); msg = j.error || msg; } catch (_) { /* sin detalle */ }
      return { ok: false, error: msg };
    }
    return data;
  }

  /* ---------- Botón "📣 Envío masivo" en productos, experiencias y creativos ---------- */
  window.__aNovedades = async function (vista, id) {
    const tipo = TIPOS[vista];
    if (!tipo) return;
    const cols = vista === 'creativos' ? 'id,producto,formato' : vista === 'eventos_experiencias' ? 'id,nombre,ciudad_estado,fecha' : 'id,nombre';
    const { data: f, error } = await sb().from(vista).select(cols).eq('id', id).maybeSingle();
    if (error || !f) return aviso('No pude leer ese registro.', true);

    let titulo = f.nombre || f.producto || 'Sin nombre';
    let detalle = '';
    if (vista === 'creativos') detalle = f.formato || '';
    if (vista === 'eventos_experiencias') {
      let fecha = '';
      if (f.fecha) {
        const d = new Date(String(f.fecha).slice(0, 10) + 'T00:00:00');
        if (!isNaN(d)) fecha = d.toLocaleDateString('es-VE', { day: 'numeric', month: 'long' });
      }
      detalle = [f.ciudad_estado, fecha].filter(Boolean).join(' · ');
    }

    const { error: e2 } = await sb().from('novedades_items').insert({ tipo, ref_id: String(id), titulo, detalle: detalle || null });
    if (!e2) return aviso('Agregado al envío masivo ✓');
    if (e2.code === '23505') {
      const { data: ya } = await sb().from('novedades_items').select('lote_id').eq('tipo', tipo).eq('ref_id', String(id)).maybeSingle();
      return aviso(ya && ya.lote_id ? 'Ese ya está en un correo (míralo en Novedades por correo).' : 'Ese ya está en la lista de pendientes.', true);
    }
    aviso('No se pudo agregar: ' + e2.message, true);
  };

  /* ---------- Pestaña principal ---------- */
  window.renderNovedades = async function () {
    const cont = document.getElementById('contenido-vista');
    cont.innerHTML = '<div class="cargando">Cargando…</div>';
    const [res, items, lotes] = await Promise.all([
      llamar({ accion: 'resumen' }),
      sb().from('novedades_items').select('*').order('agregado_en'),
      sb().from('novedades_lotes').select('*').order('creado_en', { ascending: false }),
    ]);
    if (!res || !res.ok) { cont.innerHTML = '<div class="vacio">No se pudo cargar (' + esc(res && res.error) + ').</div>'; return; }
    const todos = items.data || [];
    const ls = lotes.data || [];
    const pend = todos.filter((i) => !i.lote_id);
    if (!loteActivo || !ls.some((l) => l.lote_id === loteActivo)) loteActivo = ls[0] ? ls[0].lote_id : null;
    const lote = ls.find((l) => l.lote_id === loteActivo) || null;
    const itemsLote = lote ? todos.filter((i) => i.lote_id === lote.lote_id) : [];
    const estado = lote ? await llamar({ accion: 'estado', lote_id: lote.lote_id }) : null;

    const fila = (i, quitar) => '<li style="margin:4px 0;">' + (ETIQ[i.tipo] || i.tipo) + ': <b>' + esc(i.titulo) + '</b>' + (i.detalle ? ' — ' + esc(i.detalle) : '') +
      ' <button class="secundario" style="padding:1px 8px;font-size:12px;" data-quitar="' + i.item_id + '">' + quitar + '</button></li>';

    let html = '';
    html += '<div class="tarjeta" style="margin-bottom:14px;gap:6px"><div style="font-weight:700;font-size:14px">Quiénes reciben</div>' +
      '<div>🌟 Embajadores activos: <b>' + res.embajadores + '</b> · 🤝 Afiliados: <b>' + res.afiliados + '</b> · Total a enviar: <b>' + res.total + '</b></div>' +
      '<div style="font-size:12px;color:var(--tinta-suave)">Sin correo guardado: ' + res.sin_correo + ' · Se dieron de baja: ' + res.bajas + '</div>' +
      '<div style="font-size:13px">Cupo de hoy: enviados <b>' + res.enviados_hoy + '</b> de <b>' + res.tope_diario + '</b> (quedan <b>' + res.disponibles_hoy + '</b>). ' +
      'El tope se cambia en Configuración: <b>novedades_tope_diario</b>.</div></div>';

    html += '<div class="tarjeta" style="margin-bottom:14px;gap:8px"><div style="font-weight:700;font-size:14px">Pendientes por enviar (' + pend.length + ')</div>';
    if (pend.length) {
      html += '<ul style="margin:0;padding-left:18px;list-style:none">' + pend.map((i) => fila(i, 'Quitar')).join('') + '</ul>' +
        '<div><button id="nv-armar">Armar un correo nuevo con estos</button></div>';
    } else {
      html += '<div class="vacio" style="padding:8px">Nada pendiente. Marca productos, experiencias o creativos con el botón <b>📣 Envío masivo</b> y aparecen aquí.</div>';
    }
    html += '</div>';

    if (ls.length) {
      html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + ls.map((l, idx) =>
        '<button class="secundario" style="padding:6px 12px;font-size:13px;' + (l.lote_id === loteActivo ? 'background:var(--verde-600);color:#fff;' : '') + '" data-lote="' + l.lote_id + '">Correo ' + (ls.length - idx) + (l.estado === 'completado' ? ' ✓' : '') + '</button>').join('') + '</div>';
    }

    if (lote) {
      const faltan = estado && estado.ok ? estado.faltan : 0;
      const sugerido = Math.max(0, Math.min(faltan, res.disponibles_hoy));
      const inp = 'width:100%;padding:8px 10px;border:1px solid var(--borde);border-radius:8px;font-size:14px;box-sizing:border-box;';
      html += '<div class="tarjeta" style="gap:10px"><div style="font-weight:700;font-size:14px">Este correo (' + (lote.estado === 'borrador' ? 'sin enviar' : lote.estado === 'enviando' ? 'enviándose por tandas' : 'completado') + ')</div>' +
        '<label style="font-size:12px">Asunto<input id="nv-asunto" style="' + inp + '" value="' + esc(lote.asunto) + '"></label>' +
        '<label style="font-size:12px">Título dentro del correo<input id="nv-enc" style="' + inp + '" value="' + esc(lote.encabezado) + '" placeholder="Ej: ¡Llegaron novedades!"></label>' +
        '<label style="font-size:12px">Mensaje<textarea id="nv-msg" rows="4" style="' + inp + '" placeholder="Ej: Esto es lo nuevo que ya puedes compartir con tu código.">' + esc(lote.mensaje) + '</textarea></label>' +
        '<div style="font-size:13px;font-weight:600">Incluye (' + itemsLote.length + '):</div>' +
        (itemsLote.length ? '<ul style="margin:0;padding-left:18px;list-style:none">' + itemsLote.map((i) => fila(i, 'Quitar')).join('') + '</ul>' : '<div class="vacio" style="padding:8px">Este correo no tiene nada todavía.</div>') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        (pend.length ? '<button class="secundario" id="nv-sumar">Añadir los ' + pend.length + ' pendientes a este correo</button>' : '') +
        '<button class="secundario" id="nv-guardar">Guardar cambios</button>' +
        (lote.estado === 'borrador' && !(estado && estado.enviados) ? '<button class="peligro" id="nv-borrar">Eliminar este correo</button>' : '') + '</div>' +
        (lote.estado !== 'borrador' ? '<div style="font-size:12px;color:var(--tinta-suave)">Ojo: si cambias el texto, lo verán así los que reciban las próximas tandas.</div>' : '') +
        '<hr style="border:none;border-top:1px solid var(--borde);width:100%">';

      if (estado && estado.ok) {
        html += '<div style="font-size:14px">Ya lo recibieron: <b>' + estado.enviados + '</b> · Faltan: <b>' + estado.faltan + '</b> (embajadores: ' + estado.faltan_embajadores + ', afiliados: ' + estado.faltan_afiliados + ')' +
          (estado.errores ? ' · Con error: <b>' + estado.errores + '</b>' : '') + '</div>';
        if (!itemsLote.length) {
          html += '<div style="font-size:13px;color:#a12b2b">Añade al menos un producto, experiencia o creativo para poder enviarlo.</div>';
        } else if (estado.faltan === 0) {
          html += '<div style="font-size:13px;color:#1d6b35">Todos los destinatarios actuales ya lo recibieron.</div>';
        } else if (res.disponibles_hoy <= 0) {
          html += '<div style="font-size:13px;color:#a12b2b">Hoy ya no quedan envíos disponibles. Mañana puedes seguir, o sube <b>novedades_tope_diario</b> en Configuración si ampliaste tu plan de Brevo.</div>';
        } else {
          html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
            '<input id="nv-cant" type="number" min="1" value="' + sugerido + '" style="width:90px;padding:8px;border:1px solid var(--borde);border-radius:8px;font-size:14px">' +
            '<button id="nv-enviar-n">Enviar esa cantidad</button>' +
            '<button class="secundario" id="nv-enviar-todos">Enviar a todos los que faltan</button></div>' +
            '<div style="font-size:12px;color:var(--tinta-suave)">Salen primero los embajadores y luego los afiliados. Hoy puedes enviar hasta ' + res.disponibles_hoy + '.</div>';
        }
      }
      html += '</div>';
    }

    cont.innerHTML = html;

    /* ----- eventos ----- */
    cont.querySelectorAll('[data-lote]').forEach((b) => b.addEventListener('click', () => { loteActivo = b.dataset.lote; window.renderNovedades(); }));
    cont.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', async () => {
      const { error } = await sb().from('novedades_items').delete().eq('item_id', b.dataset.quitar);
      if (error) return aviso('No se pudo quitar: ' + error.message, true);
      window.renderNovedades();
    }));

    const botArmar = document.getElementById('nv-armar');
    if (botArmar) botArmar.addEventListener('click', async () => {
      const { data: nuevo, error } = await sb().from('novedades_lotes').insert({ asunto: 'Novedades en Naturaleza Abierta', encabezado: '¡Llegaron novedades!' }).select('lote_id').single();
      if (error) return aviso('No se pudo crear: ' + error.message, true);
      const { error: e2 } = await sb().from('novedades_items').update({ lote_id: nuevo.lote_id }).is('lote_id', null);
      if (e2) return aviso('No se pudieron asignar: ' + e2.message, true);
      loteActivo = nuevo.lote_id;
      window.renderNovedades();
    });

    if (!lote) return;

    const guardar = async () => {
      const { error } = await sb().from('novedades_lotes').update({
        asunto: document.getElementById('nv-asunto').value.trim() || 'Novedades en Naturaleza Abierta',
        encabezado: document.getElementById('nv-enc').value.trim(),
        mensaje: document.getElementById('nv-msg').value.trim(),
      }).eq('lote_id', lote.lote_id);
      if (error) { aviso('No se pudo guardar: ' + error.message, true); return false; }
      return true;
    };
    document.getElementById('nv-guardar').addEventListener('click', async () => { if (await guardar()) { aviso('Guardado ✓'); window.renderNovedades(); } });

    const botSumar = document.getElementById('nv-sumar');
    if (botSumar) botSumar.addEventListener('click', async () => {
      const { error } = await sb().from('novedades_items').update({ lote_id: lote.lote_id }).is('lote_id', null);
      if (error) return aviso('No se pudo añadir: ' + error.message, true);
      window.renderNovedades();
    });

    const botBorrar = document.getElementById('nv-borrar');
    if (botBorrar) botBorrar.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este correo? Lo que tenía vuelve a la lista de pendientes.')) return;
      const { error } = await sb().from('novedades_lotes').delete().eq('lote_id', lote.lote_id);
      if (error) return aviso('No se pudo eliminar: ' + error.message, true);
      loteActivo = null;
      window.renderNovedades();
    });

    const enviar = async (cantidad) => {
      const cuantos = cantidad === 'todos' ? 'a todos los que faltan' : 'a ' + cantidad + ' persona(s)';
      if (!confirm('¿Enviar "' + (document.getElementById('nv-asunto').value || lote.asunto) + '" ' + cuantos + '? Los correos enviados no se pueden deshacer.')) return;
      if (!(await guardar())) return;
      ['nv-enviar-n', 'nv-enviar-todos'].forEach((id) => { const b = document.getElementById(id); if (b) { b.disabled = true; b.textContent = 'Enviando…'; } });
      const r = await llamar({ accion: 'enviar', lote_id: lote.lote_id, cantidad });
      if (!r || !r.ok) aviso('No se pudo enviar: ' + esc((r && (r.detalle || r.error)) || 'error'), true);
      else aviso('Enviados: ' + r.enviados + (r.errores ? ' · con error: ' + r.errores : '') + (r.limitado_por_tope ? ' · llegaste al tope de hoy' : ''));
      window.renderNovedades();
    };
    const bn = document.getElementById('nv-enviar-n');
    if (bn) bn.addEventListener('click', () => {
      const n = Math.floor(Number(document.getElementById('nv-cant').value));
      if (!(n > 0)) return aviso('Pon una cantidad mayor a 0.', true);
      enviar(n);
    });
    const bt = document.getElementById('nv-enviar-todos');
    if (bt) bt.addEventListener('click', () => enviar('todos'));
  };
})();
