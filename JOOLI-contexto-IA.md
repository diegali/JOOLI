# 🧠 CONTEXTO PARA IA – JOOLI CateringDesk (v8 — actualizado 09/04/2026)

> Pegá este archivo al inicio de cada chat nuevo para trabajar sin subir el proyecto.

---

## ⚠️ CÓMO TRABAJAR CONMIGO

Soy principiante. Necesito ayuda **paso a paso**, sin romper lo que ya funciona.

**Formato de respuesta que quiero siempre:**

### Qué vamos a hacer
Breve explicación

### Archivo a tocar
Nombre exacto

### Qué buscar
Función o bloque

### Qué pegar o reemplazar
Código exacto

### Dónde va
Ubicación clara

### Qué debería pasar
Resultado esperado

---

## 🎯 QUÉ ES ESTA APP

**JOOLI CateringDesk** es una app interna para gestionar eventos de catering.
La usa un equipo chico (Laura, Mariano, Sebastián). Reemplaza papeles, WhatsApp, Excel y memoria del equipo.
Se usa principalmente desde el **celular**.

---

## 🧰 TECNOLOGÍAS

- HTML + CSS + JavaScript (vanilla, sin frameworks)
- Firebase Auth (login)
- Firestore (base de datos en tiempo real)
- Firebase Storage (archivos adjuntos)
- GitHub Pages (hosting)
- PWA (manifest.json + sw.js)

**Librerías externas:**
- FullCalendar 6.1.8 (solo `index.global.min.js`, los locales vienen incluidos — NO agregar locales-all.global.min.js, no existe en esa versión)
- Google Maps (ubicación)
- Chart.js (estadísticas)
- jsPDF (exportar PDF — usado en ART de staff, checklist y presupuesto)

**Firebase versión:** `10.12.0` (importado desde CDN de gstatic)

---

## 🧱 ESTRUCTURA DE ARCHIVOS

```
index.html              ← estructura general + registro del SW al final del body
manifest.json           ← config PWA
sw.js                   ← service worker (versión jooli-v7)

css/
  base.css              ← variables globales de color y tipografía
  layout.css            ← estructura general
  login.css             ← pantalla de acceso
  events.css            ← estilos de eventos
  staff.css             ← personal
  checklist.css         ← checklist
  modals.css            ← ventanas modales

js/
  auth.js               ← Firebase config + login
  main.js               ← coordina toda la app
  calendar.js           ← calendario (FullCalendar)
  events.js             ← lógica principal de eventos
  staff.js              ← gestión de personal
  lista.js              ← checklist general, catálogo y vajilla
  lista-cocina.js       ← checklist cocina, cámara y panadería
  ui.js                 ← utilidades visuales menores

  events/               ← submódulos de eventos
    events-form.js      ← formulario alta/edición
    events-render.js    ← renderizado de tarjetas
    events-jornadas.js  ← lógica de eventos multidia
    events-maps.js      ← integración Google Maps
    events-budget.js    ← presupuesto/pagos/alquileres
    events-avisos.js    ← alertas y confirmaciones
    events-utils.js     ← helpers compartidos

images/
  presupuesto-asado.png
  presupuesto-catering.jpg / .png
  presupuesto-coffee.png
```

---

## 🔥 BASE DE DATOS FIRESTORE

| Colección                  | Qué guarda                                      |
|----------------------------|-------------------------------------------------|
| `events`                   | Todos los eventos de catering                   |
| `staff`                    | Lista de personal (mozos, etc.)                 |
| `catalogoChecklist`        | Ítems base del catálogo de checklist general    |
| `catalogoChecklistCocina`  | Ítems del catálogo de cocina (incluye cámara)   |
| `notificaciones`           | Avisos entre usuarios en tiempo real            |

---

## 👤 USUARIOS

Mapeados en `js/events/events-utils.js` (hardcodeado, no está en Firestore):

```js
export const USUARIOS_MAP = {
  "almos2712@hotmail.com": "Laura",
  "mariano@a.com": "Mariano",
  "seba@a.com": "Sebastián",
};
```

