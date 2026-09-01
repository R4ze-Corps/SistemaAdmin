# Refúgio Gestão

Painel administrativo para operação de chalés: agenda de reservas, controle de entrada e saída, hóspedes, preferências, observações e documentos.

## Tecnologias

- Next.js e TypeScript
- MongoDB Atlas, usando o driver oficial
- Vercel Functions com gerenciamento de pool de conexões
- Lucide para os ícones da interface

## Desenvolvimento local

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Banco de dados

Copie `.env.example` para `.env.local` e informe a conexão do MongoDB Atlas:

```bash
MONGODB_URI=mongodb+srv://<usuario>:<senha>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=refugio_gestao
```

Nunca versione `.env` ou `.env.local`. A rota `GET /api/health` confirma a conexão ao banco depois que as variáveis forem configuradas.

## Publicação na Vercel

1. Envie este repositório para GitHub, GitLab ou Bitbucket.
2. Importe o repositório na Vercel.
3. Cadastre `MONGODB_URI` e `MONGODB_DB` nas variáveis de ambiente do projeto.
4. Faça o deploy.

Antes de publicar, valide com:

```bash
npm run build
```