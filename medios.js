/* =====================================================================
   medios.js · Fotos, videos y banner de la tienda (panel de administración)
   - window.__medios(vista, id): galería de fotos y videos de un producto o experiencia.
   - window.__bannerTienda(): foto y textos del banner de la página principal.
   Requiere window.__sb (index.html ya lo expone) y permiso 'catalogo' = editar.
   Archivos van al bucket público "catalogo-medios".
   ===================================================================== */
(function () {
  'use strict';
  if (window.__mediosListo) return;
  window.__mediosListo = true;

  const SUPA = 'https://tgvcvnhrwswuxgjbpvwq.supabase.co';
  const BUCKET = 'catalogo-medios';
  const sb = () => window.__sb;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const pub = (ruta) => SUPA + '/storage/v1/object/public/' + BUCKET + '/' + ruta.split('/').map(encodeURIComponent).join('/');

  function aviso(txt, malo) {
    const d = document.createElement('div');
    d.textContent = txt;
    d.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100001;max-width:90vw;padding:10px 16px;border-radius:8px;font-size:14px;color:#fff;background:' + (malo ? '#9B2C2C' : '#17372B');
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 4000);
  }
  function modal(titulo, html) {
    const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100000;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px';
    o.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:760px;width:100%;padding:20px;box-sizing:border-box"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0">' + esc(titulo) + '</h3><button class="secundario" data-x>Cerrar</button></div><div data-body>' + html + '</div></div>';
    o.querySelector('[data-x]').onclick = () => o.remove();
    document.body.appendChild(o);
    return o;
  }
  const ext = (f) => (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  async function subir(carpeta, f) {
    const esVideo = f.type.startsWith('video/');
    if (!esVideo && !f.type.startsWith('image/')) throw new Error('Solo fotos (jpg, png, webp) o videos (mp4, webm).');
    if (!esVideo && f.size > 8 * 1024 * 1024) throw new Error('La foto "' + f.name + '" pesa más de 8 MB.');
    if (esVideo && f.size > 50 * 1024 * 1024) throw new Error('El video "' + f.name + '" pesa más de 50 MB. Súbelo comprimido o pega un enlace de YouTube.');
    const ruta = carpeta + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext(f);
    const { error } = await sb().storage.from(BUCKET).upload(ruta, f, { contentType: f.type, cacheControl: '31536000' });
    if (error) throw new Error(error.message);
    return { url: pub(ruta), tipo: esVideo ? 'video' : 'imagen' };
  }

  /* ------------------------- Galería por producto / experiencia ------------------------- */
  window.__medios = async function (vista, id) {
    const tabla = vista === 'eventos_experiencias' ? 'eventos_experiencias' : 'productos_servicios';
    const o = modal('Fotos y video · ' + id, '<p>Cargando…</p>');
    const body = o.querySelector('[data-body]');

    async function sincronizarPrincipal(lista) {
      const img = lista.find((m) => m.tipo === 'imagen');
      const vid = lista.find((m) => m.tipo === 'video');
      await sb().from(tabla).update({ imagen_url: img ? img.url : null, video_url: vid ? vid.url : null }).eq('id', id);
    }
    async function cargar() {
      const { data, error } = await sb().from('catalogo_medios').select('*').eq('item_id', id).order('orden').order('id');
      if (error) { body.innerHTML = '<p style="color:#9B2C2C">No se pudo cargar: ' + esc(error.message) + '</p>'; return; }
      const lista = data || [];
      body.innerHTML = '<p style="font-size:13px;color:#555">La <b>primera foto</b> es la principal (la que sale en la tienda). El <b>primer video</b> sale en la página del producto. Fotos hasta 8 MB, videos hasta 50 MB (mp4 o webm).</p>'
        + '<div data-lista style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:12px 0"></div>'
        + '<input type="file" data-f accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple style="display:none">'
        + '<button class="primario" data-add>+ Subir fotos o videos</button> <span data-st style="font-size:13px"></span>'
        + '<div style="margin-top:14px;font-size:13px">O pega un enlace (YouTube u otro): <input data-link placeholder="https://…" style="width:60%"> <button class="secundario" data-addlink>Agregar enlace de video</button></div>';
      const cont = body.querySelector('[data-lista]');
      cont.innerHTML = lista.map((m, i) => '<div style="border:1px solid #ddd;border-radius:8px;padding:6px;font-size:12px">'
        + (m.tipo === 'video' ? (/\.(mp4|webm)(\?|$)/i.test(m.url) ? '<video src="' + esc(m.url) + '" style="width:100%;height:100px;object-fit:cover" muted></video>' : '<div style="height:100px;display:flex;align-items:center;justify-content:center;background:#eee">▶ enlace de video</div>') : '<img src="' + esc(m.url) + '" style="width:100%;height:100px;object-fit:cover;border-radius:6px">')
        + '<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;align-items:center"><span>' + (i === 0 ? '⭐ ' : '') + (m.tipo === 'video' ? 'Video' : 'Foto') + '</span>'
        + '<button class="secundario" style="padding:2px 6px" data-up="' + m.id + '">◀</button><button class="secundario" style="padding:2px 6px" data-dn="' + m.id + '">▶</button><button class="peligro" style="padding:2px 6px" data-del="' + m.id + '">Quitar</button></div></div>').join('') || '<p style="color:#777">Aún no hay fotos ni videos.</p>';

      const st = body.querySelector('[data-st]');
      const inp = body.querySelector('[data-f]');
      body.querySelector('[data-add]').onclick = () => inp.click();
      inp.onchange = async () => {
        const fs = Array.from(inp.files); if (!fs.length) return;
        let orden = lista.length ? Math.max(...lista.map((m) => m.orden)) + 1 : 0, nuevos = [];
        for (const f of fs) {
          st.textContent = 'Subiendo ' + f.name + '…';
          try { const r = await subir(id, f); const { data: ins, error: e } = await sb().from('catalogo_medios').insert({ item_id: id, tipo: r.tipo, url: r.url, orden: orden++ }).select().single(); if (e) throw e; nuevos.push(ins); }
          catch (e) { aviso(e.message || String(e), true); }
        }
        await sincronizarPrincipal(lista.concat(nuevos)); aviso('Listo'); cargar();
      };
      body.querySelector('[data-addlink]').onclick = async () => {
        const u = body.querySelector('[data-link]').value.trim(); if (!/^https?:\/\//.test(u)) return aviso('Pega un enlace que empiece con https://', true);
        const orden = lista.length ? Math.max(...lista.map((m) => m.orden)) + 1 : 0;
        const { error: e } = await sb().from('catalogo_medios').insert({ item_id: id, tipo: 'video', url: u, orden });
        if (e) return aviso(e.message, true);
        await sincronizarPrincipal(lista.concat([{ tipo: 'video', url: u }])); cargar();
      };
      async function mover(mid, d) {
        const i = lista.findIndex((m) => m.id == mid), j = i + d; if (j < 0 || j >= lista.length) return;
        const a = lista[i], b = lista[j];
        await sb().from('catalogo_medios').update({ orden: j }).eq('id', a.id);
        await sb().from('catalogo_medios').update({ orden: i }).eq('id', b.id);
        const nl = lista.slice(); nl[i] = b; nl[j] = a; await sincronizarPrincipal(nl); cargar();
      }
      body.querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => mover(b.dataset.up, -1)));
      body.querySelectorAll('[data-dn]').forEach((b) => (b.onclick = () => mover(b.dataset.dn, 1)));
      body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
        if (!confirm('¿Quitar este archivo?')) return;
        const m = lista.find((x) => x.id == b.dataset.del);
        const marca = '/' + BUCKET + '/';
        if (m && m.url.includes(marca)) { await sb().storage.from(BUCKET).remove([decodeURIComponent(m.url.split(marca)[1])]); }
        await sb().from('catalogo_medios').delete().eq('id', b.dataset.del);
        await sincronizarPrincipal(lista.filter((x) => x.id != b.dataset.del)); cargar();
      }));
    }
    cargar();
  };

  /* ------------------------- Banner de la tienda ------------------------- */
  window.__bannerTienda = async function () {
    const o = modal('Banner de la tienda', '<p>Cargando…</p>');
    const body = o.querySelector('[data-body]');
    const { data } = await sb().from('tienda_ajustes').select('*');
    const a = {}; (data || []).forEach((r) => (a[r.clave] = r.valor));
    body.innerHTML = '<div style="display:grid;gap:10px">'
      + '<label>Etiqueta pequeña<input data-k="banner_etiqueta" value="' + esc(a.banner_etiqueta || 'Bienestar consciente') + '" style="width:100%"></label>'
      + '<label>Título (el texto después de un punto va en dorado)<input data-k="banner_titulo" value="' + esc(a.banner_titulo || 'Vuelve a lo esencial. Vive diferente.') + '" style="width:100%"></label>'
      + '<label>Texto<textarea data-k="banner_texto" rows="3" style="width:100%">' + esc(a.banner_texto || 'Productos naturales y experiencias para acompañarte de una forma más consciente, cercana y auténtica.') + '</textarea></label>'
      + '<div><div style="font-size:13px;margin-bottom:6px">Foto del banner (recomendado horizontal, hasta 8 MB)</div><img data-prev src="' + esc(a.banner_imagen || '') + '" style="max-width:100%;max-height:180px;border-radius:8px;' + (a.banner_imagen ? '' : 'display:none') + '"><br>'
      + '<input type="file" data-f accept="image/jpeg,image/png,image/webp" style="display:none"><button class="secundario" data-pick>Elegir foto</button> <button class="secundario" data-nopic>Quitar foto</button></div>'
      + '<button class="primario" data-save>Guardar banner</button></div>';
    let imagen = a.banner_imagen || '';
    const f = body.querySelector('[data-f]'), prev = body.querySelector('[data-prev]');
    body.querySelector('[data-pick]').onclick = () => f.click();
    body.querySelector('[data-nopic]').onclick = () => { imagen = ''; prev.style.display = 'none'; };
    f.onchange = async () => { if (!f.files[0]) return; try { const r = await subir('banner', f.files[0]); imagen = r.url; prev.src = imagen; prev.style.display = ''; } catch (e) { aviso(e.message, true); } };
    body.querySelector('[data-save]').onclick = async () => {
      const filas = Array.from(body.querySelectorAll('[data-k]')).map((i) => ({ clave: i.dataset.k, valor: i.value.trim() }));
      filas.push({ clave: 'banner_imagen', valor: imagen });
      const { error } = await sb().from('tienda_ajustes').upsert(filas, { onConflict: 'clave' });
      if (error) return aviso(error.message, true);
      aviso('Banner guardado'); o.remove();
    };
  };
})();