---

## ⚙️ FUNCIONALIDADES IMPLEMENTADAS

### Eventos
- Calendario mensual (FullCalendar)
- Lista de eventos con:
  - Filtro por **estado** (Todos / Presupuestado / Confirmado / Realizado / Cancelado / Cerrado)
  - Filtro por **mes** — segunda fila de botones, aparece solo si hay eventos en más de un mes. Funciona combinado con el filtro de estado.
  - Búsqueda por cliente (campo de texto, filtra por `data-cliente`)
- Crear / editar / eliminar eventos
- **Duplicar evento** desde el modal de detalle
- Eventos de un día y de varios días (jornadas)
- **Countdown en tarjetas**: badge de días que faltan en eventos próximos
- **Indicador visual "evento hoy"**: tarjeta con fondo rosado, nombre en rojo, "🔴 HOY —" antes de la fecha (puro CSS)
- **Aviso al salir sin guardar**: al tocar Cancelar o ＋ si hay cliente, fecha, lugar o notas cargadas
- Confirmación visual cuando un evento pasado no fue confirmado

### Tipos de evento disponibles
- Catering Completo
- Coffee
- Almuerzo informal
- Cena informal
- Almuerzo formal
- Cena formal
- Asado

### Modal de detalle (mejorado)
- Información agrupada en bloques visuales con fondo suave
- Clases: `detail-bloque`, `detail-bloque-fila`, `detail-bloque-icono`, `detail-bloque-texto`
- Bloques: lugar/horario — dinero/pagos — staff/checklist — notas — alquileres — jornadas
- Si el checklist general o de cocina se abre desde el modal detalle, el detalle **se oculta temporalmente** y al cerrar el checklist **vuelve al detalle**

### Jornadas (eventos multidia)
- Cada jornada tiene fecha, tipo, lugar, invitados, staff, horarios, notas y alquileres
- Nueva jornada hereda datos de la anterior

### Staff / Personal
- Alta, edición y baja con nombre, teléfono, DNI, categoría
- Asignación a eventos, estados (pendiente / confirmado / rechazado)
- Conteo de faltantes, envío de WhatsApp con vista previa
- PDF tipo ART con lista de personal

### Checklist de cocina — pestaña 🧊 Cámara
- Muestra ítems de categoría `CAMARA` del catálogo cocina con su stock
- Stock editable con botones `+` / `−` y también con input numérico directo (`ajustarStockDirecto()`)
- El número de stock se muestra en rojo si llega a 0, naranja si tiene 3 o menos, verde si hay más
- Botón 🗑 para eliminar un ítem de cámara (desde esta pestaña, no desde el catálogo base)
- Todo en una sola línea (`flex-wrap: nowrap`)
- Formulario al pie para agregar nuevos ítems a cámara con cantidad inicial
- **Los ítems de cámara NO se agregan al checklist desde esta pestaña** — solo se hace desde la pestaña Checklist

### Checklist de cocina — pestaña Checklist
- Los ítems de categoría `CAMARA` aparecen diferenciados en el catálogo:
  - Muestran badge de stock 🧊 con color según disponibilidad
  - Input de cantidad (58px, entra 3 cifras) + botón redondo ↑ para agregar
  - Si ya fue agregado: muestra ✔ (deshabilitado)
  - Si no hay stock: muestra ✕ (deshabilitado)
- Los ítems de cocina que **NO** son `CAMARA` también permiten elegir la cantidad **antes** de agregarlos al checklist
- Al agregar un ítem de cámara se descuenta la cantidad del stock automáticamente
- Al cambiar la cantidad en el checklist (`cambiarCantidadChecklistCocina`) se recalcula la diferencia y ajusta el stock
- Al eliminar un ítem de cámara del checklist, las unidades vuelven al stock (`Number(item.cantidad)` para evitar concatenación)
- En la categoría **PANADERÍA**, el botón de WhatsApp 🥖 está en la línea de la categoría dentro del checklist (ya no arriba, al lado del PDF)

