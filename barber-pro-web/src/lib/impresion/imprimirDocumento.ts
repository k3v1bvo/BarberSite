/**
 * Utilidades de impresión profesional para Barber Site
 * Genera ventanas limpias en blanco y negro de alta resolución
 * compatibles con impresoras térmicas de tickets y hojas A4/Carta para PDF.
 */

export interface DatosActaArqueo {
  fecha: string
  usuario?: string
  saldoApertura: number
  totalIngresoDia: number
  totalEgresoDia: number
  saldoTotalSistema: number
  saldoFisicoContado: number
  diferencia: number
  totalBancoDia: number
  totalBancoAcumulado: number
  totalFacturado: number
  observaciones?: string
  movimientos?: Array<{
    id?: string
    hora?: string
    libro?: string
    tipo?: string
    concepto?: string
    metodo_pago?: string
    monto: number
  }>
}

export function imprimirActaArqueo(datos: DatosActaArqueo) {
  const win = window.open('', '_blank', 'width=900,height=800')
  if (!win) {
    alert('Por favor permite las ventanas emergentes en tu navegador para imprimir.')
    return
  }

  const fechaFormateada = datos.fecha.split('-').reverse().join('/')
  const horaEmision = new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
  const estaCuadrado = Math.abs(datos.diferencia) < 0.1
  const estadoTexto = estaCuadrado ? '✔ CUADRA' : (datos.diferencia > 0 ? `SOBRANTE (+Bs ${datos.diferencia.toFixed(2)})` : `FALTANTE (-Bs ${Math.abs(datos.diferencia).toFixed(2)})`)
  const estadoColor = estaCuadrado ? '#15803d' : '#b91c1c'

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Acta de Arqueo y Cierre - ${fechaFormateada}</title>
      <style>
        @page { size: letter; margin: 15mm; }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 20px;
          font-size: 11px;
          line-height: 1.4;
        }
        .header {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .brand {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .doc-title {
          font-size: 13px;
          font-weight: 800;
          color: #334155;
          text-transform: uppercase;
          margin-top: 2px;
        }
        .meta-box {
          text-align: right;
          font-size: 10px;
          color: #475569;
        }
        .grid-totales {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 18px;
        }
        .card {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 10px;
          background: #f8fafc;
        }
        .card-label {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 3px;
        }
        .card-val {
          font-size: 15px;
          font-weight: 900;
          font-family: monospace;
          color: #0f172a;
        }
        .card-highlight {
          background: #eff6ff;
          border-color: #3b82f6;
        }
        .banner-arqueo {
          border: 2px solid #0f172a;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fdfefe;
        }
        .badge-estado {
          padding: 6px 14px;
          border-radius: 6px;
          font-weight: 900;
          font-size: 13px;
          text-transform: uppercase;
          color: #fff;
          background: ${estadoColor};
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 10px;
        }
        th {
          background: #f1f5f9;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 9px;
          color: #334155;
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          text-align: left;
        }
        td {
          border: 1px solid #e2e8f0;
          padding: 5px 8px;
        }
        tr:nth-child(even) { background: #f8fafc; }
        .num { text-align: right; font-family: monospace; }
        .firmas {
          margin-top: 40px;
          display: flex;
          justify-content: space-around;
          page-break-inside: avoid;
        }
        .linea-firma {
          width: 220px;
          border-top: 1px solid #0f172a;
          padding-top: 6px;
          text-align: center;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: #334155;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">BARBER SITE</div>
          <div class="doc-title">Acta Oficial de Arqueo y Cierre de Caja</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Control diario de efectivo, cobros digitales y cuadre físico de gaveta</div>
        </div>
        <div class="meta-box">
          <div><strong>Fecha Arqueo:</strong> ${fechaFormateada}</div>
          <div><strong>Hora Emisión:</strong> ${horaEmision}</div>
          <div><strong>Responsable:</strong> ${datos.usuario || 'Coordinador de Turno'}</div>
        </div>
      </div>

      <!-- Resumen del Excel de Barber Site -->
      <div class="grid-totales">
        <div class="card card-highlight">
          <div class="card-label">Saldo Apertura (Ayer)</div>
          <div class="card-val">Bs ${datos.saldoApertura.toFixed(2)}</div>
        </div>
        <div class="card">
          <div class="card-label">Total Ingreso Efectivo</div>
          <div class="card-val" style="color: #16a34a;">+Bs ${datos.totalIngresoDia.toFixed(2)}</div>
        </div>
        <div class="card">
          <div class="card-label">Total Egreso Efectivo</div>
          <div class="card-val" style="color: #dc2626;">-Bs ${datos.totalEgresoDia.toFixed(2)}</div>
        </div>
        <div class="card card-highlight">
          <div class="card-label">Saldo Esperado en Gaveta</div>
          <div class="card-val">Bs ${datos.saldoTotalSistema.toFixed(2)}</div>
        </div>
      </div>

      <!-- Resultado del Arqueo / Cuadre Físico -->
      <div class="banner-arqueo">
        <div>
          <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Conteo Físico Realizado</div>
          <div style="font-size: 18px; font-weight: 900; font-family: monospace;">
            Bs ${datos.saldoFisicoContado.toFixed(2)}
            <span style="font-size: 11px; font-weight: normal; color: #64748b;">(contado en gaveta)</span>
          </div>
        </div>

        <div>
          <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Diferencia de Arqueo</div>
          <div style="font-size: 18px; font-weight: 900; font-family: monospace; color: ${estadoColor};">
            ${estaCuadrado ? 'Bs 0.00' : (datos.diferencia > 0 ? '+Bs ' : '-Bs ') + Math.abs(datos.diferencia).toFixed(2)}
          </div>
        </div>

        <div>
          <span class="badge-estado">${estadoTexto}</span>
        </div>
      </div>

      <!-- Canales Digitales y Facturación -->
      <div style="display: flex; gap: 12px; margin-bottom: 18px;">
        <div class="card" style="flex: 1;">
          <div class="card-label">Ingresos Digitales QR / Banco Hoy</div>
          <div class="card-val" style="color: #2563eb;">Bs ${datos.totalBancoDia.toFixed(2)}</div>
        </div>
        <div class="card" style="flex: 1;">
          <div class="card-label">Total Facturado Hoy (Servicios + Ventas)</div>
          <div class="card-val">Bs ${datos.totalFacturado.toFixed(2)}</div>
        </div>
        <div class="card" style="flex: 1;">
          <div class="card-label">Saldo Acumulado en Banco</div>
          <div class="card-val">Bs ${datos.totalBancoAcumulado.toFixed(2)}</div>
        </div>
      </div>

      ${datos.observaciones ? `
        <div style="margin-bottom: 16px; padding: 8px 12px; border: 1px dashed #94a3b8; border-radius: 6px; font-size: 10px;">
          <strong>Observaciones de Cierre:</strong> ${datos.observaciones}
        </div>
      ` : ''}

      <!-- Detalle de Movimientos del Día -->
      ${datos.movimientos && datos.movimientos.length > 0 ? `
        <div style="font-weight: 800; text-transform: uppercase; font-size: 10px; margin-bottom: 6px; color: #334155;">
          Detalle de Movimientos del Día (${datos.movimientos.length} registros)
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">Hora</th>
              <th style="width: 70px;">Tipo</th>
              <th style="width: 80px;">Libro</th>
              <th>Concepto / Glosa</th>
              <th style="width: 80px;">Método Pago</th>
              <th style="width: 80px; text-align: right;">Monto (Bs)</th>
            </tr>
          </thead>
          <tbody>
            ${datos.movimientos.map(m => `
              <tr>
                <td style="font-family: monospace;">${m.hora || '--:--'}</td>
                <td><strong style="color: ${m.tipo === 'EGRESO' ? '#dc2626' : '#16a34a'};">${m.tipo || 'INGRESO'}</strong></td>
                <td>${m.libro || 'SERVICIOS'}</td>
                <td>${m.concepto || 'Servicio en barbería'}</td>
                <td style="text-transform: uppercase;">${m.metodo_pago || 'efectivo'}</td>
                <td class="num"><strong>${m.monto.toFixed(2)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div style="margin-bottom: 20px; font-size: 10px; color: #64748b;">No hay movimientos individuales registrados para este corte.</div>'}

      <!-- Bloque de Firmas -->
      <div class="firmas">
        <div class="linea-firma">
          <div>Firma Cajero / Coordinador</div>
          <div style="font-size: 8px; font-weight: normal; color: #64748b; margin-top: 2px;">Cierre y Conteo de Efectivo</div>
        </div>
        <div class="linea-firma">
          <div>Firma Supervisor / Propietario</div>
          <div style="font-size: 8px; font-weight: normal; color: #64748b; margin-top: 2px;">Auditoría y Conformidad</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `

  win.document.open()
  win.document.write(html)
  win.document.close()
}

export interface DatosTicketPOS {
  ticketNumero?: string
  fecha?: string
  hora?: string
  clienteNombre?: string
  clienteCi?: string
  barberoNombre?: string
  cajeroNombre?: string
  items: Array<{
    tipo: 'servicio' | 'producto'
    nombre: string
    cantidad: number
    precioUnitario: number
    subtotal: number
  }>
  subtotal: number
  descuento?: number
  total: number
  metodoPago: string
  montoEfectivo?: number
  montoQr?: number
  cambio?: number
  esCita?: boolean
}

export function imprimirTicketPOS(datos: DatosTicketPOS) {
  const win = window.open('', '_blank', 'width=420,height=600')
  if (!win) {
    alert('Permite las ventanas emergentes para imprimir el ticket.')
    return
  }

  const fechaStr = datos.fecha || new Date().toLocaleDateString('es-BO')
  const horaStr = datos.hora || new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Ticket ${datos.ticketNumero || ''}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body {
          font-family: 'Courier New', Courier, monospace;
          color: #000;
          background: #fff;
          width: 72mm;
          margin: 0 auto;
          padding: 8mm 2mm;
          font-size: 11px;
          line-height: 1.25;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .logo { font-size: 16px; font-weight: 900; letter-spacing: 1px; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .double-divider { border-top: 2px solid #000; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { border-bottom: 1px dashed #000; padding: 3px 0; font-size: 10px; text-transform: uppercase; }
        td { padding: 3px 0; vertical-align: top; }
        .total-box { font-size: 14px; font-weight: bold; }
        @media print {
          body { width: 100%; margin: 0; padding: 2mm; }
        }
      </style>
    </head>
    <body>
      <div class="center">
        <div class="logo">💈 BARBER SITE 💈</div>
        <div style="font-size: 9px; margin-top: 2px;">CORTES & ESTILO MASCULINO</div>
        <div>Sucre, Bolivia</div>
        <div class="divider"></div>
        <div class="bold">COMPROBANTE DE PAGO</div>
        ${datos.ticketNumero ? `<div>Ticket: #${datos.ticketNumero}</div>` : ''}
        <div>Fecha: ${fechaStr} ${horaStr}</div>
      </div>

      <div class="divider"></div>

      <div>
        ${datos.clienteNombre ? `<div><strong>Cliente:</strong> ${datos.clienteNombre}</div>` : '<div><strong>Cliente:</strong> Venta General</div>'}
        ${datos.clienteCi ? `<div><strong>C.I. / NIT:</strong> ${datos.clienteCi}</div>` : ''}
        ${datos.barberoNombre ? `<div><strong>Atendido por:</strong> ${datos.barberoNombre}</div>` : ''}
      </div>

      <div class="divider"></div>

      <table>
        <thead>
          <tr>
            <th style="text-align: left;">Cant</th>
            <th style="text-align: left;">Detalle</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${datos.items.map(item => `
            <tr>
              <td style="width: 15%;">${item.cantidad}x</td>
              <td style="width: 55%;">${item.nombre}</td>
              <td class="right" style="width: 30%;">Bs ${item.subtotal.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="divider"></div>

      <table>
        ${datos.descuento && datos.descuento > 0 ? `
          <tr>
            <td>Subtotal:</td>
            <td class="right">Bs ${datos.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Descuento Promo:</td>
            <td class="right">-Bs ${datos.descuento.toFixed(2)}</td>
          </tr>
        ` : ''}
        <tr class="total-box">
          <td>TOTAL COBRADO:</td>
          <td class="right">Bs ${datos.total.toFixed(2)}</td>
        </tr>
      </table>

      <div class="divider"></div>

      <div>
        <div><strong>Método de Pago:</strong> ${datos.metodoPago.toUpperCase()}</div>
        ${datos.metodoPago.toLowerCase() === 'mixto' ? `
          <div style="font-size: 10px; margin-left: 8px;">
            • Efectivo: Bs ${(datos.montoEfectivo || 0).toFixed(2)}<br/>
            • QR / Banco: Bs ${(datos.montoQr || 0).toFixed(2)}
          </div>
        ` : ''}
      </div>

      <div class="double-divider"></div>

      <div class="center" style="font-size: 10px; margin-top: 6px;">
        <p>¡Gracias por tu visita a Barber Site!<br/>Tu estilo en las mejores manos.</p>
        <p style="font-size: 8px; color: #555;">No válido para crédito fiscal</p>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `

  win.document.open()
  win.document.write(html)
  win.document.close()
}

export interface DatosReporteCajaChica {
  periodo: string
  saldoInicial: number
  totalIngresos: number
  totalEgresos: number
  saldoFinal: number
  responsable?: string
  movimientos: Array<{
    fecha: string
    concepto: string
    categoria?: string
    tipo: 'INGRESO' | 'EGRESO'
    metodoPago?: string
    monto: number
  }>
}

export function imprimirReporteCajaChica(datos: DatosReporteCajaChica) {
  const win = window.open('', '_blank', 'width=900,height=800')
  if (!win) {
    alert('Permite las ventanas emergentes para imprimir.')
    return
  }

  const horaEmision = new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Libro de Caja Chica - ${datos.periodo}</title>
      <style>
        @page { size: letter; margin: 15mm; }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          color: #0f172a;
          background: #fff;
          margin: 0;
          padding: 20px;
          font-size: 11px;
          line-height: 1.4;
        }
        .header {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .brand { font-size: 20px; font-weight: 900; letter-spacing: 1px; }
        .doc-title { font-size: 13px; font-weight: 800; color: #334155; text-transform: uppercase; }
        .grid-totales { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
        .card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; background: #f8fafc; }
        .card-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 3px; }
        .card-val { font-size: 15px; font-weight: 900; font-family: monospace; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
        th { background: #f1f5f9; font-weight: 800; text-transform: uppercase; font-size: 9px; border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
        td { border: 1px solid #e2e8f0; padding: 5px 8px; }
        tr:nth-child(even) { background: #f8fafc; }
        .num { text-align: right; font-family: monospace; }
        .firmas { margin-top: 40px; display: flex; justify-content: space-around; page-break-inside: avoid; }
        .linea-firma { width: 220px; border-top: 1px solid #0f172a; padding-top: 6px; text-align: center; font-size: 10px; font-weight: 800; text-transform: uppercase; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">BARBER SITE</div>
          <div class="doc-title">Libro Contable de Caja Chica</div>
          <div style="font-size: 10px; color: #64748b;">Período: ${datos.periodo}</div>
        </div>
        <div style="text-align: right; font-size: 10px; color: #475569;">
          <div><strong>Fecha Emisión:</strong> ${new Date().toLocaleDateString('es-BO')}</div>
          <div><strong>Hora:</strong> ${horaEmision}</div>
          <div><strong>Responsable:</strong> ${datos.responsable || 'Coordinador de Caja'}</div>
        </div>
      </div>

      <div class="grid-totales">
        <div class="card">
          <div class="card-label">Saldo Inicial</div>
          <div class="card-val">Bs ${datos.saldoInicial.toFixed(2)}</div>
        </div>
        <div class="card">
          <div class="card-label">Total Ingresos / Reposiciones</div>
          <div class="card-val" style="color: #16a34a;">+Bs ${datos.totalIngresos.toFixed(2)}</div>
        </div>
        <div class="card">
          <div class="card-label">Total Gastos / Egresos</div>
          <div class="card-val" style="color: #dc2626;">-Bs ${datos.totalEgresos.toFixed(2)}</div>
        </div>
        <div class="card" style="border-color: #f59e0b; background: #fffbeb;">
          <div class="card-label">Saldo Final en Caja</div>
          <div class="card-val" style="color: #d97706;">Bs ${datos.saldoFinal.toFixed(2)}</div>
        </div>
      </div>

      <div style="font-weight: 800; text-transform: uppercase; font-size: 10px; margin-bottom: 6px;">
        Detalle de Movimientos (${datos.movimientos.length} registros)
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 70px;">Fecha</th>
            <th style="width: 60px;">Tipo</th>
            <th>Concepto / Glosa</th>
            <th style="width: 90px;">Categoría</th>
            <th style="width: 70px;">Método</th>
            <th style="width: 80px; text-align: right;">Monto (Bs)</th>
          </tr>
        </thead>
        <tbody>
          ${datos.movimientos.map(m => `
            <tr>
              <td>${m.fecha}</td>
              <td><strong style="color: ${m.tipo === 'EGRESO' ? '#dc2626' : '#16a34a'};">${m.tipo}</strong></td>
              <td>${m.concepto}</td>
              <td>${m.categoria || 'Gasto General'}</td>
              <td style="text-transform: uppercase;">${m.metodoPago || 'efectivo'}</td>
              <td class="num"><strong>${m.monto.toFixed(2)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="firmas">
        <div class="linea-firma">
          <div>Firma Encargado de Caja</div>
          <div style="font-size: 8px; font-weight: normal; color: #64748b; margin-top: 2px;">Custodio de Caja Chica</div>
        </div>
        <div class="linea-firma">
          <div>Firma Administración</div>
          <div style="font-size: 8px; font-weight: normal; color: #64748b; margin-top: 2px;">Aprobación y Rendición</div>
        </div>
      </div>

      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `
  win.document.open()
  win.document.write(html)
  win.document.close()
}
