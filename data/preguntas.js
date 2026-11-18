/* ==========================================================================
   MISIÓN PROMPT: SALA DE SELECCIÓN · Banco de retos
   Clase 1 · IA aplicada a Talento Humano
   --------------------------------------------------------------------------
   ESTE ES EL ÚNICO ARCHIVO QUE NECESITAS EDITAR PARA CAMBIAR EL CONTENIDO.
   Después de editar, valida con:   node tools/validar-banco.js

   TODO el contenido es ficticio y con fines didácticos. No escribas aquí
   artículos de ley, cifras salariales ni enlaces reales: usa marcadores
   evidentemente falsos ("Art. XX", "NN días", "ejemplo.com/ficticio").

   ESQUEMA DE UN RETO
   ------------------
   Campos comunes (obligatorios salvo que se indique):
     id          Texto único, p. ej. "n1-s01".
     nivel       1, 2, 3, 4, 5 o "jefe".
     grupo       Subgrupo dentro del nivel. Cada partida toma N retos de cada
                 grupo (ver "seleccion" en la lista de niveles).
     tipo        "opcion" | "vf" | "clasificar" | "ordenar" | "marcar" |
                 "insertar" | "caso"
     concepto    Id de la lista "conceptos" (alimenta el mapa final).
     fuente      Referencia al material de la clase, p. ej. "Prop. 2 · Conocimiento".
     enunciado   Lo que se le pregunta al jugador.
     explicacion Retroalimentación breve (máx. 2-3 frases).
     aviso       (opcional) Clave de "avisos". OBLIGATORIO "ventana" si el reto
                 muestra las cifras de ventana de contexto.

   Campos según el tipo:
     opcion      opciones: [{ texto, correcta: true|false, porque? }]
                 → exactamente UNA con correcta: true. "porque" explica por
                   qué falla una opción incorrecta (opcional).
                 Alternativa: conjunto: "<id de conjuntos>", correcta: "<id de opción>"
                 para reutilizar listas fijas (las 4 propiedades, etc.).
     vf          correcta: true | false   (true = "Verdadero")
     clasificar  casillas: ["ROL", ...], fichas: [{ texto, casilla }]
     ordenar     elementos: [{ texto, detalle? }]  escritos EN EL ORDEN CORRECTO
     marcar      segmentos: [{ texto, objetivo: true|false }]
                 presentacion: "texto" (frases seguidas) | "lista" | "fichas"
                 → el jugador debe marcar exactamente los que tienen objetivo: true
     insertar    partes: [{ hueco: "[INSTRUCCIÓN]" }, { texto: "..." }, ...]
                 → cada hueco indica el delimitador que va en ese lugar
     caso        situacion, rotulo?, pasos: [ retos de los tipos anteriores ]
                 Los pasos heredan concepto/fuente/aviso del caso si no los traen.
   ========================================================================== */