### Checklist de cocina — pestaña Catálogo base
- **No muestra ítems de categoría `CAMARA`** (filtrados en render y bloqueados al guardar)
- El bloqueo cubre tanto `"CAMARA"` como `"CÁMARA"` (con tilde)

### Checklist general
- Los ítems del catálogo permiten elegir la cantidad **antes** de agregarlos al checklist
- Catálogo y checklist están separados visualmente en dos bloques: **Checklist del evento** y **Catálogo disponible**
- Los títulos de bloques, tabs y nombres de ítems del checklist usan una tipografía más angosta (`Roboto Condensed`) para aprovechar mejor el espacio en celular

### Checklist general — pestaña 🍽 Vajilla
- Muestra ítems de categoría `VAJILLA` del catálogo general (`catalogoChecklist`) con su stock
- Stock editable con botones `+` / `−` y también con input numérico directo (`ajustarStockVajillaDirecto()`)
- El número de stock se muestra en rojo si llega a 0, naranja si tiene 3 o menos, verde si hay más
- Botón 🗑 para eliminar un ítem de vajilla (desde esta pestaña)
- Formulario al pie para agregar nuevos ítems a vajilla con cantidad inicial
- Los ítems de `VAJILLA` aparecen diferenciados en la pestaña Checklist:
  - Muestran badge de stock 🍽 con color según disponibilidad
  - Input de cantidad + botón ↑ para agregar
  - Si ya fue agregado: muestra ✔ (deshabilitado)
  - Si no hay stock: muestra ✕ (deshabilitado)
- Al agregar un ítem de vajilla se descuenta la cantidad del stock automáticamente
- Al cambiar la cantidad en el checklist se recalcula la diferencia y ajusta el stock
- Al eliminar un ítem de vajilla del checklist, las unidades vuelven al stock
- **La categoría VAJILLA está bloqueada en el catálogo base**: filtrada del select y validada al guardar
- `window.devolverStockVajilla(nombre, cantidad)` — función global para devolver stock desde otros módulos

### Administración / Presupuesto y Pagos
- Total del evento con máscara de miles al editar (formato `es-AR`)
- **Pagos parciales**: array `pagos` por evento, cada uno con monto, estado (pendiente/pagado) y factura opcional
- Adjuntos en Firebase Storage (presupuesto, factura por pago, alquileres)
- Generación PDF de presupuesto con imagen de fondo
- Estadísticas por mes (Chart.js)
- Campo `paid` (cobrado sí/no) se mantiene independiente de los pagos parciales

### Notificaciones
- Tiempo real con Firestore `onSnapshot`
- Sonido, panel, se marcan como leídas automáticamente

### PWA / Service Worker
- `sw.js` en versión `jooli-v7`
- Cachea todos los archivos CSS y JS reales del proyecto
- Firebase, gstatic y googleapis van siempre a la red (nunca se cachean)
- Registrado en `index.html` al final del `<body>`
- ⚠️ Cada vez que se suben cambios a GitHub, hay que incrementar `CACHE_NAME` en `sw.js` (jooli-v8, v9...) para que los celulares descarguen los archivos nuevos

---

## 🧠 RESPONSABILIDAD DE CADA ARCHIVO JS

### `auth.js`
Inicializa Firebase. Exporta `auth`, `db`, `storage`. No tocar.

### `main.js`
Arranca la app, maneja navegación entre secciones (`showSection`), avisa si hay edición en curso al cambiar de sección, maneja notificaciones. No agregar lógica de negocio acá.

### `events.js`
Lógica CRUD de eventos. Escucha Firestore → llena `window.allEventsData`. Llama a `actualizarFiltrosMes()` y `rerenderEvents()` en cada cambio. Funciones globales: `mostrarAvisoSimple`, `resetFormConfirmado`, `confirmarEliminarEvento`.

### `events-form.js`
`resetForm()`, `getFormData()`, `fillFormForEdit()`. Formatea CUIT. Máscara de miles para el campo `total`. Inicializa pagos al abrir un evento para editar (`window._initPagosForm`).

