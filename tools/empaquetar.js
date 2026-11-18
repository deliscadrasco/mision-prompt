#!/usr/bin/env node
/* Genera "mision-prompt-un-solo-archivo.html": todo el juego en un único HTML,
   práctico para enviarlo por correo o chat.   Uso:  node tools/empaquetar.js
   Vuelve a ejecutarlo cada vez que edites data/preguntas.js. */
"use strict";
const fs = require("fs"), path = require("path");
const raiz = path.join(__dirname, "..");
const leer = f => fs.readFileSync(path.join(raiz, f), "utf8");
let html = leer("index.html");
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/, (_, f) => "<style>\n" + leer(f) + "\n</style>");
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => "<script>\n" + leer(f).replace(/<\/script/gi, "<\\/script") + "\n</script>");
const salida = path.join(raiz, "mision-prompt-un-solo-archivo.html");
fs.writeFileSync(salida, html);
console.log("Listo: " + path.basename(salida) + " (" + Math.round(fs.statSync(salida).size / 1024) + " KB)");
