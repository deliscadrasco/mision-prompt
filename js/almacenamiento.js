/* Persistencia: localStorage dentro de try/catch.
   Si el navegador lo bloquea, el juego sigue funcionando en memoria. */
(function (global) {
  "use strict";
  var MP = global.MP = global.MP || {};
  var CLAVE = "misionPrompt.v1";
  var memoria = {};
  var disponible = true;

  function cargar() {
    try {
      var crudo = global.localStorage.getItem(CLAVE);
      if (crudo) { memoria = JSON.parse(crudo) || {}; }
    } catch (e) { disponible = false; memoria = {}; }
  }
  function guardar() {
    if (!disponible) { return; }
    try { global.localStorage.setItem(CLAVE, JSON.stringify(memoria)); }
    catch (e) { disponible = false; }
  }
  cargar();

  MP.almacen = {
    leer: function (clave, porDefecto) {
      return Object.prototype.hasOwnProperty.call(memoria, clave) ? memoria[clave] : porDefecto;
    },
    escribir: function (clave, valor) { memoria[clave] = valor; guardar(); },
    borrar: function (clave) { delete memoria[clave]; guardar(); },
    persistente: function () { return disponible; }
  };
})(window);