### `events-render.js`
`renderFilteredEvents()` y `createCard()`. Cada tarjeta tiene `data-cliente` y `data-mes` (formato `"2026-04"`). Incluye badge countdown. `registerEventDetailModal()` genera el modal de detalle con bloques visuales, incluyendo el bloque de pagos parciales. Además contiene la lógica para ocultar temporalmente el modal detalle al abrir checklist desde ahí (`ocultarModalDetallePorChecklist`).

### `events-utils.js`
Helpers: `formatDate`, `formatDateShort`, `getMonthLabel`, `getCurrentUserName`, `STATUS_COLORS`, `USUARIOS_MAP`.

### `events-jornadas.js`
`initJornadas()` → `window.toggleMultidia`, `window.agregarJornada`.
Usa `window.mostrarAvisoSimple` directamente (no como parámetro).

### `events-budget.js`
Presupuesto, pagos parciales, alquileres. Subida a Firebase Storage.
Exporta: `puedeEditarPresupuesto`, `actualizarUIBudget`, `subirPresupuestoEvento`, `eliminarPresupuestoEvento`, `actualizarUIAlquiler`, `subirAlquilerEvento`, `eliminarAlquilerEvento`, `initPagosForm`, `resetPagosForm`, `agregarPago`, `guardarPagos`.
Expone `window._getPagosEnEdicion()` para que `events.js` pueda leer los pagos al guardar.

### `events-avisos.js`
Modal de confirmación de eventos pasados.

### `staff.js`
CRUD de personal, asignación a eventos, rotación de estados, WhatsApp, historial, PDF ART.

### `lista.js`
Checklist general por evento, catálogo en Firestore (`catalogoChecklist`), PDF checklist y toda la lógica de vajilla:
- `initLista()` — inicializa delegados y carga catálogo
- `renderPestanaChecklist()` — render del checklist del evento y su catálogo (incluyendo ítems de vajilla con badge de stock)
- `renderPestanaCatalogo()` — render del catálogo base (sin ítems VAJILLA)
- `renderPestanaVajilla()` — render de la pestaña vajilla con stock editable
- `ocultarDetalleTemporalmente()` / `restaurarDetalleSiHaceFalta()` — ocultan y restauran el modal detalle cuando se abre/cierra un checklist desde ahí
- `ajustarStockVajilla(itemId, delta)` — suma/resta stock vajilla (usa `Number()`)
- `ajustarStockVajillaDirecto(itemId, nuevoStock)` — edición directa por input
- `agregarChecklistItem(nombre, categoria, cantidad)` — agrega ítems al checklist; si es VAJILLA, descuenta stock
- `cambiarCantidadChecklist(index, valor)` — recalcula diferencia de stock vajilla al cambiar cantidad
- `eliminarChecklistItem(index)` — devuelve `Number(item.cantidad)` al stock vajilla al eliminar
- `window.devolverStockVajilla(nombre, cantidad)` — función global para devolver stock vajilla desde otros módulos

### `lista-cocina.js`
Checklist de cocina por evento, catálogo en Firestore (`catalogoChecklistCocina`), pestaña 🧊 Cámara, panadería y PDF cocina:
- `initListaCocina()` — inicializa delegados y carga catálogo cocina
- `renderPestanaChecklistCocina()` — render del checklist cocina y su catálogo (incluyendo ítems de cámara con badge de stock)
- `renderPestanaCatalogoCocina()` — render del catálogo base cocina (sin ítems CAMARA)
- `renderPestanaCamara()` — render de la pestaña cámara con stock editable
- `ajustarStock(itemId, delta)` — suma/resta stock cámara (usa `Number()`)
- `ajustarStockDirecto(itemId, nuevoStock)` — edición directa por input
- `agregarChecklistCocinaItem(nombre, categoria, cantidad)` — agrega ítems al checklist cocina; si es CAMARA, descuenta stock
- `cambiarCantidadChecklistCocina(index, nuevaCantidad)` — recalcula diferencia de stock cámara al cambiar cantidad
- `eliminarChecklistCocinaItem(index)` — devuelve `Number(item.cantidad)` al stock cámara al eliminar
- `enviarPedidoPanaderia()` — arma y abre WhatsApp con el pedido de ítems de categoría PANADERÍA

