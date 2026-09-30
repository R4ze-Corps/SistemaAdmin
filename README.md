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

## Contas e login

Configure `ADMIN_LOGIN` e `ADMIN_SETUP_KEY` em `.env.local` e nas variáveis da Vercel.
A chave deve ser aleatória, secreta e ter pelo menos 32 caracteres. Gere uma com
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Nunca use uma variável `NEXT_PUBLIC_` para a chave.

Na tela de cadastro, use o nome de login configurado e abra **Configurar conta administradora**
para informar a chave. A conta administradora recebe acesso imediato ao painel existente.
Os demais cadastros ficam pendentes: o administrador usa **Contas** para aprovar ou bloquear.
Todas as contas aprovadas compartilham o mesmo painel e podem alterar todos os dados.
Bloquear uma conta invalida suas sessões. A conta administradora não pode ser bloqueada pela interface.

Novas senhas exigem 4 a 8 caracteres e são armazenadas com scrypt e salt aleatório.
Senhas antigas mais longas continuam aceitas no login (até 128 caracteres).
Senhas curtas são menos seguras; a limitação de tentativas e a aprovação de contas permanecem ativas.
As sessões duram sete dias, usam cookies HttpOnly (Secure em produção) e somente o hash
do token fica no MongoDB. Login/cadastro têm limitação persistente de tentativas, e
as operações de escrita verificam a origem. APIs de dados, documentos e tokens de upload
exigem uma conta aprovada; callbacks do Blob continuam sendo validados pelo SDK.
O acesso usa nome de login e senha, sem exigir e-mail. O login tem 3 a 50 caracteres
(letras, números, espaços, ponto, hífen ou sublinhado), não diferencia maiúsculas/minúsculas
e deve ser único. O nome de exibição continua separado do login.
Contas antigas sem login podem entrar usando o nome de exibição e a senha existentes,
desde que o nome seja válido e não haja duplicidade; o login é associado após autenticação.
Nomes antigos inválidos ou duplicados precisam de ajuste pelo responsável do banco.
Os e-mails antigos são preservados, mas não são aceitos para entrar.
Substitua a antiga variável `ADMIN_EMAIL` por `ADMIN_LOGIN`. Não há recuperação de senha nesta versão.
As coleções `users`, `auth_sessions` e `auth_limits` são criadas ao utilizar a autenticação.
Os dados existentes em `app_state` e os documentos no Blob não são migrados nem apagados.

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
3. Cadastre `MONGODB_URI`, `MONGODB_DB`, `BLOB_READ_WRITE_TOKEN`, `ADMIN_LOGIN` e `ADMIN_SETUP_KEY` nas variáveis de ambiente do projeto.
4. Faça o deploy.

Antes de publicar, valide com:

```bash
npm run build
```
