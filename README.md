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
- login administrativo por usuário e senha, com redefinição segura pela própria proprietária;
- agenda inteligente com duração por serviço, bloqueio manual e pré-reserva de 30 minutos;
- criação e edição de atendimentos, clientes pagos, pendentes, financeiro, despesas e comprovantes no painel;
- agendamentos, receitas, despesas, saldos e resultado agrupados por dia, com exportação CSV;
- confirmação automática da InfinitePay e confirmação manual restrita ao acesso master;
- link seguro para a cliente acompanhar, pagar novamente, cancelar ou reagendar;
- e-mails transacionais via Resend para cliente e proprietária, com dados da venda, agendamento, comprovante e saldo restante;
- criptografia AES-GCM dos dados pessoais e rate limit persistente no login e no agendamento;
- RLS ativo no PostgreSQL e acesso administrativo exclusivo da conta master;
- biblioteca visual master para trocar todas as fotos, ajustar foco, altura e zoom separadamente no computador e celular, com histórico de versões;
- catálogo administrativo para editar nomes, descrições, itens inclusos, valores, duração e disponibilidade dos serviços;
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
| `BLOB_READ_WRITE_TOKEN` | Token adicionado automaticamente ao conectar um Vercel Blob público ao projeto. |
| `PAYMENTS_DEMO_MODE` | `true` para demonstração; `false` para cobrança real. |
| `PAYMENT_PROVIDER` | Use `infinitepay` para a integração principal. |
| `INFINITEPAY_HANDLE` | InfiniteTag da Sávia, sem o caractere `$`. |
| `MERCADO_PAGO_ACCESS_TOKEN` | Access Token da aplicação no Mercado Pago. |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Assinatura secreta configurada no webhook. |
| `CRON_SECRET` | Segredo usado pela Vercel para proteger o envio diário de lembretes. |
| `NOTIFICATION_WEBHOOK_URL` | Webhook opcional de WhatsApp/automação para avisos. |
| `NOTIFICATION_WEBHOOK_SECRET` | Segredo enviado no webhook de notificações. |
| `RESEND_API_KEY` | Chave do Resend com permissão de envio. |
| `NOTIFICATION_FROM_EMAIL` | Remetente verificado, por exemplo `Sávia Araújo <agenda@mail.seudominio.com.br>`. |
| `NOTIFICATION_OWNER_EMAIL` | E-mail da Sávia para receber solicitações, vendas, saldos e agendamentos confirmados. |
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

As variáveis `ADMIN_USERNAME` e `ADMIN_PASSWORD_HASH` criam o primeiro acesso. Depois, em **Painel > Acesso e segurança**, a proprietária pode definir seu usuário e sua senha definitivos. A partir desse primeiro salvamento, as credenciais protegidas no Neon passam a substituir o acesso temporário das variáveis e as outras sessões são encerradas. Em caso de perda do acesso, remova somente a linha `master` da tabela `admin_credentials` na Neon para voltar ao acesso inicial das variáveis.

Durante a apresentação, use `PAYMENTS_DEMO_MODE=true`. Para produção, altere para `false`, use `PAYMENT_PROVIDER=infinitepay`, informe a `INFINITEPAY_HANDLE` e faça um novo deploy.

### Biblioteca de imagens

Para Sávia trocar as fotos pelo painel:

1. abra **Vercel > projeto savia-araujo > Storage**;
2. escolha **Create Database > Blob** e crie o armazenamento com acesso **Public**;
3. conecte-o aos ambientes Production, Preview e Development; a Vercel criará `BLOB_READ_WRITE_TOKEN` automaticamente;
4. faça um novo deploy;
5. entre em **Painel > Imagens do site**, escolha uma área, envie a foto, confira as abas Computador e Celular, arraste o ponto focal, ajuste o zoom e publique.

Somente a sessão master recebe autorização temporária de upload. Os arquivos aceitos são JPG, PNG, WebP e AVIF, até 50 MB, preservados sem recompressão. Cada publicação preserva uma versão anterior para restauração. Os arquivos do Blob são públicos porque aparecem no site; dados pessoais e comprovantes continuam fora dessa biblioteca.

### Serviços, descrições e valores

Em **Painel > Serviços e valores**, a proprietária pode editar cada experiência ou ocultá-la temporariamente. A publicação atualiza a página inicial e o formulário de agendamento. Na criação da reserva, o servidor consulta novamente o catálogo salvo no Neon e calcula o sinal de 50% ou o pagamento integral; nenhum valor enviado pelo navegador é aceito. Reservas já criadas preservam o preço contratado no momento do agendamento.

### Ativar os e-mails do Resend

É possível validar o desenho dos e-mails antes de comprar ou conectar um domínio. Cadastre apenas `RESEND_API_KEY`, deixe `NOTIFICATION_FROM_EMAIL` vazio (o sistema usará `Sávia Araújo <onboarding@resend.dev>`) e abra **Painel > Acesso e segurança > Resend · ambiente de teste**. Informe o mesmo e-mail usado na conta Resend e envie os quatro modelos. Esse modo serve somente para testes; o envio para clientes reais exige um domínio verificado.

1. crie uma conta no Resend e adicione um domínio ou subdomínio de envio, preferencialmente `mail.seudominio.com.br`;
2. publique no DNS os registros SPF e DKIM mostrados pelo Resend e aguarde o status **Verified**;
3. crie uma API key de envio e salve-a na Vercel como `RESEND_API_KEY`;
4. defina `NOTIFICATION_FROM_EMAIL`, por exemplo `Sávia Araújo <agenda@mail.seudominio.com.br>`;
5. defina `NOTIFICATION_OWNER_EMAIL` com o e-mail que receberá os avisos administrativos;
6. faça um novo deploy e realize um agendamento de teste.

O formulário público exige um e-mail válido. Cada canal de entrega é controlado separadamente e as chamadas ao Resend usam chaves de idempotência, evitando mensagens repetidas quando a InfinitePay reenviar um webhook.

Quando o pagamento é aprovado:

- cliente e proprietária recebem data, horário, serviço, código da reserva, total e valor pago;
- no pagamento integral, o e-mail informa que não há saldo pendente;
- no sinal de 50%, o e-mail destaca o valor restante e informa que ele será cobrado posteriormente;
- quando o saldo for registrado no painel, um novo e-mail confirma o recebimento e informa se a reserva está quitada.

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

### Conectar o domínio definitivo

1. registre o domínio escolhido em um provedor de sua preferência;
2. abra **Vercel > Project > Settings > Domains**, adicione o domínio principal e também a versão com `www`;
3. copie para o DNS os registros indicados pela Vercel e escolha qual versão será redirecionada para a outra;
4. após a validação, altere `NEXT_PUBLIC_SITE_URL` para a URL definitiva com `https://`;
5. confira no Resend se o subdomínio de e-mail continua verificado e faça um novo deploy de produção.

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
