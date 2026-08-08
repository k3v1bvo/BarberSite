const fs = require('fs');
const path = require('path');

// Dibujar un archivo PNG binario básico o copiar el logo nativo
const logobarberPath = path.join(__dirname, '../public/logobarber.png');
const icon192Path = path.join(__dirname, '../public/icon-192.png');
const icon512Path = path.join(__dirname, '../public/icon-512.png');
const appleIconPath = path.join(__dirname, '../public/apple-touch-icon.png');
const appIconPath = path.join(__dirname, '../src/app/icon.png');

if (fs.existsSync(logobarberPath)) {
  fs.copyFileSync(logobarberPath, icon192Path);
  fs.copyFileSync(logobarberPath, icon512Path);
  fs.copyFileSync(logobarberPath, appleIconPath);
  fs.copyFileSync(logobarberPath, appIconPath);
  console.log('✅ Iconos estáticos PWA copiados exitosamente a public/');
}
