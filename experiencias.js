/* =====================================================================
   experiencias.js · Pestaña "Experiencias" del panel de administración
   Modera lo que la gente envía desde la página pública de Experiencias.
   Requiere window.__sb (index.html ya lo expone).
   Lee con la función fn_admin_experiencias; aprueba/rechaza/oculta/elimina
   con la función de borde "experiencias" (acción moderar).
   Necesita permiso 'experiencias' = editar para moderar (lectura = solo mirar).
   ===================================================================== */
(function () {
  'use strict';
  if (window.__experienciasListo) return;
  window.__experienciasListo = true;

  const SUPA = 'https://tgvcvnhrwswuxgjbpvwq.supabase.co';
  const CATALOGO = 'https://catalogo.naturalezaabierta.com/';
  const sb = () => window.__sb;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const ESTADOS = [['pendiente', 'Pendientes'], ['aprobada', 'Aprobadas'], ['oculta', 'Ocultas'], ['rechazada', 'Rechazadas']];
  let estadoActivo = 'pendiente';

  function aviso(txt, malo) {
    const d = document.createElement('div');
    d.textContent = txt;
    d.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;max-width:90vw;padding:10px 16px;border-radius:8px;font-size:14px;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);background:' + (malo ? '#a12b2b' : '#1f3323');
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 4000);
  }

  function fecha(iso) {
    try { return new Date(iso).toLocaleString('es-VE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }

  async function moderar(id, estado, nota) {
    const { data: ses } = await sb().auth.getSession();
    const tok = ses && ses.session && ses.session.access_token;
    if (!tok) return { ok: false, error: 'sin_sesion' };
    try {
      const r = await fetch(SUPA + '/functions/v1/experiencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
        body: JSON.stringify({ id: id, estado: estado, nota: nota || null }),
      });
      return await r.json().catch(() => ({ ok: false, error: 'respuesta_invalida' }));
    } catch (e) { return { ok: false, error: 'sin_conexion' }; }
  }

  function estrellas(n) { return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }

  /* Aprobadas: archivos públicos. El resto: archivos privados con enlace temporal. */
  async function urlArchivo(it, ruta) {
    if (!ruta) return null;
    if (it.estado === 'aprobada') return SUPA + '/storage/v1/object/public/experiencias-publico/' + ruta.split('/').map(encodeURIComponent).join('/');
    const { data } = await sb().storage.from('experiencias-privado').createSignedUrl(ruta, 3600);
    return data ? data.signedUrl : null;
  }

  window.renderExperiencias = async function () {
    const cont = document.getElementById('contenido-vista');
    cont.innerHTML = '<div class="cargando">Cargando…</div>';
    const { data: d, error } = await sb().rpc('fn_admin_experiencias', { p_estado: estadoActivo, p_limite: 100 });
    if (error || !d) {
      cont.innerHTML = '<div class="vacio">No se pudo cargar' + (error && error.code === '42501' ? ': no tienes acceso a esta área.' : '.') + '</div>';
      return;
    }
    const edit = !!d.puede_editar;
    const conteos = d.conteos || {};
    const items = d.items || [];

    let html = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + ESTADOS.map((e) =>
      '<button class="secundario" style="padding:6px 12px;font-size:13px;' + (e[0] === estadoActivo ? 'background:var(--verde-600);color:#fff;' : '') + '" data-est="' + e[0] + '">' +
      e[1] + ' (' + (conteos[e[0]] || 0) + ')</button>').join('') + '</div>';
    if (!edit) html += '<div class="tarjeta" style="margin-bottom:12px;font-size:13px">Tienes acceso de solo lectura: puedes ver, pero no aprobar ni cambiar.</div>';
    if (!items.length) html += '<div class="vacio">No hay experiencias en esta lista.</div>';

    html += items.map((it) => {
      const acc = [];
      if (edit) {
        if (it.estado !== 'aprobada') acc.push('<button data-acc="aprobada" data-id="' + it.id + '">✓ Aprobar</button>');
        if (it.estado === 'aprobada') acc.push('<button class="secundario" data-acc="oculta" data-id="' + it.id + '">Ocultar</button>');
        if (it.estado === 'pendiente') acc.push('<button class="secundario" data-acc="rechazada" data-id="' + it.id + '">Rechazar</button>');
        if (it.estado !== 'pendiente' && it.estado !== 'aprobada') acc.push('<button class="secundario" data-acc="pendiente" data-id="' + it.id + '">Volver a pendiente</button>');
        acc.push('<button class="secundario" data-guardar="' + it.id + '">Guardar edición</button>');
        acc.push('<button class="peligro" data-acc="eliminar" data-id="' + it.id + '">Eliminar</button>');
      }
      const campo = 'width:100%;padding:8px 10px;border:1px solid var(--borde);border-radius:8px;font-size:14px;box-sizing:border-box;';
      return '<div class="tarjeta" style="margin-bottom:12px;gap:8px" data-card="' + it.id + '">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--tinta-suave)">' +
        '<span>' + esc(fecha(it.creado_en)) + ' · ' + esc(it.item_nombre || 'En general') + '</span>' +
        '<span>' + (it.estrellas ? '<b style="color:#b8860b;font-size:15px">' + estrellas(it.estrellas) + '</b>' : '') + '</span></div>' +
        '<label style="font-size:12px">Nombre que se verá en público<input data-f="nombre" style="' + campo + '" maxlength="60" value="' + esc(it.nombre) + '"' + (edit ? '' : ' disabled') + '></label>' +
        '<label style="font-size:12px">Comentario<textarea data-f="comentario" rows="3" maxlength="1000" style="' + campo + '"' + (edit ? '' : ' disabled') + '>' + esc(it.comentario) + '</textarea></label>' +
        '<div data-media="' + it.id + '"></div>' +
        (it.codigo ? '<div style="font-size:13px">Código: <b>' + esc(it.codigo) + '</b> ' +
          (it.mostrar_codigo ? '<span class="chip verde">autorizó mostrarlo</span>' : '<span class="chip gris">no autorizó mostrarlo</span>') + ' ' +
          (it.codigo_coincide ? '<span class="chip verde">teléfono coincide ✓</span>' : '<span class="chip ocre">no se pudo verificar</span>') +
          (it.afiliado ? '<br>Afiliado/a: <b>' + esc(it.afiliado) + '</b>' : '') + '</div>' : '') +
        (edit && it.contacto ? '<div style="font-size:13px">Contacto (privado): <b>' + esc(it.contacto) + '</b></div>' : '') +
        '<div style="font-size:11px;color:var(--tinta-suave)">Autorización v' + esc(String(it.consentimiento_version || '').replace(/^v/, '')) + ' · ' + esc(fecha(it.consentimiento_en)) +
        (it.moderado_en ? ' · Revisada ' + esc(fecha(it.moderado_en)) : '') + '</div>' +
        '<label style="font-size:12px">Nota interna (no se publica)<input data-f="nota" style="' + campo + '" maxlength="300" value="' + esc(it.nota) + '"' + (edit ? '' : ' disabled') + '></label>' +
        (acc.length ? '<div style="display:flex;gap:8px;flex-wrap:wrap">' + acc.join('') + '</div>' : '') +
        '</div>';
    }).join('');

    cont.innerHTML = html;

    cont.querySelectorAll('[data-est]').forEach((b) => b.addEventListener('click', () => { estadoActivo = b.dataset.est; window.renderExperiencias(); }));

    /* Audio y foto (enlaces temporales para lo no publicado) */
    items.forEach(async (it) => {
      const box = cont.querySelector('[data-media="' + it.id + '"]');
      if (!box || (!it.audio && !it.foto)) return;
      const [a, f] = await Promise.all([urlArchivo(it, it.audio), urlArchivo(it, it.foto)]);
      let h = '';
      if (f) h += '<img src="' + esc(f) + '" alt="Foto enviada" style="max-width:100%;max-height:260px;border-radius:10px;display:block;margin-bottom:8px">';
      if (a) h += '<audio controls preload="none" src="' + esc(a) + '" style="width:100%"></audio>';
      if (!a && !f) h = '<div style="font-size:12px;color:#a12b2b">No se pudo abrir el archivo adjunto.</div>';
      box.innerHTML = h;
    });

    function datos(id) {
      const c = cont.querySelector('[data-card="' + id + '"]');
      return {
        nombre: c.querySelector('[data-f="nombre"]').value.trim(),
        comentario: c.querySelector('[data-f="comentario"]').value.trim(),
        nota: c.querySelector('[data-f="nota"]').value.trim(),
      };
    }

    cont.querySelectorAll('[data-guardar]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.dataset.guardar, v = datos(id);
      if (v.nombre.length < 2) return aviso('El nombre debe tener al menos 2 letras.', true);
      b.disabled = true;
      const { error: e } = await sb().from('experiencias').update({ nombre_publico: v.nombre, comentario: v.comentario || null, nota_moderacion: v.nota || null }).eq('id', id);
      b.disabled = false;
      aviso(e ? 'No se pudo guardar: ' + e.message : 'Cambios guardados ✓', !!e);
    }));

    cont.querySelectorAll('[data-acc]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.dataset.id, acc = b.dataset.acc, v = datos(id);
      if (acc === 'eliminar' && !confirm('¿Eliminar para siempre esta experiencia y sus archivos? No se puede deshacer.')) return;
      b.disabled = true;
      /* Guarda primero lo editado, para que se publique corregido */
      if (acc === 'aprobada') {
        if (v.nombre.length < 2) { b.disabled = false; return aviso('El nombre debe tener al menos 2 letras.', true); }
        const { error: e0 } = await sb().from('experiencias').update({ nombre_publico: v.nombre, comentario: v.comentario || null }).eq('id', id);
        if (e0) { b.disabled = false; return aviso('No se pudo guardar la edición: ' + e0.message, true); }
      }
      const r = await moderar(id, acc, v.nota);
      if (!r || !r.ok) { b.disabled = false; return aviso('No se pudo: ' + ((r && r.error) || 'error'), true); }
      aviso(acc === 'aprobada' ? 'Aprobada y publicada ✓' : acc === 'eliminar' ? 'Eliminada' : 'Listo ✓');
      window.renderExperiencias();
    }));
  };
})();