### `calendar.js`
Calendario FullCalendar. Lee eventos de Firestore.

---

## 🗂️ ESTRUCTURA DE UN EVENTO EN FIRESTORE

```js
{
  client: "Nombre del cliente",
  date: "2026-04-15",
  type: "Catering Completo",
  place: "Salón El Ombú",
  placeUrl: "https://maps.google.com/...",
  guests: 120,
  staffNecesario: 5,
  horaInicio: "19:00",
  horaFin: "23:00",
  horaPresentacion: "18:30",
  notes: "...",
  status: "Confirmado",       // Presupuestado / Confirmado / Realizado / Cancelado / Cerrado
  paid: false,                // cobrado total sí/no, independiente de los pagos parciales
  total: 150000,
  pagos: [                    // array de pagos parciales (puede estar vacío)
    {
      id: "pago_1234567890",
      monto: 50000,
      estado: "pagado",       // "pendiente" | "pagado"
      facturaTipo: "B/C",     // "A" | "B/C"
      facturaNumero: "",
      facturaURL: "",
      facturaNombre: "",
      facturaPath: "",
    }
  ],
  // NOTA: invoiceType, invoiceNumber, facturaURL a nivel raíz pueden existir
  // en eventos viejos — se ignoran sin problema. Los nuevos usan el array pagos.
  // NOTA: el campo deposit (seña) fue eliminado de la app pero puede existir
  // en eventos viejos de Firestore — se ignora sin problema
  invoiceType: "B/C",         // legacy — solo en eventos viejos
  invoiceNumber: "",          // legacy — solo en eventos viejos
  mensajesEnviados: [         // staff asignado al evento
    { nombre: "Juan", estado: "confirmado", telefono: "...", whatsappEnviado: true, categoria: "Mozo" }
  ],
  checklist: [
    { nombre: "Mantelería", categoria: "Ropa", preparado: true }
  ],
  alquileres: {
    vajilla: false, manteleria: false, mobiliario: false, mobiliarioTrabajo: false, notas: ""
  },
  esMultidia: false,
  jornadas: [],               // si esMultidia = true, array de objetos jornada
  realizacionConfirmada: false,
  presupuestoURL: "",
  presupuestoNombre: "",
  presupuestoPath: "",
  createdBy: "Laura",
  createdAt: Timestamp,
}
```

---

## 🧩 ESTRUCTURA DE UNA JORNADA

```js
{
  fecha: "2026-04-15",
  tipo: "Catering Completo",
  lugar: "...",
  invitados: 80,
  staffNecesario: 4,
  horaInicio: "19:00",
  horaFin: "23:00",
  horaPresentacion: "18:30",
  notas: "...",
  alquileres: { vajilla: false, manteleria: false, mobiliario: false, mobiliarioTrabajo: false, notas: "" },
  mensajesEnviados: []
}
```

---

## 🎨 CLASES CSS IMPORTANTES

### Tarjetas (`css/events.css`)
- `.event-card--hoy` → fondo rosado `#fff5f5`, sombra rojiza, borde rojo
- `.event-card--hoy .event-card__fecha::before` → agrega "🔴 HOY — " via CSS puro
- `.event-card--hoy .event-card__cliente` → texto en rojo
- `.badge-countdown` → gris (eventos lejanos)
- `.badge-countdown--hoy` → rojo
- `.badge-countdown--manana` → naranja
- `.badge-countdown--pronto` → dorado (≤7 días)
- `.filtro-estado` / `.filtro-mes` → botones de filtro (mismo estilo visual)
- `.filtros-mes-wrap` → fila de filtros por mes (oculta si hay un solo mes)

