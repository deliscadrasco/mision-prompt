#!/usr/bin/env node
/* Valida data/preguntas.js.   Uso:  node tools/validar-banco.js
   Comprueba esquema, respuesta correcta única, explicación, fuente, avisos
   y que no se cuelen datos con apariencia real (artículos, enlaces). */
"use strict";
const path = require("path");
const B = require(path.join(__dirname, "..", "data", "preguntas.js"));

const errores = [], avisos = [];
const err = (id, m) => errores.push(`✖ [${id}] ${m}`);
const warn = (id, m) => avisos.push(`! [${id}] ${m}`);

const TIPOS = ["opcion", "vf", "clasificar", "ordenar", "marcar", "insertar", "caso"];
const conceptos = new Set(B.conceptos.map(c => c.id));
const niveles = new Set(B.niveles.map(n => n.id));
const ids = new Set();
let totalPasos = 0;

function textos(r) {
  const t = [r.enunciado, r.explicacion, r.situacion, r.rotulo];
  (r.opciones || []).forEach(o => t.push(o.texto, o.porque));
  (r.fichas || []).forEach(f => t.push(f.texto));
  (r.elementos || []).forEach(e => t.push(e.texto, e.detalle));
  (r.segmentos || []).forEach(s => t.push(s.texto));
  (r.partes || []).forEach(p => t.push(p.texto, p.hueco));
  return t.filter(Boolean).join(" \n ");
}

function revisarContenido(id, r, avisoHeredado) {
  const t = textos(r);
  // Artículos / sentencias con número real
  if (/\b(art(í|i)culo|art\.)\s*\d/i.test(t)) err(id, "parece citar un artículo con número real. Usa «Art. XX».");
  if (/\b(ley|decreto|sentencia)\s+(n\.?º?\s*)?\d*[1-9]\d*/i.test(t)) err(id, "parece citar una norma o sentencia con número real.");
  // Enlaces: solo dominios evidentemente ficticios
  const urls = t.match(/\b(?:https?:\/\/|www\.)\S+|\b[\w.-]+@[\w.-]+\.\w+/gi) || [];
  urls.forEach(u => { if (!/ejemplo|ficticio|falso|\.test\b/i.test(u)) err(id, `enlace o correo que no es evidentemente ficticio: ${u}`); });
  // Cifras de ventana de contexto → aviso obligatorio
  if (/16 mil|200 mil|1 mill[oó]n/i.test(t) && (r.aviso || avisoHeredado) !== "ventana")
    err(id, "muestra cifras de ventana de contexto sin aviso: \"ventana\".");
  if (r.aviso && !B.avisos[r.aviso]) err(id, `aviso desconocido: ${r.aviso}`);
}

