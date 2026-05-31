# CECOPEL 2.0 — Robô (Tauri + Rust)

App desktop cross-platform (macOS, Windows, Linux) que monitora uma pasta no computador do escritório, identifica arquivos fiscais (SPED, DCTFWeb, DIRBI, guias, recibos) e envia automaticamente para a API CECOPEL. Roda em segundo plano com ícone na bandeja do sistema; o usuário só interage para login, escolha de pasta e ver atividade.

## Arquitetura interna

```
robot/
├── package.json, vite.config.ts, tsconfig.json, tailwind.config.ts
├── index.html
├── src/                            # Webview (React + Vite)
│   ├── main.tsx                    # entrypoint
│   ├── App.tsx                     # roteador de telas (loading → login → setup → status)
│   ├── styles.css
│   ├── lib/
│   │   ├── tauri.ts                # ponte tipada para os comandos Rust
│   │   └── ui.tsx                  # Card / Button / Input / Pill
│   └── screens/
│       ├── Login.tsx               # email+senha → JWT no chaveiro
│       ├── Setup.tsx               # escolha da pasta monitorada
│       └── Status.tsx              # status ao vivo + log de eventos
└── src-tauri/                      # Rust core
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── build.rs
    ├── icons/                      # PNG/ICNS/ICO (ver icons/README.txt)
    └── src/
        ├── main.rs                 # entrypoint Tauri + comandos + tray
        ├── error.rs                # RoboError com thiserror
        ├── config.rs               # config persistente (JSON em ~/Library/Application Support)
        ├── auth.rs                 # login Supabase + JWT no Keychain/Credential Manager
        ├── identifier.rs           # regex matching contra catálogo
        ├── parser/
        │   ├── mod.rs              # trait FileParser
        │   └── sped.rs             # parser do registro 0000 do SPED
        ├── uploader.rs             # cliente HTTP TLS → API Go
        ├── watcher.rs              # FS watcher cross-platform (notify + debounce 2s)
        └── pipeline.rs             # orquestra: arquivo → identifica → parser → upload
```

## Como funciona o pipeline

1. **Watcher** (`watcher.rs`) observa a pasta configurada usando o crate `notify` (FSEvents no macOS, ReadDirectoryChangesW no Win, inotify no Linux). Debounce de 2s evita disparar enquanto o arquivo ainda está sendo escrito.
2. **Pipeline** (`pipeline.rs`) recebe cada path novo. Para cada arquivo:
   1. **Identifier** (`identifier.rs`) testa o nome do arquivo contra os regex do catálogo (ex: `^DCTFWEB_(\d{14})_(\d{6})\.txt$`). Se nenhum bate, o arquivo é ignorado.
   2. **Parser** (`parser/sped.rs`) lê o conteúdo para extrair CNPJ e competência quando o nome não trouxer (ex: SPED EFD sempre tem CNPJ no registro 0000).
   3. **Uploader** (`uploader.rs`) envia via `POST /api/v1/robo/upload` (multipart) com Bearer JWT no header.
3. **API Go** recebe, valida o JWT, localiza/cria a entrega, registra arquivo + evento, devolve `{entrega_id, arquivo_id, status}`.
4. **Frontend** ouve esses eventos via `app.emit("pipeline://event", ...)` e atualiza o log em tempo real.

## Segurança

- Senha **nunca** é gravada — só usada para obter o JWT na primeira vez.
- JWT (access + refresh) fica no **chaveiro nativo do SO**:
  - macOS: Keychain
  - Windows: Credential Manager
  - Linux: Secret Service / kwallet
- Todo tráfego é TLS (`rustls`), sem dependência da OpenSSL do sistema.
- O app valida hash SHA-256 do arquivo no upload contra o que ele mesmo calculou — se a transmissão corromper, a API devolve 409.

## Pré-requisitos para desenvolver

- **Rust** 1.77+: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Node.js** 20+
- Para builds nativos:
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Windows: Visual Studio Build Tools + WebView2 Runtime
  - Linux: `webkit2gtk-4.1-dev libsoup-3.0-dev` (Ubuntu/Debian)

## Rodar em desenvolvimento

```bash
cd robot/
npm install

# Configurar URL do Supabase no webview (pode usar .env do Vite)
echo "VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co"     >  .env
echo "VITE_SUPABASE_ANON_KEY=eyJ..."                         >> .env

# Sobe o webview (Vite) + o Rust nativo, com hot-reload
npm run tauri:dev
```

A primeira execução vai compilar o Rust (~3-5 min). Próximas execuções caem para ~10s.

## Build de produção

```bash
npm run tauri:build
```

Saídas:
- macOS: `.dmg` + `.app`
- Windows: `.msi` + `.exe`
- Linux: `.AppImage` + `.deb`

Tudo em `src-tauri/target/release/bundle/`.

## Distribuição

Recomendação para começar:

1. Build manual no Mac (gera `.dmg` para macOS) e em uma VM Windows (gera `.msi`)
2. Subir cada artefato para um bucket público (Supabase Storage com bucket "releases" ou GitHub Releases)
3. Auto-updater fica para a Fase 5.1 — `tauri-plugin-updater` é built-in mas exige um manifesto assinado e um endpoint de updates

Para começar a distribuir antes do auto-updater, o escritório recebe um link de download e instala manualmente. Atualizações também por reinstalação.

## Configurar para apontar para a sua API

Edite `src-tauri/src/config.rs` → constante `api_url` (default) ou troque pelo painel:
- Webview tem (em telas futuras) campo de Configurações → URL da API
- Por enquanto: rodar `npm run tauri:dev` com `default.api_url = "http://localhost:8080"` na config inicial, ou editar manualmente `~/Library/Application Support/br.CECOPEL.robot/config.json` após o primeiro start

## Estrutura do upload (multipart)

```
POST /api/v1/robo/upload
Authorization: Bearer <jwt-supabase>
Content-Type: multipart/form-data; boundary=...

--boundary
Content-Disposition: form-data; name="metadata"

{
  "obrigacao_codigo": "DCTFWeb",
  "obrigacao_id": "uuid...",
  "cnpj_extraido": "12345678000199",
  "competencia": "2026-05",
  "parser_tipo": "dctfweb",
  "hostname": "macbook-de-caroline",
  "sha256": "abcd...",
  "tamanho_bytes": 14523,
  "versao_robo": "0.1.0"
}

--boundary
Content-Disposition: form-data; name="file"; filename="DCTFWEB_12345678000199_202605.txt"
Content-Type: application/octet-stream

<bytes do arquivo>
--boundary--
```

Resposta de sucesso (201):

```json
{ "entrega_id": "uuid", "arquivo_id": "uuid", "status": "aguardando_cliente" }
```

Resposta de quarentena (202) quando CNPJ/competência não puderam ser extraídos:

```json
{ "error": "quarantine", "detail": "..." }
```

## Próximas iterações

- Upload assinado (backend devolve URL, robô envia direto ao Storage — escala melhor com arquivos grandes)
- Auto-updater com manifesto assinado
- Tela de quarentena no webview (arquivos não identificados → user classifica manualmente)
- Mais parsers: DCTFWeb, DIRBI, EFD-ICMS, eSocial
- Suporte para múltiplas pastas
- Pausar/retomar pelo tray
