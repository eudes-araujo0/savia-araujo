# Sávia Araújo — Makeup, Noivas & Fotografia

Projeto completo em Next.js para publicar na Vercel, com serviços de maquiagem, Dia da Noiva e Pacote Boss, banco PostgreSQL da Neon, painel administrativo protegido e checkout InfinitePay.

## O que já funciona

- site e portfólio responsivos;
- catálogo com Make Express, Make Social, Make & Hair, três experiências de noiva e três versões do Pacote Boss;
- agendamento com bloqueio de horários já reservados;
- reserva exclusiva da data para os pacotes de noiva;
- escolha entre sinal de 50% ou pagamento integral;
- checkout InfinitePay (Pix e cartão) com confirmação por webhook e conferência direta na API;
- modo de demonstração sem cobrança real;
- login administrativo por usuário e senha;
- agenda inteligente com duração por serviço, bloqueio manual e pré-reserva de 30 minutos;
- criação e edição de atendimentos, clientes pagos, pendentes, financeiro, despesas e comprovantes no painel;
- agendamentos, receitas, despesas, saldos e resultado agrupados por dia, com exportação CSV;
- confirmação automática da InfinitePay e confirmação manual restrita ao acesso master;
- link seguro para a cliente acompanhar, pagar novamente, cancelar ou reagendar;
- criptografia AES-GCM dos dados pessoais e rate limit persistente no login e no agendamento;
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
| `PAYMENT_PROVIDER` | Use `infinitepay` para a integração principal. |
| `INFINITEPAY_HANDLE` | InfiniteTag da Sávia, sem o caractere `$`. |
| `MERCADO_PAGO_ACCESS_TOKEN` | Access Token da aplicação no Mercado Pago. |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Assinatura secreta configurada no webhook. |
| `CRON_SECRET` | Segredo usado pela Vercel para proteger o envio diário de lembretes. |
| `NOTIFICATION_WEBHOOK_URL` | Webhook opcional de WhatsApp/automação para avisos. |
| `NOTIFICATION_WEBHOOK_SECRET` | Segredo enviado no webhook de notificações. |
| `RESEND_API_KEY` | Chave opcional para enviar e-mail à cliente. |
| `NOTIFICATION_FROM_EMAIL` | Remetente validado no serviço de e-mail. |
| `NOTIFICATION_OWNER_EMAIL` | E-mail da Sávia para receber avisos da agenda. |
| `BUSINESS_ADDRESS` | Endereço incluído nos lembretes, quando configurado. |

Nunca publique o arquivo `.env.local` nem coloque senhas ou chaves diretamente no código. Para gerar os segredos no PowerShell:

```powershell
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$rng.Dispose()
```

Para gerar o hash da senha sem gravar a senha no histórico do terminal:

```powershell
$senha = Read-Host "Senha master da Sávia" -MaskInput
$senha | npm run hash-password --silent
```

Copie apenas o resultado para `ADMIN_PASSWORD_HASH`. Depois remova `ADMIN_PASSWORD` da Vercel. A aplicação usa o hash quando as duas variáveis existem.

Durante a apresentação, use `PAYMENTS_DEMO_MODE=true`. Para produção, altere para `false`, use `PAYMENT_PROVIDER=infinitepay`, informe a `INFINITEPAY_HANDLE` e faça um novo deploy.

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

## 5. Ativar a InfinitePay

No aplicativo ou painel web da InfinitePay:

1. acesse **Vendas > Checkout > Configurações**;
2. habilite o Checkout Integrado;
3. copie a InfiniteTag para `INFINITEPAY_HANDLE`, sem `$`;
4. configure `PAYMENT_PROVIDER=infinitepay` e `PAYMENTS_DEMO_MODE=false` na Vercel;
5. faça um novo deploy. O próprio site informa à InfinitePay o webhook:

```text
https://SEU-DOMINIO/api/infinitepay/webhook
```

O agendamento nasce como pendente. A cliente escolhe sinal de 50% ou valor integral e a reserva só muda para confirmada quando a transação é conferida pela API da InfinitePay. O `order_nsu`, o valor, o identificador da transação e o pedido do banco são validados antes da confirmação. Pendências ficam na aba **Pendências**; o financeiro considera apenas pagamentos aprovados e saldos registrados. O comprovante digital da InfinitePay fica disponível no painel quando retornado pelo checkout.

O Mercado Pago continua no código como alternativa: use `PAYMENT_PROVIDER=mercado_pago` e as duas variáveis `MERCADO_PAGO_*` se quiser reativá-lo.

## Segurança aplicada

- segredos somente em variáveis de ambiente do servidor;
- cookies de sessão `HttpOnly`, `Secure` em produção, `SameSite=Strict` e assinatura HMAC verificada;
- senha master com PBKDF2-SHA256 e 310 mil iterações;
- bloqueio por 15 minutos após cinco falhas de login;
- validação estrita de campos, bloqueio de campos extras e rejeição de uploads públicos;
- dados pessoais criptografados com AES-GCM antes de serem gravados;
- RLS forçado nas tabelas de reservas, bloqueios, despesas, notificações e limites de acesso, além da revogação do papel `PUBLIC`;
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

Após o deploy, primeiro teste com `PAYMENTS_DEMO_MODE=true`. Em seguida, ative a InfinitePay, faça uma cobrança real de valor baixo e confirme: retorno ao site, webhook, mudança automática para pago, comprovante, agrupamento do dia e valores do financeiro.
