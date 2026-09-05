export type ServiceGroup = 'makeup' | 'noivas' | 'boss';

export type BookableService = {
  code: string;
  group: ServiceGroup;
  groupLabel: string;
  name: string;
  note: string;
  priceCents: number;
  durationMinutes: number;
};

export const BOOKING_TIMES = ['08:00', '09:30', '11:00', '13:30', '15:00', '16:30', '18:00', '19:30'];

export const BOOKABLE_SERVICES: BookableService[] = [
  { code: 'make-express', group: 'makeup', groupLabel: 'Maquiagem', name: 'Make Express', note: 'Maquiagem natural, sem cílios', priceCents: 9000, durationMinutes: 60 },
  { code: 'make-social', group: 'makeup', groupLabel: 'Maquiagem', name: 'Make Social', note: 'Festas, fotos e eventos', priceCents: 12000, durationMinutes: 90 },
  { code: 'make-hair', group: 'makeup', groupLabel: 'Maquiagem', name: 'Make & Hair', note: 'Maquiagem + babyliss', priceCents: 18000, durationMinutes: 150 },
  { code: 'noiva-rubi', group: 'noivas', groupLabel: 'Dia da Noiva', name: 'Noiva Rubi', note: 'Testes, skin care e assessoria', priceCents: 50000, durationMinutes: 600 },
  { code: 'noiva-ouro', group: 'noivas', groupLabel: 'Dia da Noiva', name: 'Noiva Ouro', note: 'Experiência ampliada e momento do brinde', priceCents: 70000, durationMinutes: 600 },
  { code: 'noiva-master', group: 'noivas', groupLabel: 'Dia da Noiva', name: 'Noiva Master', note: 'Experiência completa para o grande dia', priceCents: 90000, durationMinutes: 600 },
  { code: 'boss-10', group: 'boss', groupLabel: 'Pacote Boss', name: 'Boss · 10 fotos', note: 'Maquiagem, babyliss e até 2 looks', priceCents: 30000, durationMinutes: 180 },
  { code: 'boss-15', group: 'boss', groupLabel: 'Pacote Boss', name: 'Boss · 15 fotos', note: 'Maquiagem, babyliss e até 2 looks', priceCents: 40000, durationMinutes: 180 },
  { code: 'boss-20', group: 'boss', groupLabel: 'Pacote Boss', name: 'Boss · 20 fotos', note: 'Maquiagem, babyliss e até 3 looks', priceCents: 50000, durationMinutes: 180 },
];

export const SERVICE_CATALOG: Record<string, { label: string; priceCents: number; durationMinutes: number }> = Object.fromEntries(
  BOOKABLE_SERVICES.map((service) => [service.code, { label: service.name, priceCents: service.priceCents, durationMinutes: service.durationMinutes }]),
);

export function isBridalService(code: string) {
  return code.startsWith('noiva-');
}
