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

Quando não existe administrador no MongoDB, o site mostra **Criar administrador**.
O primeiro cadastro concluído cria a conta administradora e abre o painel existente.
Não há login/senha ou chave de administrador no `.env`; configurar variáveis não cria contas.
Faça esse primeiro cadastro antes de divulgar o endereço: em um site público ainda sem
administrador, qualquer visitante pode assumir essa conta inicial.
A criação usa uma transação e um registro único em `auth_bootstrap`, evitando dois
administradores em cadastros simultâneos e liberando a tentativa se o cadastro falhar.
MongoDB precisa suportar transações (MongoDB Atlas ou replica set; não standalone).
Se já existir um administrador, ele é preservado e não há nova configuração inicial.
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
As antigas variáveis `ADMIN_EMAIL`, `ADMIN_LOGIN` e `ADMIN_SETUP_KEY` não são mais utilizadas.
Não há recuperação de senha nesta versão.
As coleções `users`, `auth_bootstrap`, `auth_sessions` e `auth_limits` são criadas ao utilizar a autenticação.
Os dados existentes em `app_state` e os documentos no Blob não são migrados nem apagados.

## Configurações

O botão **Configurações** abre perfil, senha/segurança, aparência, administração e informações do sistema.
É possível alterar nome/login (mudança de login exige senha atual), trocar senha e encerrar outras sessões.
Trocar a senha encerra todas as sessões anteriores e emite uma nova para o dispositivo atual.
O tema claro/escuro/automático é salvo na conta no MongoDB; localStorage mantém apenas um cache visual.
Administradores também acessam aprovação/bloqueio de contas e o gerenciamento de chalés.
As APIs de configurações exigem sessão aprovada e validam a origem das alterações.

### Modo Beta

Em **Configurações > Modo Beta**, cada conta pode ativar seu ambiente de testes.
Ele usa `app_state_beta` no MongoDB e `beta/<id-da-conta>/reservas/` no Blob privado.
Na primeira ativação copia apenas os chalés; reservas, financeiro e documentos começam vazios.
O tema Beta é separado do normal. Perfil, senha, sessões e permissões reais não podem ser
alterados no Beta. Desativar restaura o ambiente real e reativar recupera os testes salvos.
Não existe promoção/mesclagem de dados Beta para produção. Anexos de teste consomem armazenamento.
Cada requisição informa o ambiente explicitamente: abas antigas são bloqueadas após a troca,
e os endpoints de arquivos validam o ambiente e o dono da pasta de testes.

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
3. Cadastre `MONGODB_URI`, `MONGODB_DB` e `BLOB_READ_WRITE_TOKEN` nas variáveis de ambiente do projeto.
4. Faça o deploy.

Antes de publicar, valide com:

```bash
npm run build
```
