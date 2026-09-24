export type ServiceGroup = 'makeup' | 'noivas' | 'boss';

export type BookableService = {
  code: string;
  group: ServiceGroup;
  groupLabel: string;
  name: string;
  tagline: string;
  description: string;
  features: string[];
  priceCents: number;
  durationMinutes: number;
  active: boolean;
  sortOrder: number;
  updatedAt: number | null;
};

export const BOOKING_TIMES = ['08:00', '09:30', '11:00', '13:30', '15:00', '16:30', '18:00', '19:30'];

export const BOOKABLE_SERVICES: BookableService[] = [
  service('make-express', 'makeup', 'Maquiagem', 'Make Express', 'Leve & essencial', 'Maquiagem natural para uma produção rápida e elegante. Não inclui cílios.', [], 9000, 60, 1),
  service('make-social', 'makeup', 'Maquiagem', 'Make Social', 'Para ser lembrada', 'Produção elaborada para festas, fotos e eventos, com acabamento pensado para durar.', [], 12000, 90, 2),
  service('make-hair', 'makeup', 'Maquiagem', 'Make & Hair', 'Produção completa', 'Maquiagem e babyliss em uma experiência completa, do primeiro pincel ao acabamento final.', [], 18000, 150, 3),
  service('noiva-rubi', 'noivas', 'Dia da Noiva', 'Noiva Rubi', 'O essencial do grande dia', 'O essencial do grande dia, com preparação cuidadosa e testes prévios.', ['Teste de maquiagem', 'Teste de penteado', 'Skin care + massagem facial', 'Assessoria de véu, acessórios e vestido'], 50000, 600, 4),
  service('noiva-ouro', 'noivas', 'Dia da Noiva', 'Noiva Ouro', 'Cuidado em cada detalhe', 'Uma experiência mais completa, com cuidado, celebração e atenção aos detalhes.', ['Testes de maquiagem e penteado', 'Assessoria completa', 'Massagem facial e corporal', 'Mimo, robe e momento do brinde'], 70000, 600, 5),
  service('noiva-master', 'noivas', 'Dia da Noiva', 'Noiva Master', 'Experiência completa', 'O ritual completo para viver o dia com tranquilidade, presença e exclusividade.', ['Maquiagem e penteado + testes', 'Coffee break e massagem relaxante', 'Mimo e robe personalizado', 'Kit retoque e taças para o brinde'], 90000, 600, 6),
  service('boss-10', 'boss', 'Pacote Boss', '10 fotos', 'Até 2 looks', 'Maquiagem + babyliss, direção personalizada e ensaio em estúdio.', ['10 fotos tratadas', 'Até 2 looks', 'Direção de poses'], 30000, 180, 7),
  service('boss-15', 'boss', 'Pacote Boss', '15 fotos', 'Até 2 looks', 'Maquiagem + babyliss, direção personalizada e ensaio em estúdio.', ['15 fotos tratadas', 'Até 2 looks', 'Direção de poses'], 40000, 180, 8),
  service('boss-20', 'boss', 'Pacote Boss', '20 fotos', 'Até 3 looks', 'Maquiagem + babyliss, direção personalizada e ensaio em estúdio.', ['20 fotos tratadas', 'Até 3 looks', 'Direção de poses'], 50000, 180, 9),
];

export const BOOKABLE_SERVICE_CODES = new Set(BOOKABLE_SERVICES.map((item) => item.code));

export function isBridalService(code: string) {
  return code.startsWith('noiva-');
}

function service(
  code: string,
  group: ServiceGroup,
  groupLabel: string,
  name: string,
  tagline: string,
  description: string,
  features: string[],
  priceCents: number,
  durationMinutes: number,
  sortOrder: number,
): BookableService {
  return { code, group, groupLabel, name, tagline, description, features, priceCents, durationMinutes, active: true, sortOrder, updatedAt: null };
}
