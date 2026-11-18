/* Mecánicas: un renderizador por tipo de reto.
   Cada una recibe (paso, contenedor, alResponder) y devuelve { revelar() }.
   alResponder({ correcto: bool, porque?: string }) se llama una sola vez. */
(function (global) {
  "use strict";
  var MP = global.MP, el = MP.el;
  var M = MP.mecanicas = {};
  var LETRAS = "ABCDEFGH";

  function estado(nodo, ok, texto) {
    nodo.textContent = (ok ? "✔ " : "✖ ") + texto;
    nodo.className = "estado " + (ok ? "estado-ok" : "estado-mal");
  }
  function botonComprobar(alClic) {
    return el("button", { type: "button", class: "btn btn-primario btn-comprobar", disabled: true, onclick: alClic, text: "Comprobar" });
  }
  function vivo() { return el("p", { class: "solo-lectores", "aria-live": "polite" }); }

  /* ---------- Opción múltiple y verdadero/falso ---------- */
  M.opcion = function (p, cont, fin) {
    var hecho = false;
    var lista = el("div", { class: "opciones", role: "group", "aria-label": "Opciones de respuesta" });
    var botones = p.opciones.map(function (o, i) {
      var b = el("button", { type: "button", class: "opcion", "data-correcta": o.correcta ? "1" : "0", onclick: function () { resolver(i); } }, [
        el("span", { class: "letra", "aria-hidden": "true", text: LETRAS.charAt(i) }),
        el("span", { class: "opcion-cuerpo" }, [
          el("span", { class: "opcion-texto", text: o.texto }),
          o.detalle ? el("span", { class: "opcion-detalle", text: o.detalle }) : null
        ]),
        el("span", { class: "estado" })
      ]);
      lista.appendChild(b);
      return b;
    });
    function pintar(elegida) {
      botones.forEach(function (b, i) {
        b.disabled = true;
        var e = b.querySelector(".estado");
        if (p.opciones[i].correcta) { b.classList.add("es-correcta"); estado(e, true, i === elegida ? "Correcta: tu elección" : "Respuesta correcta"); }
        else if (i === elegida) { b.classList.add("es-error"); estado(e, false, "Tu elección"); }
        else { b.classList.add("es-neutra"); }
      });
    }
    function resolver(i) {
      if (hecho) { return; }
      hecho = true;
      pintar(i);
      var o = p.opciones[i];
      fin({ correcto: o.correcta === true, porque: o.correcta ? null : (o.porque || null) });
    }
    cont.appendChild(lista);
    return { revelar: function () { if (!hecho) { hecho = true; pintar(-1); } } };
  };

  /* ---------- Marcar frases, datos o elementos ---------- */
  M.marcar = function (p, cont, fin) {
    var hecho = false, marcados = {};
    var caja = el("div", { class: "marcar marcar-" + p.presentacion, role: "group", "aria-label": "Toca para marcar o desmarcar" });
    var comprobar = botonComprobar(function () { resolver(true); });
    var botones = p.segmentos.map(function (s, i) {
      var b = el("button", { type: "button", class: "segmento", "aria-pressed": "false", "data-objetivo": s.objetivo ? "1" : "0", onclick: function () {
        if (hecho) { return; }
        marcados[i] = !marcados[i];
        b.setAttribute("aria-pressed", marcados[i] ? "true" : "false");
        comprobar.disabled = !p.segmentos.some(function (_, k) { return marcados[k]; });
      } }, [
        el("span", { class: "casilla-visual", "aria-hidden": "true" }),
        el("span", { class: "segmento-texto", text: s.texto }),
        el("span", { class: "estado" })
      ]);
      caja.appendChild(b);
      return b;
    });
    function resolver(evaluar) {
      if (hecho) { return; }
      hecho = true;
      comprobar.hidden = true;
      var todo = true;
      botones.forEach(function (b, i) {
        var obj = p.segmentos[i].objetivo === true, m = !!marcados[i], e = b.querySelector(".estado");
        b.disabled = true;
        if (obj) { b.classList.add("era-objetivo"); }
        if (!evaluar) { if (obj) { estado(e, true, "Había que marcarlo"); } return; }
        if (obj && m) { estado(e, true, "Bien marcado"); }
        else if (obj && !m) { estado(e, false, "Faltó marcarlo"); todo = false; }
        else if (!obj && m) { estado(e, false, "Este no era"); b.classList.add("es-error"); todo = false; }
      });
      if (evaluar) { fin({ correcto: todo }); }
    }
    cont.appendChild(el("p", { class: "ayuda", text: "Toca para marcar; toca otra vez para desmarcar. Luego pulsa «Comprobar»." }));
    cont.appendChild(caja);
    cont.appendChild(comprobar);
    return { revelar: function () { resolver(false); } };
  };

  /* ---------- Asignar fichas a destinos (base de clasificar e insertar) ----------
     cfg.destinos: [{ nombre, zona (nodo que recibe fichas), boton, esperado(ficha) → bool, correcta: texto }]
     cfg.unaPorDestino: true para los huecos de delimitadores */
  function asignar(p, cont, fin, cfg) {
    var hecho = false, seleccion = -1, lugar = p.fichas.map(function () { return -1; });
    var aviso = vivo();
    var bandeja = el("div", { class: "bandeja", role: "group", "aria-label": "Fichas por colocar" });
    var comprobar = botonComprobar(function () { resolver(true); });

    var nodos = p.fichas.map(function (f, i) {
      var b = el("button", { type: "button", class: "ficha", draggable: "true", "aria-pressed": "false", "data-ficha": String(i) }, [
        el("span", { class: "ficha-texto", text: f.texto }),
        el("span", { class: "estado" })
      ]);
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (hecho) { return; }
        if (lugar[i] !== -1) { colocar(i, -1); elegir(i); }
        else { elegir(seleccion === i ? -1 : i); }
      });
      b.addEventListener("dragstart", function (ev) {
        if (hecho) { ev.preventDefault(); return; }
        elegir(i);
        try { ev.dataTransfer.setData("text/plain", String(i)); ev.dataTransfer.effectAllowed = "move"; } catch (e) { /* sin soporte */ }
      });
      return b;
    });

    function elegir(i) {
      seleccion = i;
      nodos.forEach(function (n, k) { n.setAttribute("aria-pressed", k === i ? "true" : "false"); });
      cont.classList.toggle("hay-seleccion", i !== -1);
      if (i !== -1) { aviso.textContent = "Ficha seleccionada. Ahora elige dónde colocarla."; }
    }
    function colocar(i, d) {
      if (cfg.unaPorDestino && d !== -1) {
        lugar.forEach(function (l, k) { if (l === d && k !== i) { lugar[k] = -1; } });
      }
      lugar[i] = d;
      pintar();
      aviso.textContent = d === -1 ? "Ficha devuelta a la bandeja." : "Ficha colocada en " + cfg.destinos[d].nombre + ".";
    }
    function pintar() {
      nodos.forEach(function (n, i) {
        var destino = lugar[i] === -1 ? bandeja : cfg.destinos[lugar[i]].zona;
        if (n.parentNode !== destino) { destino.appendChild(n); }
      });
      cfg.destinos.forEach(function (d, k) {
        d.contenedor.classList.toggle("ocupado", lugar.indexOf(k) !== -1);
      });
      bandeja.classList.toggle("vacia", lugar.indexOf(-1) === -1);
      comprobar.disabled = !cfg.completo(lugar);
    }
    function soltarEn(d) {
      if (hecho || seleccion === -1) { return; }
      var i = seleccion;
      elegir(-1);
      colocar(i, d);
      var sig = nodos.filter(function (n, k) { return lugar[k] === -1; })[0];
      (sig || comprobar).focus();
    }

    cfg.destinos.forEach(function (d, k) {
      d.boton.addEventListener("click", function () {
        if (seleccion === -1 && !hecho) { aviso.textContent = "Primero elige una ficha."; return; }
        soltarEn(k);
      });
      d.contenedor.addEventListener("dragover", function (ev) { if (!hecho) { ev.preventDefault(); d.contenedor.classList.add("sobre"); } });
      d.contenedor.addEventListener("dragleave", function () { d.contenedor.classList.remove("sobre"); });
      d.contenedor.addEventListener("drop", function (ev) {
        ev.preventDefault();
        d.contenedor.classList.remove("sobre");
        soltarEn(k);
      });
    });
    bandeja.addEventListener("dragover", function (ev) { if (!hecho) { ev.preventDefault(); } });
    bandeja.addEventListener("drop", function (ev) {
      ev.preventDefault();
      if (hecho || seleccion === -1) { return; }
      var i = seleccion; elegir(-1); colocar(i, -1);
    });

    function resolver(evaluar) {
      if (hecho) { return; }
      hecho = true;
      elegir(-1);
      comprobar.hidden = true;
      cont.classList.add("resuelto");
      var todo = true;
      nodos.forEach(function (n) { n.disabled = true; n.removeAttribute("draggable"); });
      cfg.destinos.forEach(function (d) { d.boton.disabled = true; });
      if (evaluar) {
        todo = cfg.evaluar(lugar, function (i, ok, texto) {
          estado(nodos[i].querySelector(".estado"), ok, texto);
          nodos[i].classList.add(ok ? "es-correcta" : "es-error");
        });
      }
      if (!todo || !evaluar) { cont.appendChild(cfg.solucion()); }
      if (evaluar) { fin({ correcto: todo }); }
    }

    cont.appendChild(el("p", { class: "ayuda", text: cfg.ayuda }));
    cont.appendChild(bandeja);
    cont.appendChild(cfg.tablero);
    cont.appendChild(aviso);
    cont.appendChild(comprobar);
    pintar();
    return { revelar: function () { resolver(false); } };
  }

  function listaSolucion(titulo, filas) {
    return el("div", { class: "solucion" }, [
      el("p", { class: "solucion-titulo", text: titulo }),
      el("ul", null, filas.map(function (f) {
        return el("li", null, [el("strong", { text: f[0] + ": " }), f[1]]);
      }))
    ]);
  }

  /* ---------- Clasificar: fichas hacia casillas ---------- */
  M.clasificar = function (p, cont, fin) {
    var tablero = el("div", { class: "casillas casillas-" + p.casillas.length });
    var destinos = p.casillas.map(function (nombre) {
      var zona = el("div", { class: "casilla-zona" });
      var boton = el("button", { type: "button", class: "casilla-boton", "aria-label": "Colocar la ficha seleccionada en " + nombre }, [
        el("span", { class: "casilla-nombre", text: nombre }),
        el("span", { class: "casilla-pista", "aria-hidden": "true", text: "Colocar aquí" })
      ]);
      var contenedor = el("div", { class: "casilla", "data-casilla": nombre }, [boton, zona]);
      tablero.appendChild(contenedor);
      return { nombre: nombre, zona: zona, boton: boton, contenedor: contenedor };
    });
    return asignar(p, cont, fin, {
      ayuda: "Elige una ficha y luego su casilla (o arrástrala). Con teclado: Tab para moverte y Enter para elegir.",
      tablero: tablero, destinos: destinos, unaPorDestino: false,
      completo: function (lugar) { return lugar.indexOf(-1) === -1; },
      evaluar: function (lugar, marcar) {
        var todo = true;
        p.fichas.forEach(function (f, i) {
          var ok = p.casillas[lugar[i]] === f.casilla;
          marcar(i, ok, ok ? "Correcto" : "Iba en " + f.casilla);
          if (!ok) { todo = false; }
        });
        return todo;
      },
      solucion: function () {
        return listaSolucion("Solución", p.casillas.map(function (c) {
          return [c, p.fichas.filter(function (f) { return f.casilla === c; }).map(function (f) { return f.texto; }).join(" · ")];
        }));
      }
    });
  };

  /* ---------- Insertar delimitadores en un prompt ---------- */
  M.insertar = function (p, cont, fin) {
    var tablero = el("div", { class: "prompt-armable" });
    var destinos = [], n = 0;
    p.partes.forEach(function (parte) {
      if (!parte.hueco) { tablero.appendChild(el("p", { class: "bloque-prompt", text: parte.texto })); return; }
      n++;
      var nombre = "el hueco " + n;
      var zona = el("div", { class: "hueco-zona" });
      var boton = el("button", { type: "button", class: "hueco-boton", "aria-label": "Colocar el delimitador seleccionado en " + nombre }, [
        el("span", { text: "Hueco " + n + " · colocar aquí" })
      ]);
      var contenedor = el("div", { class: "hueco", "data-hueco": parte.hueco }, [boton, zona]);
      tablero.appendChild(contenedor);
      destinos.push({ nombre: nombre, zona: zona, boton: boton, contenedor: contenedor, espera: parte.hueco });
    });
    return asignar(p, cont, fin, {
      ayuda: "Elige un delimitador y luego el hueco donde va (o arrástralo). Con teclado: Tab y Enter.",
      tablero: tablero, destinos: destinos, unaPorDestino: true,
      completo: function (lugar) {
        return destinos.every(function (_, k) { return lugar.indexOf(k) !== -1; });
      },
      evaluar: function (lugar, marcar) {
        var todo = true;
        lugar.forEach(function (d, i) {
          if (d === -1) { return; }
          var ok = p.fichas[i].texto === destinos[d].espera;
          marcar(i, ok, ok ? "Correcto" : "Aquí iba " + destinos[d].espera);
          if (!ok) { todo = false; }
        });
        return todo;
      },
      solucion: function () {
        return listaSolucion("Solución", destinos.map(function (d, k) { return ["Hueco " + (k + 1), d.espera]; }));
      }
    });
  };

  /* ---------- Ordenar ---------- */
  M.ordenar = function (p, cont, fin) {
    var hecho = false, orden = p.elementos.slice();
    var lista = el("ol", { class: "ordenable" });
    var aviso = vivo();
    var comprobar = botonComprobar(function () { resolver(true); });
    comprobar.disabled = false;

    function pintar(foco) {
      lista.textContent = "";
      orden.forEach(function (e, i) {
        var subir = el("button", { type: "button", class: "btn-mover", "aria-label": "Subir " + e.texto, disabled: i === 0 || hecho, onclick: function () { mover(i, -1); } }, ["▲"]);
        var bajar = el("button", { type: "button", class: "btn-mover", "aria-label": "Bajar " + e.texto, disabled: i === orden.length - 1 || hecho, onclick: function () { mover(i, 1); } }, ["▼"]);
        var li = el("li", { class: "ordenable-item", "data-pos": String(e.pos) }, [
          el("span", { class: "orden-num", "aria-hidden": "true", text: String(i + 1) }),
          el("span", { class: "orden-cuerpo" }, [
            el("span", { class: "orden-texto", text: e.texto }),
            e.detalle && (!p.ocultarDetalle || hecho) ? el("span", { class: "orden-detalle", text: e.detalle }) : null
          ]),
          el("span", { class: "estado" }),
          el("span", { class: "orden-botones" }, [subir, bajar])
        ]);
        lista.appendChild(li);
        if (foco && foco.pos === e.pos) {
          var objetivo = foco.dir < 0 ? subir : bajar;
          if (objetivo.disabled) { objetivo = foco.dir < 0 ? bajar : subir; }
          objetivo.focus();
        }
      });
    }
    function mover(i, dir) {
      if (hecho) { return; }
      var j = i + dir, t = orden[i];
      if (j < 0 || j >= orden.length) { return; }
      orden[i] = orden[j]; orden[j] = t;
      pintar({ pos: t.pos, dir: dir });
      aviso.textContent = t.texto + " ahora está en la posición " + (j + 1) + ".";
    }
    function resolver(evaluar) {
      if (hecho) { return; }
      hecho = true;
      comprobar.hidden = true;
      var todo = orden.every(function (e, i) { return e.pos === i; });
      if (!evaluar) { orden = orden.slice().sort(function (a, b) { return a.pos - b.pos; }); }
      pintar(null);
      Array.prototype.forEach.call(lista.children, function (li, i) {
        var ok = orden[i].pos === i;
        if (evaluar) { estado(li.querySelector(".estado"), ok, ok ? "Posición correcta" : "Iba en la posición " + (orden[i].pos + 1)); }
        li.classList.add(ok ? "es-correcta" : "es-error");
      });
      if (evaluar) { fin({ correcto: todo }); }
    }
    cont.appendChild(el("p", { class: "ayuda", text: "Usa las flechas ▲ ▼ para mover cada elemento: el primero va arriba. Luego pulsa «Comprobar»." }));
    cont.appendChild(lista);
    cont.appendChild(aviso);
    cont.appendChild(comprobar);
    pintar(null);
    return { revelar: function () { resolver(false); } };
  };

  M.crear = function (paso, cont, fin) { return M[paso.ui](paso, cont, fin); };
})(window);
