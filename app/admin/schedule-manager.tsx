'use client';

import { FormEvent, useState } from 'react';
import { CalendarCheck2, Check, Clock3 } from 'lucide-react';
import type { BusinessSchedule } from '../../db/schema';

const days = [
  { value: 0, short: 'Dom', label: 'Domingo' },
  { value: 1, short: 'Seg', label: 'Segunda-feira' },
  { value: 2, short: 'Ter', label: 'Terça-feira' },
  { value: 3, short: 'Qua', label: 'Quarta-feira' },
  { value: 4, short: 'Qui', label: 'Quinta-feira' },
  { value: 5, short: 'Sex', label: 'Sexta-feira' },
  { value: 6, short: 'Sáb', label: 'Sábado' },
];

export default function ScheduleManager({ schedule, onSaved }: { schedule: BusinessSchedule; onSaved: (schedule: BusinessSchedule) => void }) {
  const [openDays, setOpenDays] = useState(schedule.openDays);
  const [startTime, setStartTime] = useState(schedule.startTime);
  const [endTime, setEndTime] = useState(schedule.endTime);
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(schedule.slotIntervalMinutes);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  function toggleDay(day: number) {
    setOpenDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/admin/schedule', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ openDays, startTime, endTime, slotIntervalMinutes }),
      });
      const result = await response.json() as { schedule?: BusinessSchedule; error?: string };
      if (!response.ok || !result.schedule) throw new Error(result.error || 'Não foi possível salvar os horários.');
      onSaved(result.schedule);
      setFeedback({ kind: 'success', text: 'Agenda de atendimento atualizada.' });
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'Não foi possível salvar os horários.' });
    } finally {
      setBusy(false);
    }
  }

  return <div className="schedule-settings-grid">
    <form className="schedule-settings-card" onSubmit={submit}>
      <div className="schedule-settings-title"><span><CalendarCheck2 size={20} /></span><div><p className="eyebrow">Disponibilidade pública</p><h2>Dias e horários</h2></div></div>
      <p className="schedule-settings-copy">Essas regras controlam o calendário que a cliente vê. Reservas e bloqueios existentes continuam sendo respeitados automaticamente.</p>
      <fieldset className="schedule-days"><legend>Dias de funcionamento</legend>{days.map((day) => <button key={day.value} type="button" className={openDays.includes(day.value) ? 'active' : ''} aria-pressed={openDays.includes(day.value)} title={day.label} onClick={() => toggleDay(day.value)}>{openDays.includes(day.value) && <Check size={11} />}{day.short}</button>)}</fieldset>
      <div className="schedule-time-fields">
        <label>Início do expediente<input type="time" value={startTime} step={900} onChange={(event) => setStartTime(event.target.value)} required /></label>
        <label>Fim do expediente<input type="time" value={endTime} step={900} onChange={(event) => setEndTime(event.target.value)} required /></label>
      </div>
      <label className="schedule-interval">Intervalo entre opções de início<select value={slotIntervalMinutes} onChange={(event) => setSlotIntervalMinutes(Number(event.target.value))}><option value={15}>15 minutos</option><option value={30}>30 minutos</option><option value={45}>45 minutos</option><option value={60}>1 hora</option><option value={90}>1h30</option><option value={120}>2 horas</option><option value={150}>2h30</option><option value={180}>3 horas</option></select><small>A duração de cada serviço também é considerada, evitando sobreposição entre clientes.</small></label>
      {feedback && <p className={`schedule-feedback ${feedback.kind}`}>{feedback.text}</p>}
      <button className="schedule-save" disabled={busy || !openDays.length}>{busy ? 'Salvando...' : 'Salvar disponibilidade'}</button>
    </form>
    <aside className="schedule-rule-card"><Clock3 size={22} /><p className="eyebrow">Como funciona</p><h3>A agenda se ajusta sozinha.</h3><ul><li>Datas anteriores ficam bloqueadas.</li><li>No dia atual, horários que já passaram ficam indisponíveis.</li><li>Dias fechados não podem ser selecionados.</li><li>A duração do serviço, reservas e bloqueios manuais são cruzados antes de liberar um horário.</li></ul></aside>
  </div>;
}