function revisar(r, heredado, id) {
  totalPasos++;
  const concepto = r.concepto || (heredado && heredado.concepto);
  const fuente = r.fuente || (heredado && heredado.fuente);
  if (!TIPOS.includes(r.tipo)) return err(id, `tipo desconocido: ${r.tipo}`);
  if (!r.enunciado && r.tipo !== "caso") err(id, "falta el enunciado.");
  if (!fuente) err(id, "falta la fuente.");
  if (!concepto) err(id, "falta el concepto.");
  else if (!conceptos.has(concepto)) err(id, `concepto inexistente: ${concepto}`);
  if (r.tipo !== "caso") {
    if (!r.explicacion || !r.explicacion.trim()) err(id, "falta la explicación.");
    else {
      if (r.explicacion.length > 330) warn(id, `explicación larga (${r.explicacion.length} caracteres).`);
      const frases = r.explicacion.split(/[.!?…](?:\s|$)/).filter(s => s.trim()).length;
      if (frases > 4) warn(id, `la explicación tiene ${frases} frases (máx. sugerido: 3).`);
    }
  }
  revisarContenido(id, r, heredado && heredado.aviso);

  switch (r.tipo) {
    case "opcion": {
      let ops;
      if (r.conjunto) {
        const c = B.conjuntos[r.conjunto];
        if (!c) return err(id, `conjunto inexistente: ${r.conjunto}`);
        ops = c.opciones.map(o => ({ texto: o.texto, correcta: o.id === r.correcta }));
      } else ops = r.opciones;
      if (!Array.isArray(ops) || ops.length < 2) return err(id, "necesita al menos 2 opciones.");
      const n = ops.filter(o => o.correcta === true).length;
      if (n !== 1) err(id, `debe tener exactamente 1 opción correcta (tiene ${n}).`);
      if (ops.some(o => !o.texto)) err(id, "hay opciones sin texto.");
      if (new Set(ops.map(o => o.texto)).size !== ops.length) err(id, "hay opciones repetidas.");
      break;
    }
    case "vf":
      if (typeof r.correcta !== "boolean") err(id, "vf necesita correcta: true o false.");
      break;
    case "clasificar":
      if (!Array.isArray(r.casillas) || r.casillas.length < 2) return err(id, "necesita al menos 2 casillas.");
      if (!Array.isArray(r.fichas) || r.fichas.length < 2) return err(id, "necesita al menos 2 fichas.");
      r.fichas.forEach(f => { if (!r.casillas.includes(f.casilla)) err(id, `ficha con casilla inexistente: ${f.casilla}`); });
      if (new Set(r.fichas.map(f => f.texto)).size !== r.fichas.length) err(id, "hay fichas repetidas.");
      break;
    case "ordenar":
      if (!Array.isArray(r.elementos) || r.elementos.length < 3) err(id, "necesita al menos 3 elementos.");
      else if (new Set(r.elementos.map(e => e.texto)).size !== r.elementos.length) err(id, "hay elementos repetidos (el orden no sería único).");
      break;
    case "marcar": {
      if (!Array.isArray(r.segmentos) || r.segmentos.length < 2) return err(id, "necesita al menos 2 segmentos.");
      const n = r.segmentos.filter(s => s.objetivo === true).length;
      if (n < 1) err(id, "debe haber al menos 1 segmento objetivo.");
      if (n === r.segmentos.length) err(id, "no todos los segmentos pueden ser objetivo.");
      if (r.segmentos.some(s => typeof s.objetivo !== "boolean")) err(id, "cada segmento necesita objetivo: true o false.");
      break;
    }
    case "insertar": {
      const h = (r.partes || []).filter(p => p.hueco);
      if (h.length < 2) err(id, "necesita al menos 2 huecos.");
      if (!(r.partes || []).some(p => p.texto)) err(id, "necesita bloques de texto.");
      break;
    }
    case "caso":
      if (!r.situacion) err(id, "el caso necesita una situación.");
      if (!Array.isArray(r.pasos) || !r.pasos.length) return err(id, "el caso necesita pasos.");
      totalPasos--; // el caso en sí no es un paso jugable
      r.pasos.forEach((p, i) => {
        if (p.tipo === "caso") return err(id, "un caso no puede contener otro caso.");
        revisar(p, { concepto, fuente, aviso: r.aviso }, `${id} · paso ${i + 1}`);
      });
      break;
  }
}

B.retos.forEach((r, i) => {
  const id = r.id || `reto #${i + 1}`;
  if (!r.id) err(id, "falta el id.");
  else if (ids.has(r.id)) err(id, "id repetido.");
  ids.add(r.id);
  if (!niveles.has(r.nivel)) err(id, `nivel inexistente: ${r.nivel}`);
  if (!r.grupo) err(id, "falta el grupo.");
  revisar(r, null, id);
});

// Cada grupo de la selección debe tener retos suficientes
B.niveles.forEach(n => n.seleccion.forEach(s => {
  const hay = B.retos.filter(r => r.nivel === n.id && r.grupo === s.grupo).length;
  if (hay < s.n) err(`nivel ${n.id}`, `el grupo «${s.grupo}» pide ${s.n} retos y solo hay ${hay}.`);
}));
B.retos.forEach(r => {
  const n = B.niveles.find(x => x.id === r.nivel);
  if (n && !n.seleccion.some(s => s.grupo === r.grupo)) warn(r.id, `el grupo «${r.grupo}» no está en la selección del nivel: nunca saldrá.`);
});

if (B.retos.length < 30) err("banco", `hay ${B.retos.length} retos; el mínimo es 30.`);

console.log(`Banco: ${B.retos.length} retos (${totalPasos} pasos jugables)`);
B.niveles.forEach(n => {
  const rs = B.retos.filter(r => r.nivel === n.id);
  const std = n.seleccion.reduce((a, s) => a + s.n, 0);
  console.log(`  ${String(n.etiqueta).padEnd(11)} ${String(rs.length).padStart(2)} retos en banco · ${std} por partida estándar`);
});
avisos.forEach(a => console.log(a));
if (errores.length) { errores.forEach(e => console.error(e)); console.error(`\n${errores.length} error(es).`); process.exit(1); }
console.log("\n✔ Banco válido: cada reto tiene respuesta correcta única, explicación y fuente.");
