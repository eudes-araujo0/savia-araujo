# Sávia Araújo Makeup — Vercel + Neon

Projeto completo em Next.js para publicar na Vercel, com banco PostgreSQL da Neon, painel administrativo protegido e integração de sinal de 50% pelo Mercado Pago.

## O que já funciona

- site e portfólio responsivos;
- agendamento com bloqueio de horários já reservados;
- escolha entre sinal de 50% ou pagamento integral;
- checkout do Mercado Pago e confirmação por webhook;
- modo de demonstração sem cobrança real;
- login administrativo por usuário e senha;
- agenda, clientes pagos, clientes pendentes, financeiro e pagamentos no painel;
- sincronização automática e manual do status aprovado no Mercado Pago;
- criptografia AES-GCM dos dados pessoais e rate limit persistente no login;
- RLS ativo no PostgreSQL e acesso administrativo exclusivo da conta master;
- criação automática das tabelas no primeiro acesso ao banco.

## 1. Preparar o projeto localmente

Requisitos: Node.js 22 e npm.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`.

## 2. Criar o banco na Neon

1. Crie um projeto em `https://console.neon.tech`.
2. Na tela **Connect**, copie a connection string do PostgreSQL.
3. Use essa string como `DATABASE_URL` na Vercel.

O site executa `CREATE TABLE IF NOT EXISTS` automaticamente. Se preferir criar a estrutura manualmente, rode o conteúdo de `database/schema.sql` no SQL Editor da Neon.

## 3. Variáveis de ambiente

Cadastre estas variáveis em **Vercel > Project > Settings > Environment Variables**:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Connection string fornecida pela Neon. |
| `NEXT_PUBLIC_SITE_URL` | URL final, por exemplo `https://savia-araujo.vercel.app`. |
| `ADMIN_USERNAME` | Usuário do painel administrativo. |
| `ADMIN_PASSWORD_HASH` | Hash PBKDF2 da senha do painel (recomendado). |
| `ADMIN_PASSWORD` | Compatibilidade temporária; remova após configurar o hash. |
| `ADMIN_SESSION_SECRET` | Segredo longo e aleatório para assinar a sessão. |
| `DATA_ENCRYPTION_KEY` | Segredo com 32 ou mais caracteres para criptografar nome, contato e observações. |
| `PAYMENTS_DEMO_MODE` | `true` para demonstração; `false` para cobrança real. |
| `MERCADO_PAGO_ACCESS_TOKEN` | Access Token da aplicação no Mercado Pago. |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Assinatura secreta configurada no webhook. |

Nunca publique o arquivo `.env.local` nem coloque senhas ou chaves diretamente no código. Para gerar os segredos no PowerShell:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Para gerar o hash da senha sem gravar a senha no histórico do terminal:

```powershell
$senha = Read-Host "Senha master da Sávia" -MaskInput
$senha | npm run hash-password --silent
```

Copie apenas o resultado para `ADMIN_PASSWORD_HASH`. Depois remova `ADMIN_PASSWORD` da Vercel. A aplicação usa o hash quando as duas variáveis existem.

Durante a apresentação, use `PAYMENTS_DEMO_MODE=true` e deixe as duas variáveis do Mercado Pago vazias. Para produção, altere para `false`, informe as credenciais do Mercado Pago e faça um novo deploy.

## 4. Publicar na Vercel

Opção recomendada:

1. envie esta pasta para um repositório privado no GitHub;
2. em `https://vercel.com/new`, importe o repositório;
3. use o nome de projeto `savia-araujo`;
4. mantenha o preset **Next.js** e os comandos automáticos;
5. adicione todas as variáveis acima nos ambientes Production, Preview e Development;
6. clique em **Deploy**.

Também é possível publicar pela CLI, dentro da pasta:

```bash
npm install -g vercel
vercel
vercel --prod
```

## 5. Ativar o Mercado Pago

No painel de desenvolvedores do Mercado Pago:

1. crie ou selecione a aplicação;
2. copie o Access Token de produção para `MERCADO_PAGO_ACCESS_TOKEN`;
3. configure uma notificação Webhook do evento `payment` apontando para:

```text
https://SEU-DOMINIO/api/mercado-pago/webhook
```

4. copie a assinatura secreta do webhook para `MERCADO_PAGO_WEBHOOK_SECRET`;
5. deixe `PAYMENTS_DEMO_MODE=false` e faça um redeploy.

O agendamento nasce como pendente. A cliente escolhe pagar o sinal de 50% ou o valor integral, e a reserva só muda para confirmada quando o Mercado Pago aprova o valor escolhido. Solicitações sem aprovação ficam em **Clientes pendentes**; os indicadores financeiros consideram apenas pagamentos aprovados. O comprovante é o próprio identificador digital da transação mostrado no painel; não há upload manual de arquivos.

Ao retornar do checkout, o site confere o pagamento diretamente na API do Mercado Pago. O painel também atualiza ao recuperar o foco e a cada 30 segundos. Se a notificação atrasar, use **Sincronizar MP**; somente a sessão master pode usar **Marcar como pago**. Essa confirmação manual deve ser usada apenas após conferir a transação.

## Segurança aplicada

- segredos somente em variáveis de ambiente do servidor;
- cookies de sessão `HttpOnly`, `Secure` em produção, `SameSite=Strict` e assinatura HMAC verificada;
- senha master com PBKDF2-SHA256 e 310 mil iterações;
- bloqueio por 15 minutos após cinco falhas de login;
- validação estrita de campos, bloqueio de campos extras e rejeição de uploads públicos;
- dados pessoais criptografados com AES-GCM antes de serem gravados;
- RLS forçado nas tabelas `bookings` e `login_attempts`, além da revogação de acesso do papel `PUBLIC`;
- endpoints administrativos e arquivos restritos à sessão master.

## Acessos

- Site: `/`
- Agendamento: `/agendar`
- Login administrativo: `/admin/login`
- Painel: `/admin`

## Verificação antes de entregar

```bash
npm run lint
npm run build
```

Após o deploy, teste um agendamento com `PAYMENTS_DEMO_MODE=true`, entre no painel e confirme se ele aparece nas abas Agenda, Clientes, Financeiro e Comprovantes.
