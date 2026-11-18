/* Motor del juego: selección y barajado de retos, turnos, puntaje y resumen.
   No toca el DOM (salvo el ayudante MP.el) para poder probarse aparte. */
(function (global) {
  "use strict";
  var MP = global.MP = global.MP || {};
  var B = global.BANCO;

  /* ---------- utilidades ---------- */
  MP.el = function (etiqueta, attrs, hijos) {
    var n = document.createElement(etiqueta), k, v;
    if (attrs) {
      for (k in attrs) {
        v = attrs[k];
        if (v === null || v === undefined || v === false) { continue; }
        if (k === "class") { n.className = v; }
        else if (k === "text") { n.textContent = v; }
        else if (k.slice(0, 2) === "on") { n.addEventListener(k.slice(2), v); }
        else { n.setAttribute(k, v === true ? "" : v); }
      }
    }
    (hijos || []).forEach(function (h) {
      if (h === null || h === undefined || h === false) { return; }
      n.appendChild(typeof h === "string" ? document.createTextNode(h) : h);
    });
    return n;
  };

  MP.barajar = function (lista) {
    var r = lista.slice(), i, j, t;
    for (i = r.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = r[i]; r[i] = r[j]; r[j] = t;
    }
    return r;
  };

  MP.nivel = function (id) {
    return B.niveles.filter(function (n) { return n.id === id; })[0];
  };

  /* ---------- del banco a pasos jugables ---------- */
  function opcionesDe(r) {
    if (r.tipo === "vf") {
      return { barajar: false, ops: [
        { texto: "Verdadero", correcta: r.correcta === true },
        { texto: "Falso", correcta: r.correcta === false }
      ] };
    }
    if (r.conjunto) {
      var c = B.conjuntos[r.conjunto];
      return { barajar: c.barajar !== false, ops: c.opciones.map(function (o) {
        return { texto: o.texto, detalle: o.detalle, correcta: o.id === r.correcta };
      }) };
    }
    return { barajar: r.barajar !== false, ops: r.opciones.map(function (o) {
      return { texto: o.texto, detalle: o.detalle, porque: o.porque, correcta: o.correcta === true };
    }) };
  }

  function base(r, id, nivel, heredado, ctx) {
    return {
      id: id, nivel: nivel, tipo: r.tipo,
      concepto: r.concepto || heredado.concepto,
      fuente: r.fuente || heredado.fuente,
      aviso: r.aviso || heredado.aviso || null,
      enunciado: r.enunciado, explicacion: r.explicacion,
      rotulo: r.rotulo || null,
      ctx: ctx, datos: r
    };
  }

  /* Convierte un reto del banco en uno o varios pasos (los casos se despliegan). */
  MP.aplanar = function (reto) {
    if (reto.tipo !== "caso") { return [base(reto, reto.id, reto.nivel, {}, null)]; }
    var respuesta = null, total = reto.pasos.length;
    return reto.pasos.map(function (p, i) {
      var ctx = {
        titulo: reto.titulo || null,
        etiquetaSituacion: reto.etiquetaSituacion || "Situación",
        situacion: reto.situacion,
        rotulo: reto.rotulo || null,
        paso: i + 1, de: total,
        respuesta: respuesta
      };
      if (p.tipo === "marcar" && (p.presentacion || "texto") === "texto") {
        respuesta = p.segmentos.map(function (s) { return s.texto; }).join(" ");
      }
      return base(p, reto.id + "-p" + (i + 1), reto.nivel, reto, ctx);
    });
  };

  /* Devuelve una copia lista para jugar, con el orden barajado. */
  MP.preparar = function (b) {
    var r = b.datos, p = {}, k, o, intento;
    for (k in b) { if (k !== "datos") { p[k] = b[k]; } }
    p.base = b;
    switch (r.tipo) {
      case "opcion": case "vf":
        o = opcionesDe(r);
        p.ui = "opcion";
        p.opciones = o.barajar ? MP.barajar(o.ops) : o.ops;
        break;
      case "marcar":
        p.ui = "marcar";
        p.presentacion = r.presentacion || "texto";
        p.segmentos = r.segmentos;
        break;
      case "clasificar":
        p.ui = "clasificar";
        p.casillas = r.casillas;
        p.fichas = MP.barajar(r.fichas);
        break;
      case "insertar":
        p.ui = "insertar";
        p.partes = r.partes;
        p.fichas = MP.barajar(r.partes.filter(function (x) { return x.hueco; })
          .map(function (x) { return { texto: x.hueco }; }));
        break;
      case "ordenar":
        p.ui = "ordenar";
        p.ocultarDetalle = !!r.ocultarDetalleHastaResponder;
        o = r.elementos.map(function (e, i) { return { texto: e.texto, detalle: e.detalle, pos: i }; });
        intento = 0;
        do { p.elementos = MP.barajar(o); intento++; }
        while (intento < 20 && p.elementos.every(function (e, i) { return e.pos === i; }));
        break;
    }
    return p;
  };

  /* Arma la lista de pasos de una partida según la configuración. */
  MP.seleccionar = function (ajustes) {
    var pasos = [];
    B.niveles.forEach(function (n) {
      n.seleccion.forEach(function (s) {
        var cuantos = (ajustes.duracion === "expres" && s.nExpres !== undefined) ? s.nExpres : s.n;
        var candidatos = B.retos.filter(function (r) { return r.nivel === n.id && r.grupo === s.grupo; });
        MP.barajar(candidatos).slice(0, cuantos).forEach(function (r) {
          pasos = pasos.concat(MP.aplanar(r));
        });
      });
    });
    return pasos;
  };

  /* ---------- estado de la partida ---------- */
  var J = MP.juego = { estado: null };

  J.nueva = function (ajustes, pasosBase, esRepaso) {
    var nombres;
    if (ajustes.modo === "equipos") {
      nombres = [];
      for (var i = 0; i < ajustes.nEquipos; i++) {
        nombres.push((ajustes.nombres[i] || "").trim() || ("Equipo " + (i + 1)));
      }
    } else {
      nombres = [ajustes.modo === "facilitador" ? "Grupo" : "Tú"];
    }
    J.estado = {
      ajustes: ajustes,
      esRepaso: !!esRepaso,
      pasos: (pasosBase || MP.seleccionar(ajustes)).map(MP.preparar),
      i: 0,
      turno: 0,
      equipos: nombres.map(function (n) { return { nombre: n, puntos: 0, racha: 0, aciertos: 0, jugados: 0 }; }),
      resultados: [],
      inicioReto: Date.now()
    };
    return J.estado;
  };

  J.actual = function () { return J.estado.pasos[J.estado.i]; };
  J.equipoEnTurno = function () { return J.estado.equipos[J.estado.turno]; };
  J.marcarInicio = function () { J.estado.inicioReto = Date.now(); };

  /* tipo: "acierto" | "error" | "tiempo" | "omitido"  → devuelve el detalle de puntos */
  J.registrar = function (tipo) {
    var e = J.estado, eq = J.equipoEnTurno(), P = B.config.puntaje;
    var det = { tipo: tipo, puntos: 0, racha: 0, bonusRacha: 0, bonusVelocidad: 0 };
    if (tipo === "acierto") {
      eq.racha++; eq.aciertos++; eq.jugados++;
      det.racha = eq.racha;
      det.bonusRacha = Math.min((eq.racha - 1) * P.rachaPorAcierto, P.rachaMaximo);
      if (e.ajustes.bonusVelocidad) {
        var seg = (Date.now() - e.inicioReto) / 1000;
        for (var i = 0; i < P.velocidad.length; i++) {
          if (seg <= P.velocidad[i].hastaSegundos) { det.bonusVelocidad = P.velocidad[i].bonus; break; }
        }
      }
      det.puntos = P.acierto + det.bonusRacha + det.bonusVelocidad;
    } else if (tipo === "error") {
      eq.racha = 0; eq.jugados++;
      det.puntos = -Math.min(P.error, eq.puntos);   // penalización suave: nunca baja de 0
    } else if (tipo === "tiempo") {
      eq.racha = 0; eq.jugados++;
    }
    eq.puntos += det.puntos;
    e.resultados.push({ paso: J.actual(), tipo: tipo, equipo: e.turno, puntos: det.puntos });
    return det;
  };

  /* Pasa al siguiente reto. Devuelve false si la partida terminó. */
  J.avanzar = function () {
    var e = J.estado;
    e.i++;
    e.turno = (e.turno + 1) % e.equipos.length;
    return e.i < e.pasos.length;
  };

  J.resumen = function () {
    var e = J.estado, porConcepto = {}, porNivel = {}, ok = 0, total = 0, fallados = [];
    e.resultados.forEach(function (r) {
      if (r.tipo === "omitido") { return; }
      var c = r.paso.concepto, n = String(r.paso.nivel), bien = r.tipo === "acierto";
      porConcepto[c] = porConcepto[c] || { ok: 0, total: 0 };
      porNivel[n] = porNivel[n] || { ok: 0, total: 0 };
      porConcepto[c].total++; porNivel[n].total++; total++;
      if (bien) { porConcepto[c].ok++; porNivel[n].ok++; ok++; }
      else { fallados.push(r.paso.base); }
    });
    var pct = total ? ok / total : 0;
    var conceptos = B.conceptos.filter(function (c) { return porConcepto[c.id]; }).map(function (c) {
      var d = porConcepto[c.id];
      return { id: c.id, nombre: c.nombre, ok: d.ok, total: d.total,
               dominado: d.ok / d.total >= B.config.umbralDominio };
    });
    var insignias = B.niveles.filter(function (n) {
      var d = porNivel[String(n.id)];
      return d && d.total > 0 && d.ok / d.total >= B.umbralInsignia;
    }).map(function (n) { return { nombre: n.insignia, nivel: n.etiqueta }; });
    var rango = B.rangos.filter(function (r) { return pct >= r.desde; })[0] || B.rangos[B.rangos.length - 1];
    var ranking = e.equipos.slice().sort(function (a, b) { return b.puntos - a.puntos; });
    return { ok: ok, total: total, pct: pct, conceptos: conceptos, insignias: insignias,
             rango: rango.nombre, fallados: fallados, ranking: ranking,
             puntos: e.equipos.reduce(function (s, q) { return s + q.puntos; }, 0) };
  };
})(window);
