Ícones do app — colocar aqui:
  - 32x32.png, 128x128.png, 128x128@2x.png
  - icon.icns (macOS)
  - icon.ico (Windows)
  - tray-icon.png (16x16 ou 32x32 monocromático, template em macOS)

Gerar a partir de um PNG-base de 1024x1024:
  npm run tauri icon path/para/icon.png

Ou crie manualmente. Enquanto não existirem, o build pode falhar ou o tray
cair pro fallback definido em src-tauri/src/main.rs.
