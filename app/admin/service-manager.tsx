'use client';

import { useMemo, useState } from 'react';
import { BadgeDollarSign, Check, Clock3, Pencil, Power, X } from 'lucide-react';
import type { BookableService } from '../../lib/service-catalog';

type Props = { services: BookableService[]; onChanged: (services: BookableService[]) => void };

export default function ServiceManager({ services, onChanged }: Props) {
  const [editing, setEditing] = useState<BookableService | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const groups = useMemo(() => ['makeup', 'noivas', 'boss'].map((group) => ({
    id: group,
    label: services.find((item) => item.group === group)?.groupLabel || group,
    services: services.filter((item) => item.group === group),
  })), [services]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true); setFeedback(null);
    const form = new FormData(event.currentTarget);
    try {
      const price = Number(String(form.get('price') || '').replace(',', '.'));
      const response = await fetch('/api/admin/services', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code: editing.code,
          name: String(form.get('name') || ''),
          tagline: String(form.get('tagline') || ''),
          description: String(form.get('description') || ''),
          features: String(form.get('features') || '').split('\n').map((item) => item.trim()).filter(Boolean),
          priceCents: Math.round(price * 100),
          durationMinutes: Number(form.get('durationMinutes')),
          active: form.get('active') === 'on',
        }),
      });
      const result = await response.json() as { services?: BookableService[]; error?: string };
      if (!response.ok || !result.services) throw new Error(result.error || 'Não foi possível publicar as alterações.');
      onChanged(result.services);
      setEditing(null);
      setFeedback({ kind: 'success', text: 'Experiência atualizada no site, no agendamento e no pagamento.' });
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'Não foi possível atualizar.' });
    } finally { setSaving(false); }
  }

  return <>
    <section className="service-manager-intro">
      <div><p className="eyebrow">Catálogo conectado</p><h2>Experiências &<br /><em>valores.</em></h2></div>
      <p>Edite uma única vez. Nome, descrição, itens inclusos, duração e investimento serão usados na vitrine, no agendamento e no cálculo seguro do checkout.</p>
    </section>
    {feedback && <p className={`admin-feedback ${feedback.kind}`}>{feedback.text}</p>}
    <div className="service-manager-groups">
      {groups.map((group) => <section className="service-manager-group" key={group.id}>
        <header><div><small>Categoria</small><h3>{group.label}</h3></div><span>{group.services.filter((item) => item.active).length} publicados</span></header>
        <div className="service-manager-grid">
          {group.services.map((item) => <article className={`service-admin-card ${item.active ? '' : 'inactive'}`} key={item.code}>
            <div className="service-admin-card-head"><span>{item.code}</span><em><i />{item.active ? 'Publicado' : 'Oculto'}</em></div>
            <h4>{item.name}</h4><p>{item.description}</p>
            <div className="service-admin-data"><span><BadgeDollarSign size={14} /><small>Investimento</small><strong>{money(item.priceCents)}</strong></span><span><Clock3 size={14} /><small>Duração</small><strong>{duration(item.durationMinutes)}</strong></span></div>
            <button onClick={() => { setFeedback(null); setEditing(item); }}><Pencil size={13} /> Editar experiência</button>
          </article>)}
        </div>
      </section>)}
    </div>

    {editing && <div className="admin-modal-backdrop service-editor-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditing(null); }}>
      <section className="service-editor" role="dialog" aria-modal="true" aria-labelledby="service-editor-title">
        <header><div><small>{editing.groupLabel} · {editing.code}</small><h2 id="service-editor-title">Editar experiência</h2></div><button aria-label="Fechar" onClick={() => setEditing(null)} disabled={saving}><X size={18} /></button></header>
        <form onSubmit={save}>
          <label><span>Nome exibido</span><input name="name" defaultValue={editing.name} minLength={2} maxLength={80} required /></label>
          <label><span>Chamada curta</span><input name="tagline" defaultValue={editing.tagline} minLength={2} maxLength={100} required /></label>
          <label><span>Descrição do serviço</span><textarea name="description" defaultValue={editing.description} minLength={5} maxLength={500} rows={4} required /></label>
          <label><span>O que está incluso <small>um item por linha</small></span><textarea name="features" defaultValue={editing.features.join('\n')} maxLength={1000} rows={5} placeholder="Ex.: Teste de maquiagem" /></label>
          <div className="service-editor-row"><label><span>Valor (R$)</span><input name="price" inputMode="decimal" defaultValue={(editing.priceCents / 100).toFixed(2).replace('.', ',')} required /></label><label><span>Duração (minutos)</span><input name="durationMinutes" type="number" min="30" max="1440" step="15" defaultValue={editing.durationMinutes} required /></label></div>
          <label className="service-active-toggle"><input name="active" type="checkbox" defaultChecked={editing.active} /><span><Power size={14} /><strong>Disponível no site</strong><small>Ao desativar, esta opção desaparece da vitrine e do agendamento.</small></span></label>
          <div className="service-editor-assurance"><Check size={14} /><p>O servidor consulta este valor novamente antes de gerar o pagamento. O preço não pode ser alterado pelo navegador da cliente.</p></div>
          <footer><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Publicando…' : 'Publicar alterações'}</button></footer>
        </form>
      </section>
    </div>}
  </>;
}

function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100); }
function duration(minutes: number) { const hours = Math.floor(minutes / 60); const rest = minutes % 60; return hours ? `${hours}h${rest ? ` ${rest}min` : ''}` : `${minutes}min`; }