### Adjuntos en formulario (`css/events.css`)
- `.adjunto-row` → fila flex con gap 6px
- `.adjunto-select` → ancho fijo 70px
- `.adjunto-input` → flex 1
- `.btn-adjunto` → botón 38x38px oscuro
- `.btn-adjunto--ver` → azul
- `.btn-adjunto--eliminar` → rojo
- `.presupuesto-info` → texto gris con nombre del archivo adjunto

### Pagos parciales en formulario (`css/events.css`)
- `.btn-agregar-pago` → botón dorado para agregar fila de pago
- `.pago-fila` → contenedor de una fila de pago (fondo suave, border-radius 10px)
- `.pago-fila-top` → fila flex: monto + estado + eliminar
- `.pago-monto-input` → input de monto (flex 1)
- `.pago-estado-select` → select de estado (ancho 130px)
- `.pago-fila-factura` → fila flex: tipo factura + número + botones adjunto
- `.pago-factura-tipo` → select tipo (70px)
- `.pago-factura-numero` → input número (flex 1)

### Modal de detalle (`css/modals.css`)
- `.detail-bloque` → bloque con fondo suave (`var(--bg-secondary)`), border-radius 10px
- `.detail-bloque-fila` → fila flex: icono + texto
- `.detail-bloque-icono` → ancho fijo 20px
- `.detail-bloque-texto` → texto del bloque
- `.detail-pago-fila` → fila de un pago (estado + monto + factura)
- `.detail-pago-estado--pagado` → verde
- `.detail-pago-estado--pendiente` → naranja
- `.detail-pago-monto` → negrita
- `.detail-pago-factura` → gris
- `.detail-pago-resumen` → fila con totales cobrado/pendiente separada por línea
- `.detail-pago-resumen--pagado` → verde
- `.detail-pago-resumen--pendiente` → naranja

### Pestaña Cámara y Vajilla (`css/checklist.css`)
- `.camara-item` → fila flex, `flex-wrap: nowrap`, una sola línea (usado para cámara y vajilla)
- `.camara-item-nombre` → flex 1, nombre del ítem
- `.camara-item-controles` → flex con botones + / − e input de stock
- `.camara-stock` → número de stock (ahora es `<input type="number">`, no `<span>`)
- `.camara-stock--ok` → verde (más de 3)
- `.camara-stock--bajo` → naranja (3 o menos)
- `.camara-stock--vacio` → rojo (0)
- `.btn-stock--sumar` / `.btn-stock--restar` → botones circulares verde/rojo
- `.camara-stock-badge` → badge de stock en la pestaña Checklist (junto al nombre del ítem) — usado para 🧊 cámara y 🍽 vajilla
- `.camara-cantidad-input--mini` → input de cantidad en checklist (58px)
- `.btn-camara-mini` → botón redondo naranja con ↑ para agregar al checklist (cocina)
- `.btn-camara-mini--ya` → verde apagado con ✔ (ya agregado)
- `.btn-camara-mini--sin-stock` → gris con ✕ (sin stock)
- `.btn-general-mini` → botón redondo para agregar vajilla al checklist general (mismo estilo que btn-camara-mini)
- `.btn-general-mini--ya` → verde apagado con ✔ (vajilla ya agregada)
- `.btn-general-mini--sin-stock` → gris con ✕ (vajilla sin stock)

---

## ⚠️ DECISIONES TÉCNICAS TOMADAS

