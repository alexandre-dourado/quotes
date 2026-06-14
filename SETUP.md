# QUOTES — Setup Guide

## 1. GAS Backend

### 1.1 Criar projeto

1. Acesse [script.google.com](https://script.google.com)
2. Crie um novo projeto: **Quotes Backend**
3. Cole o conteúdo de `backend/Code.gs`

### 1.2 Configurar propriedades

No GAS, abra o console (botão ▶ → executar função) e execute:

```javascript
setupGithub(
  'SEU_GITHUB_PAT_AQUI',     // token com escopo repo
  'alexandre-dourado',
  'quotes',
  'quotes.json'
)
```

Depois execute `setupSheet()` para criar a aba de backup no Spreadsheet.

### 1.3 Inicializar repositório

Execute `initializeRepository()` para criar o arquivo `quotes.json` vazio no GitHub.

> **Importante:** o token GitHub precisa do escopo `repo` (repositório privado).
> Crie em: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
> Permissão necessária: **Contents** → Read and write

### 1.4 Deploy como Web App

1. Clique em **Implantar → Nova implantação**
2. Tipo: **Web App**
3. Executar como: **Minha conta**
4. Quem tem acesso: **Qualquer pessoa** *(necessário para o frontend)*
5. Clique em **Implantar**
6. Copie a **URL de implantação** (formato: `https://script.google.com/macros/s/AK...A/exec`)

---

## 2. Frontend

### 2.1 Configurar URL do GAS

Em `frontend/index.html`, localize a linha:

```javascript
const GAS_URL = 'YOUR_GAS_DEPLOYMENT_URL_HERE';
```

Substitua pelo URL copiado no passo 1.4.

### 2.2 Ícones PWA (opcional)

Coloque na pasta `frontend/`:
- `icon-192.png` (192×192px)
- `icon-512.png` (512×512px)

### 2.3 Deploy na Vercel

```bash
# Instale a CLI da Vercel (se necessário)
npm i -g vercel

# Na pasta frontend/
cd frontend
vercel --prod
```

Ou conecte o repositório diretamente pelo painel [vercel.com](https://vercel.com).

Configure o **Root Directory** como `frontend` nas configurações do projeto.

---

## 3. Verificação

Após o deploy:

1. Acesse a URL da Vercel
2. Clique no botão **Sync** (ícone de refresh no nav)
3. Se retornar "Sincronizado." — tudo funcionando
4. Adicione sua primeira citação com o botão **+**

---

## 4. Estrutura de arquivos

```
quotes/
├── backend/
│   └── Code.gs          # Cola no Google Apps Script
└── frontend/
    ├── index.html        # App completo (single file)
    ├── manifest.json     # PWA manifest
    ├── service-worker.js # Offline support
    ├── vercel.json       # Deploy config
    ├── icon-192.png      # (você adiciona)
    └── icon-512.png      # (você adiciona)
```

---

## 5. Uso

| Ação | Como |
|------|------|
| Adicionar citação | Botão `+` (canto inferior direito) |
| Editar citação | Hover na citação → Editar |
| Excluir citação | Hover na citação → Excluir |
| Pesquisar | Campo de busca na view All |
| Sincronizar | Botão refresh no nav, ou automático ao reconectar |
| Importar JSON | Botão "Importar JSON" na toolbar |
| Exportar JSON | Botão "Exportar JSON" na toolbar |
| Exportar Markdown | Botão "Exportar Markdown" na toolbar |
| Instalar PWA | Banner do browser ou "Adicionar à tela inicial" |

---

## 6. Atualizar o GAS após mudanças

Toda vez que editar o `Code.gs`:
1. GAS → Implantar → Gerenciar implantações
2. Editar → Nova versão → Implantar
