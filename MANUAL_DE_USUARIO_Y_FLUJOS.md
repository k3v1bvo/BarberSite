# Manual de Usuario y Flujos del Sistema BarberSite

Este documento es una guía exhaustiva y profesional que detalla el funcionamiento lógico, el propósito y el flujo de trabajo de cada página visible en la aplicación BarberSite. Está diseñado para entender a fondo cómo opera el sistema integralmente.

---

## 1. Introducción y Arquitectura de Roles

BarberSite no es solo una página web, es un **ERP (Enterprise Resource Planning)** diseñado específicamente para el rubro de las barberías. Gestiona clientes, reservas, inventarios, planillas de empleados, caja chica, y la imagen pública del negocio.

El sistema se divide según **Roles de Usuario**:
- **Cliente**: Entra a reservar citas, ver su historial y nivel de fidelidad (Bronce, Plata, Oro), y comprar productos.
- **Barbero**: Entra a revisar qué citas tiene programadas en el día, marcar su asistencia y ver sus comisiones.
- **Coordinador (Recepción/Caja)**: Encargado del día a día operativo. Maneja el POS (punto de venta), cobra, gestiona caja chica, aprueba adelantos, y penaliza faltas.
- **Administrador**: Dueño o gerente general. Tiene poder absoluto para ver reportes financieros, configurar reglas de comisiones, precios, y asignar roles a otros.

---

## 2. Flujos Públicos (Lo que ve el visitante)

### 2.1. Home (`/`)
- **Propósito**: Es la "Landing Page" que vende la experiencia.
- **Funcionamiento**: Extrae información dinámica configurada por el administrador (imágenes de fondo, textos, equipo, testimonios). Si un cliente no está logueado, le muestra botones de acción para "Registrarse" o "Iniciar Sesión".
- **Componentes**: Hero (Inicio), Acerca de Nosotros, Servicios Destacados, Nuestro Equipo, Galería/Portafolio, y Testimonios.

### 2.2. Flujo de Reservas (`/reservar`)
- **Propósito**: Permitir que cualquier persona agende un servicio.
- **Flujo**:
  1. El cliente selecciona los servicios que desea.
  2. Elige a su barbero favorito (o sin preferencia).
  3. Selecciona una fecha y una hora **disponible** (el sistema bloquea automáticamente los horarios ya reservados).
  4. Confirma la cita. Si no está registrado, se le pedirá iniciar sesión o crear una cuenta rápida.

### 2.3. Tienda en Línea (`/tienda`)
- **Propósito**: Venta de productos físicos (ceras, minoxidil, aceites para barba).
- **Flujo**: El cliente añade productos al carrito y realiza un pedido. El coordinador recibe este pedido en el panel y lo procesa cuando el cliente va físicamente a recogerlo.

---

## 3. Panel de Cliente (`/cliente`)

- **Propósito**: Área personal del cliente para fidelización.
- **Flujo**:
  - **Mis Citas**: El cliente puede ver qué citas tiene programadas, cancelarlas si están a tiempo, o revisar su historial pasado.
  - **Programa de Lealtad**: El sistema calcula cuánto dinero ha gastado el cliente históricamente y le asigna un nivel (Ej: Plata). Si llega al nivel Oro, automáticamente recibe descuentos o cortes gratis según las reglas definidas por el Admin.
  - **Notificaciones**: Alertas sobre sus citas o promociones.

---

## 4. Panel de Barbero (`/barbero`)

- **Propósito**: Área de trabajo enfocada en la producción del empleado.
- **Flujo**:
  - Al iniciar su jornada, el barbero puede ver su agenda diaria filtrada exclusivamente para él.
  - **Historial de Ganancias**: Muestra en tiempo real cuánto dinero ha generado ese día y qué comisión le corresponde según los porcentajes que el Admin le haya configurado (ej: 50% por cortes).
  - No puede ver la agenda de sus compañeros ni la contabilidad del negocio.

---

## 5. Panel Operativo (Coordinador y Administrador)

Aquí es donde reside el "cerebro" del negocio. El Administrador tiene acceso a todo; el Coordinador a la gran mayoría de estas pestañas, enfocándose en la operación.