var BANCO = {

  titulo: "Misión Prompt: Sala de Selección",

  /* Reglas de puntaje y umbrales (editables) */
  config: {
    puntaje: {
      acierto: 100,          // puntos por acierto
      error: 20,             // penalización suave por error (nunca baja de 0)
      rachaPorAcierto: 10,   // bonus por cada acierto consecutivo adicional
      rachaMaximo: 50,       // tope del bonus de racha
      velocidad: [           // bonus opcional (solo si se activa en la configuración)
        { hastaSegundos: 10, bonus: 30 },
        { hastaSegundos: 20, bonus: 15 }
      ]
    },
    umbralDominio: 0.75      // % de aciertos para marcar un concepto como "Dominado"
  },

  avisos: {
    ventana: "Valores aproximados a julio de 2026. Estos límites cambian cada pocos meses: verifica siempre la documentación oficial."
  },

  reglaDeOro: "En Talento Humano, todo dato legal, salarial o de personas se verifica antes de usarse.",

  cierre: {
    frase: "Es más importante la pregunta que la respuesta.",
    preguntas: [
      "¿Cuál es el primer paso que darás mañana para aplicar lo aprendido?",
      "¿Cómo puedes impulsar este mindset en tu equipo y organización?",
      "¿Qué alianzas puedes construir para fortalecer tu impacto?"
    ],
    cita: "El trabajo no te lo quitará la IA, te lo quitará la persona que, usando la IA, podrá hacer un trabajo mejor que el tuyo.",
    autorCita: "Rafael Uribe, CEO Inwork Academy"
  },

  /* Conceptos de la clase (para el mapa del debrief) */
  conceptos: [
    { id: "prop-prediccion",   nombre: "Prop. 1 · Predicción del siguiente token" },
    { id: "prop-conocimiento", nombre: "Prop. 2 · Conocimiento" },
    { id: "prop-memoria",      nombre: "Prop. 3 · Memoria de trabajo" },
    { id: "prop-guiabilidad",  nombre: "Prop. 4 · Guiabilidad" },
    { id: "ecosistema",        nombre: "Ecosistema de asistentes" },
    { id: "elementos",         nombre: "Los 5 elementos del prompt" },
    { id: "metaprompt",        nombre: "Meta-prompt" },
    { id: "tokens",            nombre: "Tokens y ventana de contexto" },
    { id: "alucinaciones",     nombre: "Detección de alucinaciones" },
    { id: "frases",            nombre: "5 frases de uso responsable" },
    { id: "tecnicas",          nombre: "7 técnicas de veracidad" },
    { id: "delimitadores",     nombre: "Corchetes y delimitadores" },
    { id: "privacidad",        nombre: "Privacidad de las hojas de vida" },
    { id: "regla-oro",         nombre: "Regla de oro: verificar antes de usar" }
  ],

  /* Listas de opciones reutilizables */
  conjuntos: {
    propiedades: {
      opciones: [
        { id: "prediccion",   texto: "Predicción del siguiente token", detalle: "Genera texto prediciendo la palabra más probable." },
        { id: "conocimiento", texto: "Conocimiento",                   detalle: "Viene del entrenamiento y tiene fecha de corte." },
        { id: "memoria",      texto: "Memoria de trabajo",             detalle: "Solo recuerda la conversación activa." },
        { id: "guiabilidad",  texto: "Guiabilidad",                    detalle: "Sigue instrucciones: roles, formatos, restricciones, ejemplos." }
      ]
    },
    elementos: {
      opciones: [
        { id: "rol",      texto: "ROL" },
        { id: "tarea",    texto: "TAREA" },
        { id: "contexto", texto: "CONTEXTO" },
        { id: "formato",  texto: "FORMATO" },
        { id: "ejemplo",  texto: "EJEMPLO" }
      ]
    },
    hechos: {
      barajar: false,
      opciones: [
        { id: "hecho",       texto: "HECHO CONFIRMADO", detalle: "Alta certeza." },
        { id: "inferencia",  texto: "INFERENCIA",       detalle: "Deducido, pero no confirmable." },
        { id: "desconocido", texto: "DESCONOCIDO",      detalle: "No se tiene o pudo haber cambiado." }
      ]
    },
    confianza: {
      barajar: false,
      opciones: [
        { id: "alto",  texto: "[ALTO]",  detalle: "Muy seguro." },
        { id: "medio", texto: "[MEDIO]", detalle: "Probablemente correcto, pero con matices." },
        { id: "bajo",  texto: "[BAJO]",  detalle: "No seguro: verificar antes de usar." }
      ]
    }
  },

  /* Niveles. "seleccion" define cuántos retos de cada grupo entran en una
     partida estándar (n) y en una partida exprés (nExpres, opcional). */
  niveles: [
    { id: 1, titulo: "¿Qué propiedad es?", etiqueta: "Nivel 1",
      intro: "Primer día en Talentia S.A.S. Antes de cubrir vacantes, conoce a tu nueva colega: la IA. Relaciona cada situación con la propiedad que la explica.",
      insignia: "Intérprete de la IA",
      seleccion: [ { grupo: "situacion", n: 3 }, { grupo: "mito", n: 1 } ] },
    { id: 2, titulo: "Arma el prompt", etiqueta: "Nivel 2",
      intro: "Tu jefa quiere resultados hoy. Un buen prompt tiene 5 elementos: ROL, TAREA, CONTEXTO, FORMATO y EJEMPLO. A armarlo.",
      insignia: "Maestro de los 5 elementos",
      seleccion: [ { grupo: "armar", n: 1 }, { grupo: "diagnostico", n: 1 }, { grupo: "meta", n: 1 }, { grupo: "elemento", n: 1, nExpres: 0 } ] },
    { id: 3, titulo: "Tokens y ventana de contexto", etiqueta: "Nivel 3",
      intro: "¿Cuánto texto le cabe a la IA? Menos misterio y más claridad: cuatro retos rápidos sobre tokens.",
      insignia: "Contador de tokens",
      seleccion: [ { grupo: "token", n: 1 }, { grupo: "orden", n: 1 }, { grupo: "ventana", n: 1, nExpres: 0 }, { grupo: "claridad", n: 1 } ] },
    { id: 4, titulo: "Detector de alucinaciones", etiqueta: "Nivel 4",
      intro: "La IA también se equivoca… con mucha seguridad. Todas las respuestas de IA de este nivel son INVENTADAS con fines didácticos: encuentra lo sospechoso.",
      insignia: "Cazador de alucinaciones",
      seleccion: [ { grupo: "caso", n: 2, nExpres: 1 }, { grupo: "tecnica", n: 1 } ] },
    { id: 5, titulo: "Corchetes y privacidad", etiqueta: "Nivel 5",
      intro: "Llegaron las hojas de vida. Ordena el prompt con delimitadores y protege los datos personales antes de subir nada.",
      insignia: "Guardián de la privacidad",
      seleccion: [ { grupo: "insertar", n: 1 }, { grupo: "cv", n: 1 }, { grupo: "concepto", n: 2, nExpres: 1 } ] },
    { id: "jefe", titulo: "Caso integrador", etiqueta: "Jefe final",
      intro: "La vacante más importante del mes: Coordinador/a de RR. HH. en Talentia S.A.S. Tres decisiones encadenadas. Usa todo lo aprendido.",
      insignia: "Estratega del caso",
      seleccion: [ { grupo: "jefe", n: 1 } ] }
  ],

  /* Rangos finales según el porcentaje de aciertos (de mayor a menor) */
  rangos: [
    { desde: 0.90, nombre: "Estratega de Talento Humano con IA" },
    { desde: 0.70, nombre: "Especialista en prompts" },
    { desde: 0.45, nombre: "Analista con criterio" },
    { desde: 0,    nombre: "Aprendiz de prompts" }
  ],
  umbralInsignia: 0.8,   // % de aciertos en el nivel para ganar su insignia

  retos: [

    /* =====================================================================
       NIVEL 1 · ¿QUÉ PROPIEDAD ES?
       ===================================================================== */
    { id: "n1-s01", nivel: 1, grupo: "situacion", tipo: "opcion", concepto: "prop-conocimiento", fuente: "Prop. 2 · Conocimiento",
      enunciado: "Le preguntas a la IA «¿cuál es el salario mínimo vigente?» sin darle tú el dato, y copias la cifra en una oferta. ¿Qué propiedad estás olvidando?",
      conjunto: "propiedades", correcta: "conocimiento",
      explicacion: "Lo que sabe viene del entrenamiento y tiene fecha de corte. Dale tú el dato actualizado y pídele que lo analice: convierte una limitación en una ventaja." },

    { id: "n1-s02", nivel: 1, grupo: "situacion", tipo: "opcion", concepto: "prop-memoria", fuente: "Prop. 3 · Memoria de trabajo",
      enunciado: "Abres un chat nuevo y escribes: «Continúa con la candidata de ayer». La IA no tiene idea de quién hablas. ¿Qué propiedad lo explica?",
      conjunto: "propiedades", correcta: "memoria",
      explicacion: "Solo recuerda lo que está en la conversación activa; al cerrarla, se reinicia. No asumas que «ya sabe»: vuelve a darle el perfil." },

    { id: "n1-s03", nivel: 1, grupo: "situacion", tipo: "opcion", concepto: "prop-prediccion", fuente: "Prop. 1 · Predicción del siguiente token",
      enunciado: "Empiezas tu prompt con «Actúa como especialista en reclutamiento senior de una empresa de 500 colaboradores…» y el resultado mejora muchísimo. ¿Qué propiedad aprovechaste?",
      conjunto: "propiedades", correcta: "prediccion",
      explicacion: "El inicio del prompt orienta qué tipo de texto se predice. Empezar bien es empezar ganando." },

    { id: "n1-s04", nivel: 1, grupo: "situacion", tipo: "opcion", concepto: "prop-guiabilidad", fuente: "Prop. 4 · Guiabilidad",
      enunciado: "Pides: «Entrégalo en una tabla de 3 columnas» y lo recibes exactamente así. ¿Qué propiedad lo hace posible?",
      conjunto: "propiedades", correcta: "guiabilidad",
      explicacion: "La IA está diseñada para seguir instrucciones: responde a roles, formatos, restricciones y ejemplos. Tu prompt es el «brief de consultoría»." },

    { id: "n1-s05", nivel: 1, grupo: "situacion", tipo: "opcion", concepto: "prop-conocimiento", fuente: "Prop. 2 · Conocimiento",
      enunciado: "Le pides a la IA la jurisprudencia más reciente sobre un tema laboral, sin compartirle ningún documento. ¿Qué propiedad te debería frenar?",
      conjunto: "propiedades", correcta: "conocimiento",
      explicacion: "No sabe lo que pasó después de su fecha de corte. Nunca pidas leyes o jurisprudencia recientes sin dárselas tú primero." },

    { id: "n1-s06", nivel: 1, grupo: "situacion", tipo: "opcion", concepto: "prop-memoria", fuente: "Prop. 3 · Memoria de trabajo",
      enunciado: "Ayer le compartiste a la IA el perfil del cargo. Hoy, en otra conversación, le pides preguntas de entrevista «para ese cargo» y salen genéricas. ¿Qué propiedad lo explica?",
      conjunto: "propiedades", correcta: "memoria",
      explicacion: "La ventana de contexto es su memoria de trabajo. En cada conversación incluye todo el contexto relevante: cargo, situación y datos del caso." },

    { id: "n1-s07", nivel: 1, grupo: "situacion", tipo: "opcion", concepto: "prop-guiabilidad", fuente: "Prop. 4 · Guiabilidad",
      enunciado: "Le indicas: «No uses más de 150 palabras y evita tecnicismos», y lo cumple. ¿Qué propiedad estás usando?",
      conjunto: "propiedades", correcta: "guiabilidad",
      explicacion: "Seguir restricciones es guiabilidad, el fundamento del prompt engineering. Entre más claro el brief, mejor el resultado." },

    { id: "n1-s08", nivel: 1, grupo: "situacion", tipo: "opcion", concepto: "prop-prediccion", fuente: "Prop. 1 · Predicción del siguiente token",
      enunciado: "Tu prompt arranca con «Oye, una cosita sobre candidatos…» y la IA responde con un texto genérico. ¿Qué propiedad explica que el arranque del prompt pese tanto?",
      conjunto: "propiedades", correcta: "prediccion",
      explicacion: "La IA predice el texto más probable a partir de lo que recibe. Si el inicio no trae rol ni contexto, lo más probable es… algo genérico." },

    { id: "n1-m01", nivel: 1, grupo: "mito", tipo: "vf", concepto: "prop-prediccion", fuente: "Prop. 1 · Predicción del siguiente token",
      enunciado: "¿Verdadero o falso? «La IA razona igual que una persona.»",
      correcta: false,
      explicacion: "Genera texto prediciendo la palabra más probable: es estadística masiva, no razonamiento humano." },

    { id: "n1-m02", nivel: 1, grupo: "mito", tipo: "vf", concepto: "prop-memoria", fuente: "Prop. 3 · Memoria de trabajo",
      enunciado: "¿Verdadero o falso? «La IA recuerda mis chats anteriores aunque abra uno nuevo.»",
      correcta: false,
      explicacion: "Solo recuerda lo que está en la conversación activa. Si ayer compartiste el perfil del candidato, hoy debes volver a darlo." },

    { id: "n1-m03", nivel: 1, grupo: "mito", tipo: "vf", concepto: "prop-prediccion", fuente: "Prop. 1 · Predicción del siguiente token",
      enunciado: "¿Verdadero o falso? «Empezar el prompt con el rol y el contexto correctos orienta el tipo de texto que la IA va a generar.»",
      correcta: true,
      explicacion: "El inicio del prompt guía la predicción. Empezar bien es empezar ganando." },

    { id: "n1-m04", nivel: 1, grupo: "mito", tipo: "vf", concepto: "prop-conocimiento", fuente: "Prop. 2 · Conocimiento",
      enunciado: "¿Verdadero o falso? «La IA sabe todo lo que ha pasado hasta el día de hoy.»",
      correcta: false,
      explicacion: "Su conocimiento viene del entrenamiento y tiene una fecha de corte: no sabe lo que pasó después." },

    { id: "n1-m05", nivel: 1, grupo: "mito", tipo: "vf", concepto: "ecosistema", fuente: "Las 4 propiedades · Ecosistema",
      enunciado: "¿Verdadero o falso? «Lo que aprendo sobre prompts con un asistente no me sirve con otro: hay que empezar de cero.»",
      correcta: false,
      explicacion: "Las 4 propiedades aplican a Claude, ChatGPT, Copilot, Gemini y demás. Lo aprendido se transfiere; lo que cambia es la integración." },

    /* =====================================================================
       NIVEL 2 · ARMA EL PROMPT
       ===================================================================== */
    { id: "n2-a01", nivel: 2, grupo: "armar", tipo: "clasificar", concepto: "elementos", fuente: "Los 5 elementos del prompt",
      enunciado: "Vacante: Analista de Nómina. Lleva cada fragmento a la casilla del elemento que le corresponde.",
      casillas: ["ROL", "TAREA", "CONTEXTO", "FORMATO", "EJEMPLO"],
      fichas: [
        { texto: "Actúa como un especialista en reclutamiento senior.", casilla: "ROL" },
        { texto: "Redacta la oferta de empleo para el cargo de Analista de Nómina.", casilla: "TAREA" },
        { texto: "Talentia S.A.S. tiene 500 colaboradores y el cargo reporta a Gestión Humana.", casilla: "CONTEXTO" },
        { texto: "Entrégala en menos de 200 palabras.", casilla: "FORMATO" },
        { texto: "Guíate por esta oferta anterior: «Buscamos a alguien que disfrute los números…»", casilla: "EJEMPLO" }
      ],
      explicacion: "El ROL dice quién es la IA; la TAREA, qué debe hacer; el CONTEXTO da la información de fondo; el FORMATO, cómo quieres la respuesta; y el EJEMPLO muestra el resultado esperado." },

    { id: "n2-a02", nivel: 2, grupo: "armar", tipo: "clasificar", concepto: "elementos", fuente: "Los 5 elementos del prompt",
      enunciado: "Entrevistas para Coordinador de RR. HH. Lleva cada fragmento a su casilla.",
      casillas: ["ROL", "TAREA", "CONTEXTO", "FORMATO", "EJEMPLO"],
      fichas: [
        { texto: "Eres un entrevistador experto en selección por competencias.", casilla: "ROL" },
        { texto: "Evalúa las respuestas de la entrevista que te comparto.", casilla: "TAREA" },
        { texto: "La vacante es de Coordinador de RR. HH. y el equipo trabaja en modalidad híbrida.", casilla: "CONTEXTO" },
        { texto: "Responde en una tabla con una fila por competencia.", casilla: "FORMATO" },
        { texto: "Así se ve una fila bien hecha: «Comunicación | 4 | Explica con claridad».", casilla: "EJEMPLO" }
      ],
      explicacion: "Un prompt completo responde cinco preguntas: quién es la IA, qué debe hacer, con qué información, en qué formato y cómo se ve un buen resultado." },

    { id: "n2-a03", nivel: 2, grupo: "armar", tipo: "clasificar", concepto: "elementos", fuente: "Los 5 elementos del prompt",
      enunciado: "Encuesta de capacitación. Lleva cada fragmento a su casilla.",
      casillas: ["ROL", "TAREA", "CONTEXTO", "FORMATO", "EJEMPLO"],
      fichas: [
        { texto: "Actúa como consultor de formación y desarrollo.", casilla: "ROL" },
        { texto: "Resume los resultados de la encuesta de capacitación.", casilla: "TAREA" },
        { texto: "Respondieron 40 personas del área comercial después de un taller de dos días.", casilla: "CONTEXTO" },
        { texto: "Preséntalo en 5 puntos.", casilla: "FORMATO" },
        { texto: "Sigue el estilo de este punto de muestra: «1. Lo más valorado fue…»", casilla: "EJEMPLO" }
      ],
      explicacion: "La TAREA lleva verbos de acción (redacta, analiza, resume, evalúa). El EJEMPLO es opcional, pero muy poderoso." },

    { id: "n2-d01", nivel: 2, grupo: "diagnostico", tipo: "caso", concepto: "elementos", fuente: "Los 5 elementos del prompt",
      titulo: "Diagnóstico de un prompt débil",
      etiquetaSituacion: "Prompt recibido",
      situacion: "«Hazme un resumen de candidatos»",
      pasos: [
        { tipo: "marcar", presentacion: "fichas",
          enunciado: "¿Qué elementos NO aparecen en este prompt? Marca todos los que falten.",
          segmentos: [
            { texto: "ROL", objetivo: true },
            { texto: "TAREA", objetivo: false },
            { texto: "CONTEXTO", objetivo: true },
            { texto: "FORMATO", objetivo: true },
            { texto: "EJEMPLO", objetivo: true }
          ],
          explicacion: "Solo hay una tarea, y vaga. Faltan rol, contexto y formato; el ejemplo es opcional, pero muy poderoso." },
        { tipo: "opcion",
          enunciado: "¿Cuál es la mejor versión mejorada?",
          opciones: [
            { texto: "Actúa como especialista en reclutamiento senior. Resume en una tabla (candidato, fortalezas, brechas) los 3 perfiles que te pego abajo, para la vacante de Analista de Selección de una empresa de 500 colaboradores.", correcta: true },
            { texto: "Hazme un resumen MUY bueno y detallado de candidatos, por favor, que es urgente.", correcta: false, porque: "Más énfasis no es más claridad: siguen faltando rol, contexto y formato." },
            { texto: "Resume candidatos en una tabla.", correcta: false, porque: "Ganó formato, pero sigue sin rol ni contexto: ¿qué candidatos?, ¿para qué cargo?" }
          ],
          explicacion: "La versión ganadora tiene rol, tarea con verbo de acción, contexto (vacante y empresa) y formato (tabla)." }
      ] },

    { id: "n2-d02", nivel: 2, grupo: "diagnostico", tipo: "caso", concepto: "elementos", fuente: "Los 5 elementos del prompt",
      titulo: "Diagnóstico de un prompt débil",
      etiquetaSituacion: "Prompt recibido",
      situacion: "«Actúa como experto en selección y dame preguntas de entrevista»",
      pasos: [
        { tipo: "marcar", presentacion: "fichas",
          enunciado: "¿Qué elementos NO aparecen en este prompt? Marca todos los que falten.",
          segmentos: [
            { texto: "ROL", objetivo: false },
            { texto: "TAREA", objetivo: false },
            { texto: "CONTEXTO", objetivo: true },
            { texto: "FORMATO", objetivo: true },
            { texto: "EJEMPLO", objetivo: true }
          ],
          explicacion: "Tiene rol y tarea, pero no dice para qué cargo ni empresa (contexto) ni cómo entregar las preguntas (formato). Tampoco trae ejemplo." },
        { tipo: "opcion",
          enunciado: "¿Cuál es la mejor versión mejorada?",
          opciones: [
            { texto: "Actúa como experto en selección. Redacta 5 preguntas de entrevista por competencias para la vacante de Coordinador de RR. HH. de Talentia S.A.S. (equipo de 8 personas, modalidad híbrida). Entrégalas en una lista numerada e indica qué competencia evalúa cada una.", correcta: true },
            { texto: "Actúa como el mejor experto en selección del mundo y dame preguntas de entrevista excelentes.", correcta: false, porque: "Inflar el rol no agrega contexto ni formato." },
            { texto: "Dame 5 preguntas de entrevista en una lista numerada.", correcta: false, porque: "Ganó formato, pero perdió el rol y sigue sin contexto." }
          ],
          explicacion: "Suma contexto (cargo, empresa, equipo) y formato (lista numerada) sin perder el rol ni la tarea." }
      ] },

    { id: "n2-m01", nivel: 2, grupo: "meta", tipo: "opcion", concepto: "metaprompt", fuente: "Práctica 1 · Meta-prompt",
      enunciado: "Quieres que la IA te ayude a comparar candidatos usando un meta-prompt. ¿Cuál de estas opciones lo es?",
      opciones: [
        { texto: "Actúa como experto en prompt engineering y context engineering. Crea el prompt que debo usar para comparar candidatos para una vacante.", correcta: true },
        { texto: "Compara a estos candidatos y dime cuál es el mejor.", correcta: false, porque: "Eso pide la tarea directamente; no le pide a la IA crear el prompt." },
        { texto: "Dame un prompt bueno.", correcta: false, porque: "Pide un prompt, pero sin rol de experto ni propósito." }
      ],
      explicacion: "En un meta-prompt la IA actúa como experta en prompt engineering y context engineering para que ella cree el prompt." },

    { id: "n2-m02", nivel: 2, grupo: "meta", tipo: "opcion", concepto: "metaprompt", fuente: "Práctica 1 · Meta-prompt",
      enunciado: "La IA ya te entregó el prompt que creó a partir de tu meta-prompt. ¿Cuál es el siguiente paso?",
      opciones: [
        { texto: "Revisar si el prompt resultante tiene rol, tarea, contexto y formato.", correcta: true },
        { texto: "Usarlo de inmediato: si lo escribió la IA, seguro está completo.", correcta: false, porque: "El criterio sigue siendo tuyo: hay que revisar el resultado." },
        { texto: "Pedirle un meta-prompt para revisar el meta-prompt… y así hasta el viernes.", correcta: false, porque: "Basta con revisarlo tú contra los elementos del prompt." }
      ],
      explicacion: "Después del meta-prompt se revisa si el prompt resultante tiene rol, tarea, contexto y formato." },

    { id: "n2-e01", nivel: 2, grupo: "elemento", tipo: "opcion", concepto: "elementos", fuente: "Los 5 elementos · Formato",
      enunciado: "«En una tabla», «en 5 puntos», «en menos de 200 palabras». ¿A qué elemento del prompt corresponden?",
      conjunto: "elementos", correcta: "formato",
      explicacion: "El FORMATO responde a «¿cómo quieres la respuesta?»." },

    { id: "n2-e02", nivel: 2, grupo: "elemento", tipo: "opcion", concepto: "elementos", fuente: "Los 5 elementos · Tarea",
      enunciado: "¿Cuál de estas TAREAS está mejor formulada?",
      opciones: [
        { texto: "Redacta 3 mensajes de invitación a entrevista para la vacante de Analista.", correcta: true },
        { texto: "Algo sobre entrevistas.", correcta: false, porque: "No hay verbo de acción ni resultado concreto." },
        { texto: "Ayúdame con lo de la vacante.", correcta: false, porque: "«Ayúdame con lo de…» no dice qué debe hacer la IA." }
      ],
      explicacion: "La tarea debe ser específica y usar verbos de acción: redacta, analiza, resume, evalúa." },

    { id: "n2-e03", nivel: 2, grupo: "elemento", tipo: "opcion", concepto: "elementos", fuente: "Los 5 elementos · Ejemplo",
      enunciado: "¿Cuál de los 5 elementos es opcional, pero muy poderoso?",
      conjunto: "elementos", correcta: "ejemplo",
      explicacion: "Mostrar un EJEMPLO del resultado esperado es opcional, pero muy poderoso." },

    { id: "n2-e04", nivel: 2, grupo: "elemento", tipo: "opcion", concepto: "elementos", fuente: "Los 5 elementos · Rol",
      enunciado: "«Actúa como un especialista en reclutamiento senior…». ¿Qué elemento del prompt es?",
      conjunto: "elementos", correcta: "rol",
      explicacion: "El ROL responde a «¿quién es la IA en este contexto?»." },

    /* =====================================================================
       NIVEL 3 · TOKENS Y VENTANA DE CONTEXTO
       ===================================================================== */
    { id: "n3-t01", nivel: 3, grupo: "token", tipo: "opcion", concepto: "tokens", fuente: "Tokens y ventana de contexto",
      enunciado: "En general, ¿1 token equivale aproximadamente a…?",
      opciones: [
        { texto: "3-4 caracteres", correcta: true },
        { texto: "1 carácter exacto", correcta: false, porque: "Un token no es un carácter." },
        { texto: "1 página completa", correcta: false },
        { texto: "1 párrafo", correcta: false }
      ],
      explicacion: "Un token no es un carácter: en general, 1 token ≈ 3-4 caracteres." },

    { id: "n3-t02", nivel: 3, grupo: "token", tipo: "vf", concepto: "tokens", fuente: "Tokens y ventana de contexto",
      enunciado: "¿Verdadero o falso? «Un token es lo mismo que un carácter.»",
      correcta: false,
      explicacion: "Un token no es un carácter: en general, 1 token ≈ 3-4 caracteres." },

    { id: "n3-o01", nivel: 3, grupo: "orden", tipo: "ordenar", concepto: "tokens", fuente: "Tokens y ventana de contexto", aviso: "ventana",
      enunciado: "Ordena de MENOR a MAYOR la ventana de contexto de estos asistentes gratuitos, según los valores de referencia del curso.",
      elementos: [
        { texto: "ChatGPT gratuito", detalle: "~16 mil tokens" },
        { texto: "Claude gratuito", detalle: "~200 mil tokens" },
        { texto: "Gemini gratuito", detalle: "~1 millón de tokens" }
      ],
      ocultarDetalleHastaResponder: true,
      explicacion: "Referencia del curso: ChatGPT gratuito ~16 mil, Claude gratuito ~200 mil, Gemini gratuito ~1 millón de tokens. Son aproximados y cambian cada pocos meses." },

    { id: "n3-v01", nivel: 3, grupo: "ventana", tipo: "opcion", concepto: "tokens", fuente: "Tokens y ventana de contexto",
      enunciado: "¿Qué es la ventana de contexto?",
      opciones: [
        { texto: "El máximo de texto que se puede enviar y recibir en una conversación, medido en tokens.", correcta: true },
        { texto: "El número de chats que puedes abrir al día.", correcta: false },
        { texto: "El tiempo que tarda la IA en responder.", correcta: false }
      ],
      explicacion: "La ventana de contexto se mide en tokens: es el máximo de texto que se puede enviar y recibir en una conversación." },

    { id: "n3-v02", nivel: 3, grupo: "ventana", tipo: "vf", concepto: "tokens", fuente: "Tokens y ventana de contexto",
      enunciado: "¿Verdadero o falso? «La ventana de contexto se mide en tokens.»",
      correcta: true,
      explicacion: "Sí: es el máximo de texto, medido en tokens, que se puede enviar y recibir en una conversación." },

    { id: "n3-v03", nivel: 3, grupo: "ventana", tipo: "opcion", concepto: "tokens", fuente: "Tokens y ventana de contexto", aviso: "ventana",
      enunciado: "Los valores de referencia del curso son ~16 mil, ~200 mil y ~1 millón de tokens. ¿Qué debes tener presente sobre esas cifras?",
      opciones: [
        { texto: "Cambian cada pocos meses: hay que verificar siempre la documentación oficial.", correcta: true },
        { texto: "Son fijas: una vez aprendidas, no cambian.", correcta: false, porque: "Estos límites cambian cada pocos meses." },
        { texto: "Son iguales para todos los asistentes.", correcta: false, porque: "Cada asistente tiene su propia ventana." }
      ],
      explicacion: "Son valores aproximados a julio de 2026 y cambian cada pocos meses. La fuente confiable es la documentación oficial de cada asistente." },

    { id: "n3-v04", nivel: 3, grupo: "ventana", tipo: "opcion", concepto: "tokens", fuente: "Tokens y ventana de contexto", aviso: "ventana",
      enunciado: "Según los valores de referencia del curso, ¿cuál de estos asistentes gratuitos tiene la ventana de contexto más amplia?",
      opciones: [
        { texto: "Gemini gratuito", correcta: true },
        { texto: "Claude gratuito", correcta: false },
        { texto: "ChatGPT gratuito", correcta: false }
      ],
      explicacion: "Referencia del curso: Gemini gratuito ~1 millón de tokens, Claude gratuito ~200 mil y ChatGPT gratuito ~16 mil. Verifícalo siempre en la documentación oficial." },

    { id: "n3-c01", nivel: 3, grupo: "claridad", tipo: "opcion", concepto: "tokens", fuente: "Tokens y ventana de contexto · Idea clave",
      enunciado: "¿Cuál suele ser hoy el verdadero problema con los prompts largos?",
      opciones: [
        { texto: "La claridad, no el espacio.", correcta: true },
        { texto: "Que no caben: las ventanas actuales son muy pequeñas.", correcta: false, porque: "Con las ventanas actuales, el espacio casi nunca es el problema." },
        { texto: "Que a la IA le da pereza leer tanto.", correcta: false, porque: "Ojalá fuera tan humana… pero no: el reto es la claridad." }
      ],
      explicacion: "Con las ventanas actuales el problema casi nunca es el espacio, es la claridad." },

    { id: "n3-c02", nivel: 3, grupo: "claridad", tipo: "opcion", concepto: "tokens", fuente: "Tokens y ventana de contexto · Idea clave",
      enunciado: "Pegaste el perfil del cargo y tres hojas de vida en un solo prompt y la respuesta salió confusa. ¿Qué es lo más probable?",
      opciones: [
        { texto: "Falta claridad: hay que organizar mejor las instrucciones y el contenido.", correcta: true },
        { texto: "Se acabó el espacio: hay que borrar las hojas de vida.", correcta: false, porque: "Con las ventanas actuales, el espacio casi nunca es el problema." },
        { texto: "Hay que escribirlo todo en MAYÚSCULAS para que entienda.", correcta: false, porque: "Gritar no aclara: organizar sí." }
      ],
      explicacion: "Con las ventanas actuales el problema casi nunca es el espacio, es la claridad." },

    /* =====================================================================
       NIVEL 4 · DETECTOR DE ALUCINACIONES
       Todas las "respuestas de IA" son inventadas. Usa siempre marcadores
       evidentemente ficticios (Art. XX, NN, XXXX, ejemplo.com/ficticio).
       ===================================================================== */
    { id: "n4-c01", nivel: 4, grupo: "caso", tipo: "caso", concepto: "alucinaciones", fuente: "Uso responsable · Evitar alucinaciones y verificar",
      titulo: "Caso: el artículo fantasma",
      etiquetaSituacion: "Consulta del analista",
      situacion: "«¿Cuánto puede durar el periodo de prueba de un analista?» (No se le compartió ninguna norma.)",
      rotulo: "Respuesta de IA inventada con fines didácticos. Ninguna referencia es real.",
      pasos: [
        { tipo: "marcar", presentacion: "texto",
          enunciado: "Toca la frase sospechosa: la que trae datos específicos que la IA no puede respaldar.",
          segmentos: [
            { texto: "El periodo de prueba sirve para que ambas partes evalúen si la relación laboral funciona.", objetivo: false },
            { texto: "Según el Art. XX del Código Ficticio del Trabajo, su duración máxima es de NN días.", objetivo: true },
            { texto: "Si quieres, te ayudo a redactar un mensaje para explicárselo al candidato.", objetivo: false }
          ],
          explicacion: "Un artículo con número y un plazo exacto, sin que le hayas dado la norma, es una señal de alerta: puede ser una alucinación." },
        { tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 2 · Separar hechos de inferencias",
          enunciado: "¿Cómo clasificas la afirmación «Según el Art. XX… su duración máxima es de NN días»?",
          conjunto: "hechos", correcta: "desconocido",
          explicacion: "La IA no recibió la norma y las leyes pueden cambiar después de su fecha de corte: es DESCONOCIDO hasta verificarlo en la fuente oficial." },
        { tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 5 · Escala de confianza explícita",
          enunciado: "¿Qué nivel de confianza merece esa afirmación?",
          conjunto: "confianza", correcta: "bajo",
          explicacion: "[BAJO]: no seguro, verificar antes de usar. Un dato legal sin fuente nunca pasa directo a un documento." },
        { tipo: "opcion", concepto: "frases", fuente: "Frase 2 · No inventes cifras ni artículos de ley",
          enunciado: "¿Qué instrucción en el prompt habría evitado el problema?",
          opciones: [
            { texto: "«No inventes cifras, estadísticas ni artículos de ley. Si no sabes el dato exacto, indica que se debe verificar con la fuente oficial.»", correcta: true },
            { texto: "«Cita siempre el número exacto del artículo.»", correcta: false, porque: "Exigir un número sin darle la norma invita a inventarlo." },
            { texto: "«Responde con total seguridad y sin rodeos.»", correcta: false, porque: "Pedir seguridad no da certeza: solo esconde la duda." }
          ],
          explicacion: "Es la frase 2 de uso responsable: prohíbe inventar cifras y artículos, y remite a la fuente oficial." }
      ] },

    { id: "n4-c02", nivel: 4, grupo: "caso", tipo: "caso", concepto: "alucinaciones", fuente: "Uso responsable · Evitar alucinaciones y verificar",
      titulo: "Caso: la estadística perfecta",
      etiquetaSituacion: "Consulta del analista",
      situacion: "«Dame argumentos para proponer el uso de IA en selección.»",
      rotulo: "Respuesta de IA inventada con fines didácticos. La cifra y el enlace no existen.",
      pasos: [
        { tipo: "marcar", presentacion: "texto",
          enunciado: "Toca las 2 frases sospechosas.",
          segmentos: [
            { texto: "Usar IA puede ayudar a ahorrar tiempo en tareas repetitivas, como redactar ofertas.", objetivo: false },
            { texto: "El 73,4 % de las empresas ya selecciona personal con IA.", objetivo: true },
            { texto: "Puedes consultarlo en www.ejemplo.com/ficticio/informe-seleccion.", objetivo: true },
            { texto: "Conviene empezar con un piloto pequeño y medir los resultados.", objetivo: false }
          ],
          explicacion: "Una estadística tan precisa sin fuente y un enlace que nadie ha abierto son sospechosos clásicos: la IA puede inventar cifras y URLs." },
        { tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 2 · Separar hechos de inferencias",
          enunciado: "Ahora mira otra frase: «Usar IA puede ayudar a ahorrar tiempo en tareas repetitivas». ¿Cómo la clasificas?",
          conjunto: "hechos", correcta: "inferencia",
          explicacion: "Es razonable, pero es una deducción general que no está confirmada con datos de tu empresa: INFERENCIA." },
        { tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 5 · Escala de confianza explícita",
          enunciado: "¿Y qué nivel de confianza le pondrías a esa inferencia?",
          conjunto: "confianza", correcta: "medio",
          explicacion: "[MEDIO]: probablemente correcto, pero con matices. Por eso conviene el piloto: para confirmarlo con tus propios datos." },
        { tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 4 · Citar fuentes de forma responsable",
          enunciado: "¿Qué instrucción habría evitado la cifra y el enlace inventados?",
          opciones: [
            { texto: "«Cita solo fuentes que conozcas con alta confianza. No inventes títulos, URLs, autores ni años.»", correcta: true },
            { texto: "«Incluye siempre un porcentaje y un enlace para que suene más convincente.»", correcta: false, porque: "Eso empuja a la IA a fabricar justo lo que queremos evitar." },
            { texto: "«Responde en formato de tabla.»", correcta: false, porque: "El formato ordena la respuesta, pero no la vuelve veraz." }
          ],
          explicacion: "Técnica 4: citar solo fuentes conocidas con alta confianza; si no recuerda los detalles, describir de forma general el origen." }
      ] },

    { id: "n4-c03", nivel: 4, grupo: "caso", tipo: "caso", concepto: "alucinaciones", fuente: "Uso responsable · Evitar alucinaciones y verificar",
      titulo: "Caso: el estudio que nadie encuentra",
      etiquetaSituacion: "Consulta del analista",
      situacion: "«¿Las entrevistas estructuradas son mejores?»",
      rotulo: "Respuesta de IA inventada con fines didácticos. El estudio, los autores y la revista no existen.",
      pasos: [
        { tipo: "marcar", presentacion: "texto",
          enunciado: "Toca las 2 frases sospechosas.",
          segmentos: [
            { texto: "En una entrevista estructurada se hacen las mismas preguntas a todos los candidatos.", objetivo: false },
            { texto: "Un estudio de Pérez-Inventado y Ficticia (año XXXX) demostró que son tres veces más efectivas.", objetivo: true },
            { texto: "El hallazgo se publicó en la Revista Imaginaria de Selección, volumen 00.", objetivo: true },
            { texto: "Puedo ayudarte a diseñar una guía de entrevista para tu vacante.", objetivo: false }
          ],
          explicacion: "Autores, año, revista y un resultado redondo: mucho detalle específico y ninguna forma de comprobarlo. Podría estar confabulando." },
        { tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 2 · Separar hechos de inferencias",
          enunciado: "¿Cómo clasificas «un estudio de Pérez-Inventado y Ficticia demostró que son tres veces más efectivas»?",
          conjunto: "hechos", correcta: "desconocido",
          explicacion: "No hay evidencia de que el estudio exista: es DESCONOCIDO mientras no lo encuentres tú en una fuente real." },
        { tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 5 · Escala de confianza explícita",
          enunciado: "¿Qué nivel de confianza merece ese «estudio»?",
          conjunto: "confianza", correcta: "bajo",
          explicacion: "[BAJO]: no seguro, verificar antes de usar. Si lo citas en una presentación, la que queda mal eres tú, no la IA." },
        { tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 6 · Pausa y revisión",
          enunciado: "¿Qué instrucción habría frenado esa cita antes de que llegara a tu pantalla?",
          opciones: [
            { texto: "«Antes de tu respuesta final, revísala y elimina o marca como “verificar” todo dato específico (número, nombre propio, fecha, URL) del que no estés seguro.»", correcta: true },
            { texto: "«Agrega autores y años para dar más credibilidad.»", correcta: false, porque: "Pedir autores y años a toda costa invita a inventarlos." },
            { texto: "«Responde rápido, sin revisar.»", correcta: false, porque: "Justo lo contrario de la técnica de pausa y revisión." }
          ],
          explicacion: "Técnica 6, pausa y revisión: antes de responder, eliminar o marcar como «verificar» los datos específicos dudosos." }
      ] },

    { id: "n4-c04", nivel: 4, grupo: "caso", tipo: "caso", concepto: "alucinaciones", fuente: "Uso responsable · Evitar alucinaciones y verificar",
      titulo: "Caso: la directora de siempre",
      etiquetaSituacion: "Consulta del analista",
      situacion: "«¿A quién dirijo la carta para la Dirección de Gestión Humana de Empresa Inventada S.A.?»",
      rotulo: "Respuesta de IA inventada con fines didácticos. La empresa y la persona no existen.",
      pasos: [
        { tipo: "marcar", presentacion: "texto",
          enunciado: "Toca las 2 frases sospechosas.",
          segmentos: [
            { texto: "Puedes dirigir la carta a la Dirección de Gestión Humana de la empresa.", objetivo: false },
            { texto: "La actual directora es la señora Fulana de Tal Ejemplo.", objetivo: true },
            { texto: "Ocupa el cargo desde hace exactamente NN años.", objetivo: true },
            { texto: "Te recomiendo un saludo formal y un asunto claro.", objetivo: false }
          ],
          explicacion: "Quién ocupa un cargo es un dato que cambia. La IA no puede saber quién está «actualmente» en ese puesto." },
        { tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 2 · Separar hechos de inferencias",
          enunciado: "¿Cómo clasificas «la actual directora es la señora Fulana de Tal Ejemplo»?",
          conjunto: "hechos", correcta: "desconocido",
          explicacion: "DESCONOCIDO: aunque alguna vez hubiera sido cierto, pudo haber cambiado después de la fecha de corte." },
        { tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 5 · Escala de confianza explícita",
          enunciado: "¿Qué nivel de confianza merece ese nombre?",
          conjunto: "confianza", correcta: "bajo",
          explicacion: "[BAJO]: no seguro, verificar antes de usar. Una carta dirigida a la persona equivocada empieza perdiendo." },
        { tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 7 · Datos actuales o cambiantes",
          enunciado: "¿Qué instrucción habría evitado el problema?",
          opciones: [
            { texto: "«Si el dato puede cambiar con el tiempo (como quién ocupa un cargo), advierte que tu conocimiento tiene fecha de corte y recomienda verificarlo en la fuente oficial.»", correcta: true },
            { texto: "«Da siempre un nombre propio, aunque no estés seguro.»", correcta: false, porque: "Eso obliga a la IA a inventar." },
            { texto: "«Escribe la carta en un tono más formal.»", correcta: false, porque: "El tono no corrige un dato desactualizado." }
          ],
          explicacion: "Técnica 7: en precios, eventos, estadísticas o personas en cargos, advertir la fecha de corte y remitir a fuentes oficiales." }
      ] },

    { id: "n4-c05", nivel: 4, grupo: "caso", tipo: "caso", concepto: "alucinaciones", fuente: "Uso responsable · Evitar alucinaciones y verificar",
      titulo: "Caso: lo que nadie le contó",
      etiquetaSituacion: "Consulta del analista",
      situacion: "«Te comparto el perfil del cargo (Coordinador de RR. HH., requiere experiencia en nómina) y el resumen anonimizado de la Candidata A (4 años en nómina). ¿Encaja?»",
      rotulo: "Respuesta de IA inventada con fines didácticos. La candidata y sus datos no existen.",
      pasos: [
        { tipo: "marcar", presentacion: "texto",
          enunciado: "Toca las 2 frases que la IA NO pudo sacar de lo que le compartiste.",
          segmentos: [
            { texto: "Según el perfil que me compartiste, el cargo requiere experiencia en nómina.", objetivo: false },
            { texto: "La Candidata A reporta 4 años en nómina, así que probablemente cumple ese requisito.", objetivo: false },
            { texto: "Además, su salario actual es de $ N.NNN.NNN, igual al promedio del mercado.", objetivo: true },
            { texto: "Su anterior jefe la describe como «muy puntual».", objetivo: true }
          ],
          explicacion: "Ni el salario ni la opinión del jefe estaban en tu prompt: la IA rellenó los vacíos con datos inventados." },
        { tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 2 · Separar hechos de inferencias",
          enunciado: "¿Cómo clasificas «el cargo requiere experiencia en nómina»?",
          conjunto: "hechos", correcta: "hecho",
          explicacion: "HECHO CONFIRMADO: está textualmente en el perfil que tú le diste. Lo que tú provees es su base más confiable." },
        { tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 5 · Escala de confianza explícita",
          enunciado: "¿Qué nivel de confianza merece esa afirmación?",
          conjunto: "confianza", correcta: "alto",
          explicacion: "[ALTO]: muy seguro, porque sale directamente de la información que proporcionaste." },
        { tipo: "opcion", concepto: "frases", fuente: "Frase 3 · Basa tu respuesta únicamente en lo que te proveo",
          enunciado: "¿Qué instrucción habría evitado el salario y la referencia inventados?",
          opciones: [
            { texto: "«Basa tu respuesta ÚNICAMENTE en la información que yo te proveo en este prompt.»", correcta: true },
            { texto: "«Si falta algún dato, complétalo con lo que supongas.»", correcta: false, porque: "Eso es pedirle que invente." },
            { texto: "«Cuéntame más sobre la vida personal de la candidata.»", correcta: false, porque: "Ni aporta veracidad ni respeta la privacidad." }
          ],
          explicacion: "Frase 3 de uso responsable: limita la respuesta a lo que tú proveíste en el prompt." }
      ] },

    { id: "n4-c06", nivel: 4, grupo: "caso", tipo: "caso", concepto: "alucinaciones", fuente: "Uso responsable · Evitar alucinaciones y verificar",
      titulo: "Caso: abogada por un día",
      etiquetaSituacion: "Consulta del analista",
      situacion: "«Un colaborador pidió por escrito cambiar su horario. ¿Qué le respondo?»",
      rotulo: "Respuesta de IA inventada con fines didácticos. La sentencia y el plazo no existen.",
      pasos: [
        { tipo: "marcar", presentacion: "texto",
          enunciado: "Toca las 2 frases sospechosas.",
          segmentos: [
            { texto: "Como lo pidió por escrito, probablemente espera una respuesta también por escrito.", objetivo: false },
            { texto: "Puedes agradecerle la solicitud y decirle que la revisarás con su líder.", objetivo: false },
            { texto: "Legalmente la empresa está obligada a aceptarlo en un plazo de NN días, según la Sentencia Ficticia 000 de XXXX.", objetivo: true },
            { texto: "No hace falta consultarlo con nadie más: puedes responder hoy mismo con esta base legal.", objetivo: true }
          ],
          explicacion: "Una sentencia con número y plazo, más un «no hace falta consultarlo»: dato legal sin respaldo y exceso de confianza." },
        { tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 2 · Separar hechos de inferencias",
          enunciado: "Mira otra frase: «Como lo pidió por escrito, probablemente espera una respuesta por escrito». ¿Cómo la clasificas?",
          conjunto: "hechos", correcta: "inferencia",
          explicacion: "INFERENCIA: es una deducción razonable a partir de lo que contaste, pero no está confirmada." },
        { tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 5 · Escala de confianza explícita",
          enunciado: "¿Qué nivel de confianza le pondrías a esa inferencia?",
          conjunto: "confianza", correcta: "medio",
          explicacion: "[MEDIO]: probablemente correcto, pero con matices. Lo confirmas preguntándole al colaborador." },
        { tipo: "opcion", concepto: "frases", fuente: "Frase 4 · Validar con un abogado laboral",
          enunciado: "¿Qué instrucción habría evitado que la IA diera el tema legal por cerrado?",
          opciones: [
            { texto: "«Si hay aspectos legales involucrados, indica explícitamente que la respuesta debe ser validada por un abogado laboral.»", correcta: true },
            { texto: "«Responde como si fueras abogado y da el caso por cerrado.»", correcta: false, porque: "Un rol no reemplaza la validación de un abogado laboral real." },
            { texto: "«Sé breve: máximo tres líneas.»", correcta: false, porque: "La brevedad no hace verdadero un dato legal." }
          ],
          explicacion: "Frase 4 de uso responsable: todo aspecto legal debe ser validado por un abogado laboral." }
      ] },

    { id: "n4-t01", nivel: 4, grupo: "tecnica", tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 1 · Reconocimiento de incertidumbre",
      enunciado: "Le preguntas a la IA por una política interna de Talentia S.A.S. que nunca le compartiste. ¿Qué respuesta muestra un comportamiento responsable?",
      opciones: [
        { texto: "«No tengo información confiable sobre esto.»", correcta: true },
        { texto: "«La política de Talentia establece NN días y aplica desde el año XXXX.»", correcta: false, porque: "No puede conocer una política interna que no le diste: la está inventando." },
        { texto: "«Seguramente es igual que en todas las empresas, así que…»", correcta: false, porque: "Suponer y presentarlo como respuesta también es inventar." }
      ],
      explicacion: "Técnica 1: reconocer la incertidumbre en lugar de inventar datos, nombres, fechas, estadísticas o fuentes." },

    { id: "n4-t02", nivel: 4, grupo: "tecnica", tipo: "opcion", concepto: "frases", fuente: "Frase 5 · Link de la fuente oficial",
      enunciado: "Quieres poder comprobar por tu cuenta lo que te dijo la IA. ¿Qué frase agregas al prompt?",
      opciones: [
        { texto: "«Indícame el link de la fuente oficial que debo verificar si tengo dudas de la información que me suministraste.»", correcta: true },
        { texto: "«Asegúrame que todo lo que dijiste es correcto.»", correcta: false, porque: "Que la IA lo asegure no es verificar." },
        { texto: "«No me des fuentes: confío en ti.»", correcta: false, porque: "La confianza no reemplaza la verificación." }
      ],
      explicacion: "Frase 5 de uso responsable: pedir la fuente oficial para verificar tú mismo. Regla de oro: se verifica antes de usar." },

    { id: "n4-t03", nivel: 4, grupo: "tecnica", tipo: "clasificar", concepto: "tecnicas", fuente: "Técnica 2 · Separar hechos de inferencias",
      enunciado: "Lleva cada descripción a su etiqueta.",
      casillas: ["HECHO CONFIRMADO", "INFERENCIA", "DESCONOCIDO"],
      fichas: [
        { texto: "Alta certeza.", casilla: "HECHO CONFIRMADO" },
        { texto: "Deducido, pero no confirmable.", casilla: "INFERENCIA" },
        { texto: "No se tiene, o pudo haber cambiado.", casilla: "DESCONOCIDO" }
      ],
      explicacion: "Técnica 2: pedirle a la IA que separe lo confirmado, lo deducido y lo que no sabe te muestra dónde verificar." },

    { id: "n4-t04", nivel: 4, grupo: "tecnica", tipo: "clasificar", concepto: "tecnicas", fuente: "Técnica 5 · Escala de confianza explícita",
      enunciado: "Lleva cada descripción a su nivel de confianza.",
      casillas: ["[ALTO]", "[MEDIO]", "[BAJO]"],
      fichas: [
        { texto: "Muy seguro.", casilla: "[ALTO]" },
        { texto: "Probablemente correcto, pero con matices.", casilla: "[MEDIO]" },
        { texto: "No seguro: verificar antes de usar.", casilla: "[BAJO]" }
      ],
      explicacion: "Técnica 5: una escala de confianza explícita te dice qué puedes usar y qué debes verificar primero." },

    { id: "n4-t05", nivel: 4, grupo: "tecnica", tipo: "opcion", concepto: "tecnicas", fuente: "Técnica 3 · Verificación paso a paso",
      enunciado: "En la verificación paso a paso, la IA se hace preguntas antes de responder. ¿Cuál de estas NO es una de ellas?",
      opciones: [
        { texto: "¿Sonará convincente mi respuesta?", correcta: true },
        { texto: "¿Tengo evidencia real?", correcta: false, porque: "Esta sí es una de las preguntas de verificación." },
        { texto: "¿Pudo cambiar después de mi fecha de corte?", correcta: false, porque: "Esta sí es una de las preguntas de verificación." },
        { texto: "¿Cito una fuente real o podría estar confabulando?", correcta: false, porque: "Esta sí es una de las preguntas de verificación." }
      ],
      explicacion: "Técnica 3: evidencia real, posibles cambios tras la fecha de corte y fuentes reales. Sonar convincente no es un criterio de veracidad." },

    { id: "n4-t06", nivel: 4, grupo: "tecnica", tipo: "opcion", concepto: "frases", fuente: "Frase 1 · Si no tienes información suficiente, dímelo",
      enunciado: "¿Qué frase le da «permiso» a la IA para reconocer que no sabe?",
      opciones: [
        { texto: "«Si no tienes información suficiente o precisa sobre este tema, dímelo claramente en lugar de asumir.»", correcta: true },
        { texto: "«Responde siempre, aunque tengas que suponer.»", correcta: false, porque: "Eso la empuja a rellenar vacíos con invenciones." },
        { texto: "«Nunca me digas que no sabes.»", correcta: false, porque: "Prohibir el «no sé» es fabricar alucinaciones." }
      ],
      explicacion: "Frase 1 de uso responsable: es preferible un «no tengo información suficiente» a una suposición bien redactada." },

    { id: "n4-t07", nivel: 4, grupo: "tecnica", tipo: "opcion", concepto: "tecnicas", fuente: "Plantilla [INSTRUCCIONES DE VERACIDAD]",
      enunciado: "¿Cuál de estas viñetas NO pertenece a una plantilla de [INSTRUCCIONES DE VERACIDAD]?",
      opciones: [
        { texto: "Si falta un dato, complétalo con el más probable.", correcta: true },
        { texto: "Si no sabes algo, dilo.", correcta: false, porque: "Esta sí va en la plantilla." },
        { texto: "Distingue entre hecho, inferencia y desconocido.", correcta: false, porque: "Esta sí va en la plantilla." },
        { texto: "Revisa tu respuesta y marca o elimina las afirmaciones dudosas.", correcta: false, porque: "Esta sí va en la plantilla." }
      ],
      explicacion: "La plantilla pide lo contrario: no confabular. Si no sabe, lo dice; si duda, lo marca o lo elimina." },

    /* =====================================================================
       NIVEL 5 · CORCHETES Y PRIVACIDAD
       ===================================================================== */
    { id: "n5-i01", nivel: 5, grupo: "insertar", tipo: "insertar", concepto: "delimitadores", fuente: "Práctica 2 · Técnica de los corchetes",
      enunciado: "Este prompt mezcla instrucciones y hoja de vida. Coloca cada delimitador en su lugar.",
      partes: [
        { hueco: "[INSTRUCCIÓN]" },
        { texto: "Evalúa el siguiente CV para el cargo de Coordinador de RR. HH. Puntúa de 1 a 5 cada criterio y da una recomendación final (Avanzar / No avanzar / Revisar con duda)." },
        { hueco: "[CRITERIOS]" },
        { texto: "Gestión de nómina 30% · Legislación laboral 25% · Comunicación escrita 20% · Estabilidad 15% · Nivel educativo 10%" },
        { hueco: "--- CV A EVALUAR ---" },
        { texto: "Candidata A. 5 años de experiencia en gestión humana, 3 de ellos en nómina. Profesional en Administración. (CV ficticio y anonimizado.)" },
        { hueco: "--- FIN DEL CV ---" },
        { texto: "Al final entrega: puntuación total, fortalezas, gaps y recomendación." }
      ],
      explicacion: "Los delimitadores separan las instrucciones del contenido variable: eliminan ambigüedad y mejoran la precisión." },

    { id: "n5-i02", nivel: 5, grupo: "insertar", tipo: "insertar", concepto: "delimitadores", fuente: "Práctica 2 · Técnica de los corchetes",
      enunciado: "Ordena este prompt para la vacante de Analista de Selección: coloca cada delimitador en su lugar.",
      partes: [
        { hueco: "[INSTRUCCIÓN]" },
        { texto: "Evalúa el siguiente CV para el cargo de Analista de Selección. Puntúa de 1 a 5 cada criterio y da una recomendación final (Avanzar / No avanzar / Revisar con duda)." },
        { hueco: "[CRITERIOS]" },
        { texto: "Reclutamiento 40% · Entrevistas 30% · Manejo de herramientas 20% · Nivel educativo 10% (pesos ficticios)" },
        { hueco: "--- CV A EVALUAR ---" },
        { texto: "Candidato B. 3 años en procesos de selección masiva. Profesional en Psicología. (CV ficticio y anonimizado.)" },
        { hueco: "--- FIN DEL CV ---" },
        { texto: "Al final entrega: puntuación total, fortalezas, gaps y recomendación." }
      ],
      explicacion: "[INSTRUCCIÓN] abre lo que debe hacer la IA, [CRITERIOS] agrupa las reglas de evaluación y las líneas --- encierran el CV." },

    { id: "n5-p01", nivel: 5, grupo: "cv", tipo: "marcar", presentacion: "lista", concepto: "privacidad", fuente: "Práctica 2 · Privacidad",
      enunciado: "Antes de subir este CV a una IA, toca los 5 datos que debes RETIRAR. Deja los que sí sirven para evaluar.",
      rotulo: "CV 100 % ficticio. Ningún dato corresponde a una persona real.",
      segmentos: [
        { texto: "Nombre: Fulanita de Tal Ejemplo", objetivo: true },
        { texto: "Cédula: 000.000.000", objetivo: true },
        { texto: "Experiencia: 5 años como analista de nómina", objetivo: false },
        { texto: "Teléfono: 300 000 0000", objetivo: true },
        { texto: "Formación: profesional en Administración (Universidad Ficticia)", objetivo: false },
        { texto: "Correo: fulanita@ejemplo.com", objetivo: true },
        { texto: "Competencias: comunicación escrita y manejo de hojas de cálculo", objetivo: false },
        { texto: "Dirección: Calle Falsa 123, Ciudad Inventada", objetivo: true },
        { texto: "Logro: redujo los errores de nómina de su equipo", objetivo: false }
      ],
      explicacion: "Antes de subir un CV a una IA se retiran nombre, cédula y datos de contacto. Experiencia, formación y competencias son lo que se evalúa." },

    { id: "n5-p02", nivel: 5, grupo: "cv", tipo: "marcar", presentacion: "lista", concepto: "privacidad", fuente: "Práctica 2 · Privacidad",
      enunciado: "Antes de subir este CV a una IA, toca los 5 datos que debes RETIRAR. Deja los que sí sirven para evaluar.",
      rotulo: "CV 100 % ficticio. Ningún dato corresponde a una persona real.",
      segmentos: [
        { texto: "Experiencia: 3 años en procesos de selección", objetivo: false },
        { texto: "Nombre: Perencejo Demo Prueba", objetivo: true },
        { texto: "Correo: perencejo@correo-falso.test", objetivo: true },
        { texto: "Formación: profesional en Psicología (Universidad Imaginaria)", objetivo: false },
        { texto: "Cédula: 111.111.111", objetivo: true },
        { texto: "Competencias: entrevistas por competencias y redacción de informes", objetivo: false },
        { texto: "Dirección: Carrera Imaginaria 00 # 00-00, Villa Ejemplo", objetivo: true },
        { texto: "Idiomas: inglés intermedio", objetivo: false },
        { texto: "Teléfono: 311 111 1111", objetivo: true }
      ],
      explicacion: "Nombre, cédula y datos de contacto se retiran: no aportan a la evaluación y exponen a la persona. Uso responsable desde el día uno." },

    { id: "n5-k01", nivel: 5, grupo: "concepto", tipo: "opcion", concepto: "delimitadores", fuente: "Práctica 2 · Técnica de los corchetes",
      enunciado: "¿Para qué sirven los corchetes y delimitadores en un prompt?",
      opciones: [
        { texto: "Para separar las instrucciones del contenido variable, eliminar ambigüedad y mejorar la precisión.", correcta: true },
        { texto: "Para que el prompt se vea más técnico.", correcta: false, porque: "No es cuestión de estética, sino de claridad." },
        { texto: "Para que la IA ignore lo que está entre corchetes.", correcta: false, porque: "Al contrario: le indican qué es cada parte." }
      ],
      explicacion: "Usar [ ], etiquetas o líneas --- separa instrucciones y contenido variable: menos ambigüedad, más precisión." },

    { id: "n5-k02", nivel: 5, grupo: "concepto", tipo: "opcion", concepto: "delimitadores", fuente: "Práctica 2 · Técnica de los corchetes",
      enunciado: "¿Cuál de estas NO es una forma de delimitar vista en clase?",
      opciones: [
        { texto: "Escribir todo en un solo párrafo, sin separaciones.", correcta: true },
        { texto: "Corchetes [ ]", correcta: false, porque: "Los corchetes sí son delimitadores." },
        { texto: "Etiquetas", correcta: false, porque: "Las etiquetas sí son delimitadores." },
        { texto: "Líneas ---", correcta: false, porque: "Las líneas --- sí son delimitadores." }
      ],
      explicacion: "La técnica usa [ ], etiquetas o líneas --- para separar. Un solo bloque de texto es justo el problema que resuelve." },

    { id: "n5-k03", nivel: 5, grupo: "concepto", tipo: "opcion", concepto: "privacidad", fuente: "Práctica 2 · Privacidad",
      enunciado: "Antes de subir un CV a una IA, ¿qué debes retirar?",
      opciones: [
        { texto: "Nombre, cédula y datos de contacto.", correcta: true },
        { texto: "La experiencia laboral.", correcta: false, porque: "La experiencia es justo lo que se evalúa." },
        { texto: "La formación académica.", correcta: false, porque: "La formación sirve para evaluar." }
      ],
      explicacion: "Privacidad: se retiran nombre, cédula y datos de contacto. Uso responsable desde el día uno." },

    { id: "n5-k04", nivel: 5, grupo: "concepto", tipo: "vf", concepto: "privacidad", fuente: "Práctica 2 · Privacidad",
      enunciado: "¿Verdadero o falso? «Conviene subir el CV completo, con nombre y cédula, para que el análisis de la IA sea más preciso.»",
      correcta: false,
      explicacion: "Nombre, cédula y contacto no mejoran la evaluación y sí exponen datos personales: se retiran antes de subir el CV." },

    { id: "n5-k05", nivel: 5, grupo: "concepto", tipo: "opcion", concepto: "delimitadores", fuente: "Práctica 2 · Técnica de los corchetes",
      enunciado: "En el ejemplo del curso, ¿qué va entre «--- CV A EVALUAR ---» y «--- FIN DEL CV ---»?",
      opciones: [
        { texto: "El contenido variable: el texto del CV.", correcta: true },
        { texto: "Las instrucciones para la IA.", correcta: false, porque: "Esas van bajo [INSTRUCCIÓN]." },
        { texto: "Los criterios y sus pesos.", correcta: false, porque: "Esos van bajo [CRITERIOS]." }
      ],
      explicacion: "Las líneas --- encierran el contenido variable (el CV), separado de las instrucciones y los criterios." },

    /* =====================================================================
       JEFE FINAL · CASO INTEGRADOR
       ===================================================================== */
    { id: "jf-01", nivel: "jefe", grupo: "jefe", tipo: "caso", concepto: "regla-oro", fuente: "Caso integrador · Regla de oro",
      titulo: "Vacante: Coordinador/a de RR. HH. en Talentia S.A.S.",
      etiquetaSituacion: "El caso",
      situacion: "Tienes el perfil del cargo y 3 hojas de vida. Tu jefa quiere hoy una comparación de candidatos hecha con IA… y bien hecha.",
      rotulo: "Empresa, candidatos y datos ficticios.",
      pasos: [
        { tipo: "opcion", concepto: "privacidad", fuente: "Práctica 2 · Privacidad",
          enunciado: "Paso 1 · Antes de pegar las hojas de vida en la IA, ¿qué haces?",
          opciones: [
            { texto: "Retiro nombre, cédula y datos de contacto, y las identifico como Candidato A, B y C.", correcta: true },
            { texto: "Las pego completas: entre más datos, mejor análisis.", correcta: false, porque: "Los datos personales no mejoran la evaluación y sí exponen a las personas." },
            { texto: "Quito la experiencia y la formación para que el prompt quede corto.", correcta: false, porque: "Eso es justo lo que la IA necesita para evaluar; el espacio no es el problema." },
            { texto: "Pego solo los nombres y le pido a la IA que averigüe el resto.", correcta: false, porque: "Expone datos personales e invita a la IA a inventar." }
          ],
          explicacion: "Privacidad primero: se retiran nombre, cédula y contacto, y se conserva lo que sirve para evaluar." },
        { tipo: "opcion", concepto: "elementos", fuente: "5 elementos + delimitadores + veracidad",
          enunciado: "Paso 2 · ¿Cuál es el mejor prompt para comparar a los candidatos?",
          opciones: [
            { texto: "Actúa como especialista en reclutamiento senior.\n[INSTRUCCIÓN] Compara a los 3 candidatos para el cargo de Coordinador de RR. HH. de Talentia S.A.S. Entrega una tabla con puntuación por criterio, fortalezas, gaps y recomendación.\n[CRITERIOS] Gestión de nómina 30% · Legislación laboral 25% · Comunicación escrita 20% · Estabilidad 15% · Nivel educativo 10%\n--- CVs A EVALUAR ---\n(Candidatos A, B y C, sin nombre, cédula ni contacto)\n--- FIN DE LOS CVs ---\nBasa tu respuesta ÚNICAMENTE en la información que te doy. No inventes cifras ni artículos de ley. Si hay aspectos legales, indica que deben ser validados por un abogado laboral.", correcta: true },
            { texto: "Compara a estos candidatos y dime a quién contrato.\n(Candidatos A, B y C, anonimizados)", correcta: false, porque: "Le faltan rol, contexto y formato: la IA tendrá que adivinar el cargo y cómo responder." },
            { texto: "Actúa como especialista en reclutamiento senior y compara para Coordinador de RR. HH. al Candidato A que tiene 5 años en nómina evalúa nómina 30% y legislación 25% el Candidato B viene de selección entrégalo en tabla y comunicación 20% el Candidato C estudió administración basa tu respuesta solo en lo que te doy y lo legal que lo valide un abogado laboral.", correcta: false, porque: "Tiene de todo, pero mezclado: sin delimitadores, las instrucciones y los CV se confunden." },
            { texto: "Actúa como especialista en reclutamiento senior.\n[INSTRUCCIÓN] Compara a los 3 candidatos para Coordinador de RR. HH. y entrega una tabla. Agrega los artículos de la ley laboral vigente y el salario de mercado actual de cada uno, según tu conocimiento.\n--- CVs A EVALUAR ---\n(Candidatos A, B y C, anonimizados)\n--- FIN DE LOS CVs ---", correcta: false, porque: "Pide leyes y salarios «vigentes» sin dárselos y sin instrucciones de veracidad: una invitación a alucinar." }
          ],
          explicacion: "El prompt ganador combina rol, tarea, contexto, formato, delimitadores, instrucciones de veracidad, validación legal y CVs anonimizados." },
        { tipo: "opcion", concepto: "regla-oro", fuente: "Uso responsable · Regla de oro",
          enunciado: "Paso 3 · La IA entrega la tabla y añade: «Ojo: por el Art. XX (ficticio), al Candidato B habría que ofrecerle un contrato de tipo Z». ¿Qué haces?",
          opciones: [
            { texto: "No lo uso todavía: lo verifico en la fuente oficial y lo valido con un abogado laboral.", correcta: true },
            { texto: "Lo copio en el informe para mi jefa: si trae número de artículo, debe ser cierto.", correcta: false, porque: "Un número de artículo no es garantía: la IA puede inventarlo." },
            { texto: "Descarto al Candidato B para evitarme problemas.", correcta: false, porque: "Decidir sobre una persona con un dato sin verificar es el peor escenario." },
            { texto: "Le pregunto a la IA «¿estás segura?» y, si dice que sí, lo uso.", correcta: false, porque: "Que la IA insista no es verificar." }
          ],
          explicacion: "Regla de oro: en Talento Humano, todo dato legal, salarial o de personas se verifica antes de usarse." }
      ] }
  ]
};

/* Permite usar el banco desde Node (validador) y desde el navegador */
if (typeof module !== "undefined" && module.exports) { module.exports = BANCO; }
