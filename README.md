# Controle Financeiro 💰

App de **controle financeiro pessoal** que roda **100% no seu dispositivo** (PWA).
Pensado para o iPhone: você instala na tela de início e usa como um app nativo —
**offline, sem servidor, sem login**. Todos os dados ficam guardados **só no seu
celular** (IndexedDB do navegador).

## Funcionalidades

- 📝 **Lançamentos manuais** de receitas e despesas
- 📥 **Importação de extratos** em **CSV, Excel (.xlsx)** e **PDF** (extrato
  bancário e fatura de cartão) — tudo processado no próprio dispositivo
- 🏷️ **Categorização automática** por regras (editáveis) + manual
- 📊 **Dashboard** com KPIs e gráficos (gastos por categoria, receitas × despesas)
- 📈 **Projeção** de superávit/déficit nos próximos meses (recorrentes + média móvel)
- 💾 **Backup** export/importar em arquivo JSON (você controla onde guardar)
- 🔁 **Deduplicação** ao reimportar o mesmo extrato

## Como rodar localmente

```bash
npm install
npm run dev          # abre em http://localhost:5173/controle-financeiro/
```

Build de produção:

```bash
npm run build
npm run preview
```

## Como usar no iPhone (PWA)

1. Faça o deploy (veja abaixo) ou rode `npm run dev -- --host` e acesse pelo IP da
   máquina na mesma rede Wi-Fi.
2. Abra o link no **Safari**.
3. Toque em **Compartilhar → Adicionar à Tela de Início**.
4. Pronto: o app abre em tela cheia e funciona **offline**.

> Os dados ficam apenas neste dispositivo. Use **Ajustes → Exportar backup**
> periodicamente para não perder o histórico (ex.: se limpar os dados do Safari).

## Deploy (GitHub Pages)

O workflow `.github/workflows/deploy.yml` publica automaticamente a cada push na
branch `main`. Habilite uma vez em:

**Settings → Pages → Build and deployment → Source: GitHub Actions**

O app ficará em `https://<usuario>.github.io/controle-financeiro/`.

## Stack

Vite + React + TypeScript · Tailwind CSS · Dexie (IndexedDB) · Recharts ·
PapaParse · SheetJS (xlsx) · pdf.js · vite-plugin-pwa · Zod.

## Privacidade

Não há backend. Nenhum dado é enviado para a internet — tudo roda e fica no seu
navegador/dispositivo.