### 5.1. Operación Diaria
- **Agenda Global (`/agenda`)**: Un calendario interactivo que muestra las columnas de todos los barberos. El coordinador puede arrastrar citas, cancelarlas, o forzar una reserva manual si alguien llama por teléfono.
- **Caja / POS (`/admin/caja`)**: El punto de venta. Cuando un cliente termina su corte, el coordinador va a la caja, busca la cita del cliente, y le da a "Cobrar". En ese instante suceden 3 cosas de fondo:
  1. La cita pasa a estado "Completada".
  2. Se calcula la comisión del barbero y se guarda para la nómina.
  3. Se registra el dinero ingresado en "Ventas/Servicios" para el arqueo final.
- **Asistencia (`/admin/asistencia`)**: Los barberos marcan su entrada y salida. El coordinador supervisa quién llegó tarde.
- **Sincronizar Historial (`/admin/sincronizar`)**: Permite vincular citas y pagos antiguos (que se hicieron sin que el cliente tuviera cuenta) al perfil nuevo del cliente una vez que se registra.

### 5.2. Flujo de Caja y Contabilidad
Todo el dinero del negocio se maneja a través de estos submódulos, evitando el uso de cuadernos físicos.
- **Ventas / Servicios (`/coordinador/ventas`)**: Registro automático de cada corte cobrado. También permite registros manuales de productos vendidos.
- **Caja Chica (`/coordinador/caja-chica`)**: Dinero en efectivo para gastos diarios y **Adelantos**. Si un barbero pide un adelanto de su sueldo, se anota aquí; el sistema luego lo restará automáticamente de sus comisiones de fin de mes.
- **Egresos (`/coordinador/egresos`)**: Gastos fijos (Agua, luz, alquiler, facturas).
- **Banco (`/coordinador/banco`)**: Depósitos o pagos por QR. El sistema separa lo que está "físicamente en la caja del local" de lo que "entró directo al banco".
- **Arqueo de Caja (`/coordinador/arqueo`)**: Al final del día, el coordinador cuenta los billetes, ingresa el monto, y el sistema le dice si sobra, falta o cuadra perfectamente contra todas las transacciones registradas.

### 5.3. Recursos Humanos y Nómina
- **Comisiones (`/admin/comisiones`)**: Genera el recibo de pago para cada barbero. El sistema suma todos sus cortes, calcula su porcentaje, **resta** los adelantos que pidió, **resta** las sanciones, y **suma** los bonos. Da el monto final a pagar.
- **Sanciones (`/coordinador/sanciones`)**: Multas económicas por tardanzas, material roto o quejas.
- **Bonos (`/coordinador/bonos`)**: Premios económicos (ej. bono de puntualidad, empleado del mes).

### 5.4. Control e Inventario
- **Inventario (`/admin/productos`)**: Registro de productos. Cuando se vende una cera en el POS, se descuenta 1 unidad automáticamente de aquí.
- **Conteo Físico (`/admin/inventario-fisico`)**: Permite al encargado contar cuántas pomadas hay realmente en vitrina y ajustar el sistema si algo se perdió o se dañó.

### 5.5. Configuración y Ajustes (`/admin/configuracion`)
- **Imágenes Públicas**: Desde aquí se carga el link del Código QR para pagos, y se modifica la portada de la página web (textos e imágenes).
- **Moderación de Reseñas (`/admin/resenas`)**: Permite leer los comentarios de los clientes después de un servicio y decidir (con el botón "Hacer Público") cuáles se muestran en la página de inicio como testimonios.
- **Reglas Laborales (`/admin/reglas-laborales`)**: El administrador define aquí las reglas globales (cuánto porcentaje estándar gana un barbero nuevo, reglas de los bonos).

---

## Resumen del Flujo Principal de una Cita
Para entender el sistema, el ciclo de vida de una cita es el siguiente:
1. **Creación**: El Cliente reserva desde su móvil (o el Coordinador la crea manualmente en `/agenda`).
2. **Ejecución**: El Barbero ve la cita en `/barbero`, realiza el corte y avisa a caja.
3. **Cobro**: El Coordinador entra a `/admin/caja`, cobra el corte.
4. **Consecuencias Automáticas**:
   - Ingresa dinero a `/coordinador/ventas`.
   - El barbero gana su comisión en `/admin/comisiones`.
   - El cliente gana puntos para `/admin/lealtad`.
   - Se le envía al cliente un email/notificación para que deje una reseña, la cual luego cae a `/admin/resenas` para ser moderada.

*Documento generado para el control, mantenimiento e inducción del personal que opere el sistema BarberSite.*