- **Cálculo automático de staff eliminado**: el campo "personal necesario" se carga a mano, sin calcular en base a invitados.
- **Bug de zona horaria corregido**: todas las comparaciones de fecha usan `new Date().toLocaleDateString("sv").split("T")[0]` en lugar de `new Date().toISOString().split("T")[0]`. El motivo: `toISOString()` devuelve hora UTC y Argentina es UTC-3, lo que causaba que después de las 21hs el "hoy" y el countdown se adelantaran un día. Archivos corregidos: `events-render.js`, `events.js`, `events-form.js`, `events-avisos.js`, `staff.js`, `lista.js`.
- **Campo `deposit` (seña) eliminado de la app**: los eventos viejos en Firestore pueden tener ese campo pero se ignora sin problema.
- **Factura única reemplazada por pagos parciales**: los campos `invoiceType`, `invoiceNumber` y `facturaURL` a nivel raíz del evento son legacy (solo en eventos viejos). Los nuevos eventos usan el array `pagos`.
- **Campo `paid` se mantiene independiente**: es un booleano de "cobrado total" que coexiste con el array de pagos parciales.
- **Máscara de miles en montos**: los campos `total` y montos de pagos usan `type="text"` con `inputmode="numeric"`. Se formatean con `toLocaleString("es-AR")` al perder el foco y se limpian al enfocar. Se guarda siempre el número limpio en Firestore.
- **z-index `#modalAvisoSimple` en 9999**: subido desde 1200 para quedar siempre por encima de cualquier modal apilado (`.modal-checklist` tiene z-index 2600).
- **Stock de cámara y vajilla siempre con `Number()`**: todas las operaciones de stock usan `Number()` explícito para evitar concatenación de strings. Afecta `ajustarStock`, `ajustarStockVajilla`, `eliminarChecklistCocinaItem`, `eliminarChecklistItem` y las funciones de cambiar cantidad.
- **Listener `change` en modal de checklist cocina**: maneja dos acciones: `cantidad-checklist-cocina` (cambia cantidad de ítem en checklist) y `editar-stock-directo` (edita stock de cámara con input numérico).
- **Listener `change` en modal de checklist general**: maneja `cantidad-checklist` (cambia cantidad) y `editar-stock-vajilla` (edita stock de vajilla con input numérico).
- **Categoría CAMARA bloqueada en catálogo cocina**: filtrada del select y validada al guardar, bloqueando `"CAMARA"` y `"CÁMARA"` (con tilde).
- **Categoría VAJILLA bloqueada en catálogo general**: filtrada del select y validada al guardar. Los ítems de vajilla solo se agregan desde la pestaña 🍽 Vajilla.
- **`lista.js` dividido en dos archivos**: checklist general + vajilla en `lista.js`; checklist cocina + cámara + panadería en `lista-cocina.js`. Ambos se inicializan desde `main.js` (`initLista()` e `initListaCocina()`). Los helpers compartidos (`agruparPorCategoria`, `renderCatalogoHTML`, `ocultarDetalleTemporalmente`, `restaurarDetalleSiHaceFalta`) están copiados en ambos archivos para independencia.
- **Modal detalle + checklist**: al abrir checklist general o cocina desde el detalle, el modal detalle se oculta temporalmente y se restaura al cerrar el checklist. No se cierra definitivamente.
- **Tipografía del checklist**: para aprovechar mejor el ancho en celular, los nombres de ítems, categorías, tabs y títulos del modal checklist usan `Roboto Condensed`.
- **Calendario FullCalendar**: los eventos `Presupuestado` (amarillos) muestran el texto en negro para mejorar contraste. En FullCalendar esto se resolvió atacando `.fc-event-title` / `.fc-event-time`, no solo las variables del badge.

---

## 📋 REGLAS DE TRABAJO

1. **Paso a paso** → nada de cambios gigantes
2. **Sin romper lo que funciona** → cambios seguros primero
3. **Instrucciones concretas** → "Abrí X, buscá Y, pegá debajo de Z"
4. **Explicación simple** → sin tecnicismos innecesarios
5. **Respetar estructura** → no mezclar todo en un archivo
6. **No duplicar lógica** → usar el archivo correcto
7. **No sobrecargar `main.js`** → la lógica va en el módulo que corresponde
8. **Separar lógica de render** → lógica en `events.js`, HTML en `events-render.js`

---

## 🚀 CONTEXTO FINAL

App de uso interno para equipo chico de catering.
Debe ser simple, rápida, clara y usable desde el celular.
Apunta a resolver tareas reales del día a día.

---

*Fin del contexto — v8, actualizado 09/04/2026*
