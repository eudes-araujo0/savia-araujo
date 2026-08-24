import { pbkdf2Sync, randomBytes } from 'node:crypto';

let password = '';
for await (const chunk of process.stdin) password += chunk;
password = password.replace(/[\r\n]+$/, '');
if (password.length < 12) {
  process.stderr.write('A senha deve ter pelo menos 12 caracteres.\n');
  process.exit(1);
}

const rounds = 310000;
const salt = randomBytes(16);
const digest = pbkdf2Sync(password, salt, rounds, 32, 'sha256');
process.stdout.write(`pbkdf2-sha256$${rounds}$${salt.toString('hex')}$${digest.toString('hex')}\n`);
