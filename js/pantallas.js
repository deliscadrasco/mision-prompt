/* Pantallas: inicio y configuración, intro de nivel, reto, y cierre (debrief). */
(function (global) {
  "use strict";
  var MP = global.MP, el = MP.el, B = global.BANCO, J = MP.juego, A = MP.almacen;

  var ajustes = {
    modo: "individual", nEquipos: 2, nombres: [],
    tiempo: 0, bonusVelocidad: false, duracion: "estandar", sonido: false
  };
  (function () {
    var g = A.leer("ajustes", null), k;
    if (g && typeof g === "object") { for (k in ajustes) { if (g[k] !== undefined) { ajustes[k] = g[k]; } } }
    ajustes.nEquipos = Math.min(6, Math.max(2, parseInt(ajustes.nEquipos, 10) || 2));
    if (!Array.isArray(ajustes.nombres)) { ajustes.nombres = []; }
  })();
  function guardarAjustes() { A.escribir("ajustes", ajustes); }

  var app, mec = null, reloj = null, respondido = false, nivelMostrado = null, enJuego = false;

  function limpiar() {
    detenerReloj();
    app.textContent = "";
    global.scrollTo(0, 0);
  }
  function enfocar(nodo) { if (nodo) { try { nodo.focus({ preventScroll: false }); } catch (e) { nodo.focus(); } } }

  /* ---------- sonido (apagado por defecto) ---------- */
  var audio = null;
  function sonar(tipo) {
    if (!ajustes.sonido) { return; }
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) { return; }
      audio = audio || new AC();
      var notas = tipo === "acierto" ? [660, 880] : tipo === "final" ? [523, 659, 784] : [220, 180];
      notas.forEach(function (f, i) {
        var o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * 0.12;
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g); g.connect(audio.destination);
        o.start(t); o.stop(t + 0.2);
      });
    } catch (e) { /* sin audio: el juego sigue */ }
  }

  /* ---------- temporizador ---------- */
  function detenerReloj() { if (reloj) { global.clearInterval(reloj); reloj = null; } }
  function iniciarReloj(segundos, nodo, alAgotar) {
    detenerReloj();
    if (!segundos) { return; }
    var fin = Date.now() + segundos * 1000;
    var num = nodo.querySelector(".reloj-num"), barra = nodo.querySelector(".reloj-barra > span");
    function tic() {
      var resta = Math.max(0, fin - Date.now()), s = Math.ceil(resta / 1000);
      num.textContent = s + " s";
      barra.style.width = (resta / (segundos * 10)) + "%";
      nodo.classList.toggle("reloj-urgente", s <= 10);
      if (resta <= 0) { detenerReloj(); alAgotar(); }
    }
    tic();
    reloj = global.setInterval(tic, 250);
  }

  /* ======================================================================
     INICIO
     ====================================================================== */
  function radios(leyenda, nombre, opciones, actual, alCambiar) {
    var fs = el("fieldset", { class: "campo" }, [el("legend", { text: leyenda })]);
    var fila = el("div", { class: "radios" });
    opciones.forEach(function (o) {
      var id = nombre + "-" + o.valor;
      var input = el("input", { type: "radio", name: nombre, id: id, value: String(o.valor), checked: String(o.valor) === String(actual) });
      input.addEventListener("change", function () { if (input.checked) { alCambiar(o.valor); } });
      fila.appendChild(el("label", { class: "radio", for: id }, [
        input,
        el("span", { class: "radio-cuerpo" }, [
          el("span", { class: "radio-titulo", text: o.etiqueta }),
          o.ayuda ? el("span", { class: "radio-ayuda", text: o.ayuda }) : null
        ])
      ]));
    });
    fs.appendChild(fila);
    return fs;
  }

  function inicio() {
    enJuego = false;
    limpiar();
    document.body.classList.remove("modo-facilitador");

    var zonaEquipos = el("div", { class: "zona-equipos" });
    function pintarEquipos() {
      zonaEquipos.textContent = "";
      if (ajustes.modo !== "equipos") { return; }
      var sel = el("select", { id: "n-equipos" });
      [2, 3, 4, 5, 6].forEach(function (n) {
        sel.appendChild(el("option", { value: String(n), selected: n === ajustes.nEquipos, text: n + " equipos" }));
      });
      sel.addEventListener("change", function () { ajustes.nEquipos = parseInt(sel.value, 10); guardarAjustes(); pintarEquipos(); });
      var nombres = el("div", { class: "nombres-equipos" });
      for (var i = 0; i < ajustes.nEquipos; i++) {
        (function (i) {
          var inp = el("input", { type: "text", id: "equipo-" + i, maxlength: "18", placeholder: "Equipo " + (i + 1), value: ajustes.nombres[i] || "" });
          inp.addEventListener("input", function () { ajustes.nombres[i] = inp.value; guardarAjustes(); });
          nombres.appendChild(el("label", { class: "nombre-equipo", for: "equipo-" + i }, [
            el("span", { text: "Nombre del equipo " + (i + 1) }), inp
          ]));
        })(i);
      }
      zonaEquipos.appendChild(el("div", { class: "campo" }, [
        el("label", { for: "n-equipos", class: "etiqueta-campo", text: "¿Cuántos equipos?" }), sel, nombres,
        el("p", { class: "ayuda", text: "Los equipos se turnan reto a reto en esta misma pantalla. El marcador siempre está visible." })
      ]));
    }

    var casillaBonus = el("input", { type: "checkbox", id: "bonus-vel", checked: ajustes.bonusVelocidad });
    casillaBonus.addEventListener("change", function () { ajustes.bonusVelocidad = casillaBonus.checked; guardarAjustes(); });

    var mejores = A.leer("mejores", []);
    var total = function (d) {
      var a = { modo: "individual", duracion: d };
      return MP.seleccionar(a).length;
    };

    app.appendChild(el("section", { class: "tarjeta portada", "aria-labelledby": "titulo-portada" }, [
      el("p", { class: "sobretitulo", text: "Juego de repaso · 10 a 15 minutos" }),
      el("h2", { id: "titulo-portada", tabindex: "-1", text: B.titulo }),
      el("p", { class: "entrada", text: "Eres analista de selección en Talentia S.A.S., una empresa ficticia con vacantes por cubrir. Tu misión: usar la IA con criterio, sin caer en alucinaciones, sesgos ni fugas de datos. Cinco casos y un jefe final te esperan." }),

      radios("¿Cómo van a jugar?", "modo", [
        { valor: "individual", etiqueta: "Individual", ayuda: "Una persona, a su ritmo." },
        { valor: "equipos", etiqueta: "Equipos", ayuda: "De 2 a 6 equipos por turnos, en una sola pantalla." },
        { valor: "facilitador", etiqueta: "Facilitador", ayuda: "Tú conduces: el grupo responde en voz alta y decides cuándo mostrar la explicación." }
      ], ajustes.modo, function (v) { ajustes.modo = v; guardarAjustes(); pintarEquipos(); }),
      zonaEquipos,

      el("details", { class: "opciones-partida" }, [
        el("summary", { text: "Opciones de la partida (tiempo, duración, puntaje)" }),
        radios("Temporizador por reto", "tiempo", [
          { valor: 0, etiqueta: "Sin tiempo" }, { valor: 30, etiqueta: "30 segundos" }, { valor: 60, etiqueta: "60 segundos" }
        ], ajustes.tiempo, function (v) { ajustes.tiempo = v; guardarAjustes(); }),
        radios("Duración", "duracion", [
          { valor: "estandar", etiqueta: "Estándar", ayuda: total("estandar") + " retos · 12 a 15 min" },
          { valor: "expres", etiqueta: "Exprés", ayuda: total("expres") + " retos · 8 a 10 min" }
        ], ajustes.duracion, function (v) { ajustes.duracion = v; guardarAjustes(); }),
        el("div", { class: "campo" }, [
          el("label", { class: "casilla-opcion", for: "bonus-vel" }, [
            casillaBonus,
            el("span", null, [
              el("span", { class: "radio-titulo", text: "Bonus por velocidad" }),
              el("span", { class: "radio-ayuda", text: "Apagado por defecto, para no penalizar a quien lee con calma." })
            ])
          ])
        ]),
        el("p", { class: "ayuda", text: "Puntaje: " + B.config.puntaje.acierto + " puntos por acierto, bonus por racha de aciertos y −" + B.config.puntaje.error + " por error. No hay vidas: aquí nadie queda eliminado." })
      ]),

      el("div", { class: "acciones" }, [
        el("button", { type: "button", class: "btn btn-primario btn-grande", id: "btn-empezar", onclick: function () { comenzar(null); }, text: "Empezar la misión" })
      ]),

      mejores.length ? el("div", { class: "mejores" }, [
        el("h3", { text: "Mejores puntajes en este dispositivo" }),
        el("ol", null, mejores.map(function (m) {
          return el("li", null, [el("strong", { text: m.puntos + " puntos" }), " · " + m.nombre + " · " + m.aciertos + " · " + m.fecha]);
        }))
      ]) : null
    ]));
    pintarEquipos();
  }

  /* ======================================================================
     PARTIDA
     ====================================================================== */
  function comenzar(pasosBase) {
    var copia = JSON.parse(JSON.stringify(ajustes));
    J.nueva(copia, pasosBase, !!pasosBase);
    nivelMostrado = null;
    enJuego = true;
    document.body.classList.toggle("modo-facilitador", copia.modo === "facilitador");
    mostrarPaso();
  }

  function mostrarPaso() {
    var p = J.actual();
    if (!J.estado.esRepaso && p.nivel !== nivelMostrado) {
      nivelMostrado = p.nivel;
      return introNivel(MP.nivel(p.nivel));
    }
    reto(p);
  }

  function introNivel(n) {
    limpiar();
    var idx = B.niveles.indexOf(n) + 1;
    var btn = el("button", { type: "button", class: "btn btn-primario btn-grande", id: "btn-nivel", onclick: function () { reto(J.actual()); }, text: "Empezar" });
    app.appendChild(el("section", { class: "tarjeta intro-nivel", "aria-labelledby": "titulo-nivel" }, [
      el("p", { class: "sobretitulo", text: n.etiqueta + " · caso " + idx + " de " + B.niveles.length }),
      el("h2", { id: "titulo-nivel", tabindex: "-1", text: n.titulo }),
      el("p", { class: "entrada", text: n.intro }),
      el("p", { class: "ayuda", text: "Insignia en juego: " + n.insignia }),
      el("div", { class: "acciones" }, [btn])
    ]));
    enfocar(btn);
  }

  function marcador() {
    var e = J.estado;
    if (e.equipos.length < 2) { return null; }
    return el("ul", { class: "marcador", "aria-label": "Marcador de equipos" }, e.equipos.map(function (q, i) {
      var turno = i === e.turno;
      return el("li", { class: "marcador-equipo" + (turno ? " en-turno" : ""), "data-equipo": String(i) }, [
        el("span", { class: "marcador-nombre", text: q.nombre }),
        el("span", { class: "marcador-puntos", text: q.puntos + " pts" }),
        turno ? el("span", { class: "marcador-turno", text: "▶ Turno" }) : null
      ]);
    }));
  }

  function reto(p) {
    limpiar();
    respondido = false;
    var e = J.estado, n = MP.nivel(p.nivel), facil = e.ajustes.modo === "facilitador";
    var eq = J.equipoEnTurno();

    var nodoReloj = e.ajustes.tiempo ? el("div", { class: "reloj", "aria-label": "Tiempo restante" }, [
      el("span", { class: "reloj-num", text: e.ajustes.tiempo + " s" }),
      el("span", { class: "reloj-barra", "aria-hidden": "true" }, [el("span")])
    ]) : null;

    var nodoPuntos = el("span", { class: "barra-puntos", text: e.equipos.length < 2 ? eq.puntos + " puntos" : "" });
    var cabecera = el("div", { class: "barra-juego" }, [
      el("span", { class: "barra-nivel", text: (e.esRepaso ? "Repaso · " : "") + n.etiqueta + " · " + n.titulo }),
      el("span", { class: "barra-progreso" }, [
        el("span", { text: "Reto " + (e.i + 1) + " de " + e.pasos.length }),
        el("progress", { max: String(e.pasos.length), value: String(e.i), "aria-label": "Avance de la partida" })
      ]),
      nodoReloj,
      e.equipos.length < 2 ? nodoPuntos : null
    ]);

    var zonaMarcador = el("div", { class: "zona-marcador" }, [marcador()]);

    /* contexto de caso */
    var contexto = [];
    if (p.ctx) {
      if (p.ctx.titulo) { contexto.push(el("p", { class: "caso-titulo", text: p.ctx.titulo + (p.ctx.de > 1 ? " · paso " + p.ctx.paso + " de " + p.ctx.de : "") })); }
      contexto.push(el("div", { class: "caso-bloque" }, [
        el("span", { class: "caso-etiqueta", text: p.ctx.etiquetaSituacion }),
        el("p", { class: "caso-texto", text: p.ctx.situacion })
      ]));
      if (p.ctx.respuesta) {
        contexto.push(el("div", { class: "caso-bloque caso-respuesta" }, [
          el("span", { class: "caso-etiqueta", text: "Respuesta de la IA (inventada)" }),
          el("p", { class: "caso-texto", text: p.ctx.respuesta })
        ]));
      }
    }
    var rotulo = p.rotulo || (p.ctx && p.ctx.rotulo);

    var titulo = el("h2", { id: "enunciado", class: "enunciado", tabindex: "-1", text: p.enunciado });
    var zonaMec = el("div", { class: "mecanica mecanica-" + p.ui });
    var retro = el("div", { class: "retro", role: "status", "aria-live": "polite" });
    var acciones = el("div", { class: "acciones" });

    var btnSiguiente = el("button", { type: "button", class: "btn btn-primario", id: "btn-siguiente", hidden: true, onclick: siguiente,
      text: e.i + 1 >= e.pasos.length ? "Ver resultados" : "Siguiente reto" });
    var btnExplica = null, btnRevelar = null, btnSaltar = null;
    if (facil) {
      btnRevelar = el("button", { type: "button", class: "btn btn-secundario", id: "btn-revelar", onclick: function () { cerrar("omitido", null); }, text: "Revelar respuesta" });
      btnSaltar = el("button", { type: "button", class: "btn btn-secundario", id: "btn-saltar", onclick: function () { if (!respondido) { J.registrar("omitido"); } siguiente(); }, text: "Saltar reto" });
      btnExplica = el("button", { type: "button", class: "btn btn-secundario", id: "btn-explica", hidden: true, "aria-expanded": "false", text: "Mostrar explicación" });
      acciones.appendChild(btnRevelar); acciones.appendChild(btnSaltar); acciones.appendChild(btnExplica);
    }
    acciones.appendChild(btnSiguiente);

    app.appendChild(cabecera);
    app.appendChild(zonaMarcador);
    app.appendChild(el("section", { class: "tarjeta reto", "aria-labelledby": "enunciado", "data-id": p.id, "data-ui": p.ui }, [
      e.equipos.length > 1 ? el("p", { class: "turno-aviso", text: "Turno de " + eq.nombre }) : null,
      el("div", { class: "caso" }, contexto),
      titulo,
      rotulo ? el("p", { class: "rotulo-ficticio" }, [el("span", { "aria-hidden": "true", text: "⚠ " }), rotulo]) : null,
      p.aviso ? el("p", { class: "aviso-cifras" }, [el("span", { "aria-hidden": "true", text: "ℹ " }), B.avisos[p.aviso]]) : null,
      zonaMec, retro, acciones
    ]));

    mec = MP.mecanicas.crear(p, zonaMec, function (r) { cerrar(r.correcto ? "acierto" : "error", r.porque); });
    J.marcarInicio();
    if (nodoReloj) { iniciarReloj(e.ajustes.tiempo, nodoReloj, function () { cerrar("tiempo", null); }); }
    enfocar(titulo);

    function cerrar(tipo, porque) {
      if (respondido) { return; }
      respondido = true;
      detenerReloj();
      if (tipo === "tiempo" || tipo === "omitido") { mec.revelar(); }
      var det = J.registrar(tipo);
      sonar(tipo === "acierto" ? "acierto" : "error");

      var textos = {
        acierto: ["✔", "¡Correcto!"],
        error: ["✖", "No del todo"],
        tiempo: ["⏱", "Se acabó el tiempo"],
        omitido: ["◉", "Respuesta revelada"]
      }[tipo];
      var lineaPuntos = "";
      if (tipo === "acierto") {
        lineaPuntos = "+" + det.puntos + " puntos";
        if (det.bonusRacha) { lineaPuntos += " · racha de " + det.racha + " (+" + det.bonusRacha + ")"; }
        if (det.bonusVelocidad) { lineaPuntos += " · velocidad (+" + det.bonusVelocidad + ")"; }
      } else if (tipo === "error") {
        lineaPuntos = det.puntos < 0 ? det.puntos + " puntos. Tranquilidad: de los errores también se aprende." : "Sin penalización esta vez.";
      } else if (tipo === "tiempo") { lineaPuntos = "Sin puntos, sin penalización."; }
      else { lineaPuntos = "Este reto no suma ni resta."; }

      var explicacion = el("div", { class: "retro-explicacion", id: "explicacion" }, [
        porque ? el("p", { class: "retro-porque", text: porque }) : null,
        el("p", { text: p.explicacion }),
        el("p", { class: "retro-fuente" }, [el("strong", { text: "Concepto: " }), p.fuente])
      ]);
      retro.className = "retro retro-" + tipo + " visible";
      retro.appendChild(el("p", { class: "retro-titulo" }, [el("span", { class: "retro-icono", "aria-hidden": "true", text: textos[0] + " " }), textos[1]]));
      retro.appendChild(el("p", { class: "retro-puntos", text: (e.equipos.length > 1 ? eq.nombre + ": " : "") + lineaPuntos }));
      retro.appendChild(explicacion);

      if (facil) {
        btnRevelar.hidden = true; btnSaltar.hidden = true;
        explicacion.hidden = true;
        btnExplica.hidden = false;
        btnExplica.setAttribute("aria-controls", "explicacion");
        btnExplica.onclick = function () {
          explicacion.hidden = !explicacion.hidden;
          btnExplica.setAttribute("aria-expanded", explicacion.hidden ? "false" : "true");
          btnExplica.textContent = explicacion.hidden ? "Mostrar explicación" : "Ocultar explicación";
        };
      }
      nodoPuntos.textContent = e.equipos.length < 2 ? eq.puntos + " puntos" : "";
      zonaMarcador.textContent = "";
      var m = marcador();
      if (m) { zonaMarcador.appendChild(m); }
      btnSiguiente.hidden = false;
      enfocar(facil ? btnExplica : btnSiguiente);
    }
  }

  function siguiente() {
    if (J.avanzar()) { mostrarPaso(); } else { final(); }
  }

  /* ======================================================================
     CIERRE / DEBRIEF
     ====================================================================== */
  function final() {
    enJuego = false;
    limpiar();
    sonar("final");
    var e = J.estado, r = J.resumen(), equipos = e.equipos.length > 1;
    var pct = Math.round(r.pct * 100);

    if (!e.esRepaso && r.total > 0) {
      var mejores = A.leer("mejores", []);
      var top = r.ranking[0];
      mejores.push({
        nombre: e.ajustes.modo === "individual" ? "Individual" : e.ajustes.modo === "facilitador" ? "Grupo (facilitador)" : top.nombre,
        puntos: top.puntos, aciertos: r.ok + " de " + r.total + " aciertos",
        fecha: new Date().toLocaleDateString("es-CO")
      });
      mejores.sort(function (a, b) { return b.puntos - a.puntos; });
      A.escribir("mejores", mejores.slice(0, 5));
      A.escribir("ultimaPartida", { pct: pct, rango: r.rango, insignias: r.insignias.map(function (i) { return i.nombre; }) });
    }

    var bloqueEquipos = null;
    if (equipos) {
      var empate = r.ranking.length > 1 && r.ranking[0].puntos === r.ranking[1].puntos;
      bloqueEquipos = el("div", { class: "bloque" }, [
        el("h3", { text: empate ? "¡Empate en la cima!" : "Equipo ganador: " + r.ranking[0].nombre }),
        el("ol", { class: "ranking" }, r.ranking.map(function (q) {
          return el("li", null, [el("strong", { text: q.nombre }), " · " + q.puntos + " puntos · " + q.aciertos + " de " + q.jugados + " aciertos"]);
        }))
      ]);
    }

    var dominados = r.conceptos.filter(function (c) { return c.dominado; }).length;
    var mapa = el("ul", { class: "mapa" }, r.conceptos.map(function (c) {
      return el("li", { class: "mapa-item " + (c.dominado ? "dominado" : "reforzar") }, [
        el("span", { class: "mapa-nombre", text: c.nombre }),
        el("span", { class: "mapa-barra", "aria-hidden": "true" }, [el("span", { style: "width:" + Math.round(100 * c.ok / c.total) + "%" })]),
        el("span", { class: "mapa-estado", text: (c.dominado ? "✔ Dominado" : "↻ Por reforzar") + " · " + c.ok + " de " + c.total })
      ]);
    }));

    var btnRepaso = r.fallados.length ? el("button", { type: "button", class: "btn btn-primario", id: "btn-repaso",
      onclick: function () { comenzar(r.fallados); }, text: "Reintentar solo lo que fallé (" + r.fallados.length + ")" }) : null;

    var titulo = el("h2", { id: "titulo-final", tabindex: "-1", text: e.esRepaso ? "Repaso terminado" : "Misión cumplida" });
    app.appendChild(el("section", { class: "tarjeta final", "aria-labelledby": "titulo-final" }, [
      el("p", { class: "sobretitulo", text: e.esRepaso ? "Ronda de repaso" : "Resultados de la partida" }),
      titulo,
      el("div", { class: "resultado-principal" }, [
        el("div", { class: "resultado-dato" }, [el("span", { class: "dato-num", text: String(r.ok) + " / " + r.total }), el("span", { class: "dato-txt", text: "aciertos (" + pct + " %)" })]),
        el("div", { class: "resultado-dato" }, [el("span", { class: "dato-num", text: String(equipos ? r.ranking[0].puntos : r.puntos) }), el("span", { class: "dato-txt", text: equipos ? "puntos del equipo líder" : "puntos" })]),
        el("div", { class: "resultado-dato rango" }, [el("span", { class: "dato-txt", text: equipos ? "Rango del grupo" : "Tu rango" }), el("span", { class: "dato-rango", text: r.rango })])
      ]),
      bloqueEquipos,

      el("div", { class: "bloque" }, [
        el("h3", { text: "Insignias" }),
        r.insignias.length ? el("ul", { class: "insignias" }, r.insignias.map(function (i) {
          return el("li", { class: "insignia" }, [el("span", { "aria-hidden": "true", text: "★ " }), i.nombre, el("span", { class: "insignia-nivel", text: " · " + i.nivel })]);
        })) : el("p", { class: "ayuda", text: "Esta vez no hubo insignias. Se ganan con " + Math.round(B.umbralInsignia * 100) + " % de aciertos o más en un nivel: el repaso es tu oportunidad." })
      ]),

      el("div", { class: "bloque" }, [
        el("h3", { text: "Mapa de conceptos" }),
        el("p", { class: "ayuda", text: dominados + " de " + r.conceptos.length + " conceptos dominados. Los marcados «por reforzar» son buenos temas para repasar en voz alta." }),
        mapa
      ]),

      el("div", { class: "bloque regla-oro" }, [
        el("h3", { text: "Regla de oro" }),
        el("p", { class: "regla-texto", text: B.reglaDeOro })
      ]),

      el("div", { class: "bloque" }, [
        el("h3", { text: "Para reflexionar en voz alta" }),
        el("p", { class: "frase-cierre", text: "«" + B.cierre.frase + "»" }),
        el("ol", { class: "preguntas-cierre" }, B.cierre.preguntas.map(function (q) { return el("li", { text: q }); })),
        el("blockquote", { class: "cita" }, [
          el("p", { text: "«" + B.cierre.cita + "»" }),
          el("footer", { text: "— " + B.cierre.autorCita })
        ])
      ]),

      el("div", { class: "acciones" }, [
        btnRepaso,
        el("button", { type: "button", class: "btn " + (btnRepaso ? "btn-secundario" : "btn-primario"), id: "btn-otra", onclick: function () { comenzar(null); }, text: "Jugar otra partida" }),
        el("button", { type: "button", class: "btn btn-secundario", id: "btn-inicio-final", onclick: inicio, text: "Volver al inicio" })
      ])
    ]));
    enfocar(titulo);
  }

  /* ======================================================================
     ARRANQUE Y BARRA SUPERIOR
     ====================================================================== */
  function arrancar() {
    app = document.getElementById("app");
    var btnSonido = document.getElementById("btn-sonido");
    var btnPantalla = document.getElementById("btn-pantalla");
    var btnInicio = document.getElementById("btn-inicio");

    function pintarSonido() {
      btnSonido.setAttribute("aria-pressed", ajustes.sonido ? "true" : "false");
      btnSonido.textContent = ajustes.sonido ? "Sonido: sí" : "Sonido: no";
    }
    btnSonido.addEventListener("click", function () {
      ajustes.sonido = !ajustes.sonido; guardarAjustes(); pintarSonido();
      if (J.estado) { J.estado.ajustes.sonido = ajustes.sonido; }
      sonar("acierto");
    });
    pintarSonido();

    var raiz = document.documentElement;
    if (!(raiz.requestFullscreen || raiz.webkitRequestFullscreen)) { btnPantalla.hidden = true; }
    btnPantalla.addEventListener("click", function () {
      try {
        var activo = document.fullscreenElement || document.webkitFullscreenElement;
        if (activo) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
        else {
          var r = (raiz.requestFullscreen || raiz.webkitRequestFullscreen).call(raiz);
          if (r && r.catch) { r.catch(function () {}); }
        }
      } catch (e) { /* pantalla completa no disponible */ }
    });
    function pintarPantalla() {
      var activo = !!(document.fullscreenElement || document.webkitFullscreenElement);
      btnPantalla.textContent = activo ? "Salir de pantalla completa" : "Pantalla completa";
    }
    document.addEventListener("fullscreenchange", pintarPantalla);
    document.addEventListener("webkitfullscreenchange", pintarPantalla);

    btnInicio.addEventListener("click", function () {
      if (enJuego && !global.confirm("¿Salir de la partida actual y volver al inicio?")) { return; }
      inicio();
    });

    inicio();
  }

  MP.ui = { inicio: inicio, comenzar: comenzar, ajustes: ajustes };
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", arrancar); }
  else { arrancar(); }
})(window);
