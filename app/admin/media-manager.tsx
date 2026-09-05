'use client';

import { upload } from '@vercel/blob/client';
import Image from 'next/image';
import { useEffect, useMemo, useState, type PointerEvent } from 'react';
import { Check, History, ImagePlus, LoaderCircle, Monitor, Move, RotateCcw, Smartphone, X } from 'lucide-react';
import type { SiteMediaLibraryItem } from '../../lib/site-media';

type Editor = {
  item: SiteMediaLibraryItem;
  file: File | null;
  previewUrl: string;
  mode: 'desktop' | 'mobile';
  alt: string;
  desktopX: number;
  desktopY: number;
  mobileX: number;
  mobileY: number;
  desktopZoom: number;
  mobileZoom: number;
};

export default function MediaManager() {
  const [items, setItems] = useState<SiteMediaLibraryItem[]>([]);
  const [section, setSection] = useState('Todas');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/media', { cache: 'no-store' })
      .then(async (response) => ({ ok: response.ok, result: await response.json() as { items?: SiteMediaLibraryItem[]; error?: string } }))
      .then(({ ok, result }) => {
        if (!active) return;
        if (!ok) throw new Error(result.error || 'Não foi possível carregar a biblioteca.');
        setItems(result.items || []);
      })
      .catch((error) => { if (active) setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'Não foi possível carregar a biblioteca.' }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const sections = useMemo(() => ['Todas', ...Array.from(new Set(items.map((item) => item.section)))], [items]);
  const visible = useMemo(() => section === 'Todas' ? items : items.filter((item) => item.section === section), [items, section]);

  function openEditor(item: SiteMediaLibraryItem) {
    setFeedback(null);
    setEditor({
      item, file: null, previewUrl: item.current.url, mode: 'desktop', alt: item.current.alt,
      desktopX: item.current.desktopX, desktopY: item.current.desktopY,
      mobileX: item.current.mobileX, mobileY: item.current.mobileY,
      desktopZoom: item.current.desktopZoom, mobileZoom: item.current.mobileZoom,
    });
  }

  function chooseFile(file: File | null) {
    if (!editor || !file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
      setFeedback({ kind: 'error', text: 'Use uma imagem JPG, PNG, WebP ou AVIF.' }); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setFeedback({ kind: 'error', text: 'A imagem deve ter no máximo 20 MB.' }); return;
    }
    if (editor.file) URL.revokeObjectURL(editor.previewUrl);
    setEditor({ ...editor, file, previewUrl: URL.createObjectURL(file) });
  }

  function setPosition(event: PointerEvent<HTMLDivElement>) {
    if (!editor) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp(Math.round(((event.clientX - rect.left) / rect.width) * 100), 0, 100);
    const y = clamp(Math.round(((event.clientY - rect.top) / rect.height) * 100), 0, 100);
    setEditor(editor.mode === 'desktop' ? { ...editor, desktopX: x, desktopY: y } : { ...editor, mobileX: x, mobileY: y });
  }

  async function save(urlOverride?: string, pathnameOverride?: string | null, resetToDefault = false) {
    if (!editor || saving) return;
    setSaving(true); setProgress(0); setFeedback(null);
    try {
      let url = urlOverride || editor.item.current.url;
      let pathname = pathnameOverride === undefined ? editor.item.current.pathname : pathnameOverride;
      if (editor.file && !urlOverride) {
        const filename = safeFilename(editor.file.name);
        const blob = await upload(`savia/site-media/${editor.item.id}/${filename}`, editor.file, {
          access: 'public',
          handleUploadUrl: '/api/admin/media/upload',
          clientPayload: JSON.stringify({ slotId: editor.item.id }),
          multipart: editor.file.size > 4 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        });
        url = blob.url;
        pathname = blob.pathname;
      }
      const response = await fetch('/api/admin/media', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'publish', slotId: editor.item.id, url, pathname, alt: resetToDefault ? editor.item.defaultAlt : editor.alt,
          desktopX: resetToDefault ? editor.item.desktopX : editor.desktopX,
          desktopY: resetToDefault ? editor.item.desktopY : editor.desktopY,
          mobileX: resetToDefault ? editor.item.mobileX : editor.mobileX,
          mobileY: resetToDefault ? editor.item.mobileY : editor.mobileY,
          desktopZoom: resetToDefault ? editor.item.desktopZoom : editor.desktopZoom,
          mobileZoom: resetToDefault ? editor.item.mobileZoom : editor.mobileZoom,
        }),
      });
      const result = await response.json() as { items?: SiteMediaLibraryItem[]; error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível publicar a imagem.');
      setItems(result.items || []);
      closeEditor();
      setFeedback({ kind: 'success', text: 'Imagem e enquadramentos publicados no site.' });
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'Não foi possível publicar a imagem.' });
    } finally {
      setSaving(false); setProgress(0);
    }
  }

  async function restore(versionId: string) {
    if (!editor || saving || !window.confirm('Restaurar esta versão com o enquadramento salvo?')) return;
    setSaving(true); setFeedback(null);
    try {
      const response = await fetch('/api/admin/media', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'restore', slotId: editor.item.id, versionId }),
      });
      const result = await response.json() as { items?: SiteMediaLibraryItem[]; error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível restaurar a versão.');
      setItems(result.items || []); closeEditor();
      setFeedback({ kind: 'success', text: 'Versão anterior restaurada.' });
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'Não foi possível restaurar.' });
    } finally { setSaving(false); }
  }

  function closeEditor() {
    if (editor?.file) URL.revokeObjectURL(editor.previewUrl);
    setEditor(null);
  }

  const currentX = editor?.mode === 'desktop' ? editor.desktopX : editor?.mobileX;
  const currentY = editor?.mode === 'desktop' ? editor.desktopY : editor?.mobileY;
  const currentZoom = editor?.mode === 'desktop' ? editor.desktopZoom : editor?.mobileZoom;

  return <>
    <section className="media-manager-intro">
      <div><p className="eyebrow">Direção visual</p><h2>Biblioteca de<br /><em>imagens.</em></h2></div>
      <p>Troque qualquer foto sem mexer no código. Ajuste o ponto focal e o zoom separadamente para computador e celular antes de publicar.</p>
    </section>
    {feedback && <p className={`admin-feedback ${feedback.kind}`}>{feedback.text}</p>}
    <div className="media-section-tabs" role="tablist" aria-label="Filtrar áreas do site">
      {sections.map((value) => <button key={value} className={section === value ? 'active' : ''} onClick={() => setSection(value)}>{value}</button>)}
    </div>
    {loading ? <div className="media-loading"><LoaderCircle className="spinning" /> Carregando imagens…</div> :
      <section className="media-library-grid">
        {visible.map((item) => <article className="media-library-card" key={item.id}>
          <button className="media-card-preview" onClick={() => openEditor(item)} aria-label={`Editar ${item.label}`}>
            <Image src={item.current.url} alt={item.current.alt} fill sizes="(max-width: 760px) 100vw, 30vw" style={{ objectPosition: `${item.current.desktopX}% ${item.current.desktopY}%`, transform: `scale(${item.current.desktopZoom})` }} />
            <span><Move size={14} /> Ajustar foto</span>
          </button>
          <div className="media-card-copy"><small>{item.section} · {item.aspect}</small><h3>{item.label}</h3><p>{item.description}</p><button onClick={() => openEditor(item)}>Trocar ou enquadrar <ImagePlus size={14} /></button></div>
        </article>)}
      </section>}

    {editor && <div className="admin-modal-backdrop media-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) closeEditor(); }}>
      <section className="media-editor" role="dialog" aria-modal="true" aria-labelledby="media-editor-title">
        <header><div><small>{editor.item.section}</small><h2 id="media-editor-title">{editor.item.label}</h2></div><button aria-label="Fechar" onClick={closeEditor} disabled={saving}><X /></button></header>
        <div className="media-editor-body">
          <div className="media-editor-stage-column">
            <div className="media-device-tabs">
              <button className={editor.mode === 'desktop' ? 'active' : ''} onClick={() => setEditor({ ...editor, mode: 'desktop' })}><Monitor size={15} /> Computador</button>
              <button className={editor.mode === 'mobile' ? 'active' : ''} onClick={() => setEditor({ ...editor, mode: 'mobile' })}><Smartphone size={15} /> Celular</button>
            </div>
            <div className={`media-editor-stage ${editor.mode}`} onPointerDown={setPosition} onPointerMove={(event) => { if (event.buttons === 1) setPosition(event); }}>
              <Image src={editor.previewUrl} alt="Prévia do enquadramento" fill unoptimized={Boolean(editor.file)} sizes="70vw" draggable={false} style={{ objectPosition: `${currentX}% ${currentY}%`, transform: `scale(${currentZoom})` }} />
              <i style={{ left: `${currentX}%`, top: `${currentY}%` }}><Move size={13} /></i>
              <span>Arraste o ponto até o rosto ou detalhe principal</span>
            </div>
            <p className="media-stage-note">Prévia de enquadramento. O formato exato acompanha o card de cada tela.</p>
          </div>
          <div className="media-editor-controls">
            <label className="media-upload-button"><ImagePlus size={16} /><span>{editor.file ? editor.file.name : 'Escolher nova foto'}<small>JPG, PNG, WebP ou AVIF · até 20 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => chooseFile(event.target.files?.[0] || null)} /></label>
            <label><span>Descrição acessível</span><input value={editor.alt} maxLength={180} onChange={(event) => setEditor({ ...editor, alt: event.target.value })} /></label>
            <div className="media-control-heading"><strong>Enquadramento · {editor.mode === 'desktop' ? 'computador' : 'celular'}</strong><small>{Math.round(currentX || 0)}% × {Math.round(currentY || 0)}%</small></div>
            <label><span>Posição horizontal</span><input type="range" min="0" max="100" value={currentX} onChange={(event) => setEditor(editor.mode === 'desktop' ? { ...editor, desktopX: Number(event.target.value) } : { ...editor, mobileX: Number(event.target.value) })} /></label>
            <label><span>Altura / posição vertical</span><input type="range" min="0" max="100" value={currentY} onChange={(event) => setEditor(editor.mode === 'desktop' ? { ...editor, desktopY: Number(event.target.value) } : { ...editor, mobileY: Number(event.target.value) })} /></label>
            <label><span>Zoom · {Number(currentZoom).toFixed(2)}×</span><input type="range" min="1" max="2" step="0.01" value={currentZoom} onChange={(event) => setEditor(editor.mode === 'desktop' ? { ...editor, desktopZoom: Number(event.target.value) } : { ...editor, mobileZoom: Number(event.target.value) })} /></label>
            <div className="media-editor-tips"><Check size={14} /><p>O ajuste do computador não altera o celular. Confira as duas abas antes de publicar.</p></div>
            {editor.item.versions.length > 0 && <div className="media-history"><strong><History size={14} /> Histórico</strong><div>{editor.item.versions.slice(0, 5).map((version) => <button key={version.versionId} onClick={() => void restore(version.versionId || '')} disabled={saving}><Image src={version.url} alt="Versão anterior" width={42} height={42} /><span>{version.updatedAt ? new Date(version.updatedAt).toLocaleDateString('pt-BR') : 'Versão salva'}</span><RotateCcw size={13} /></button>)}</div></div>}
          </div>
        </div>
        <footer><button className="media-reset" onClick={() => void save(editor.item.defaultUrl, null, true)} disabled={saving}><RotateCcw size={14} /> Usar foto original</button><button className="admin-create" onClick={() => void save()} disabled={saving || editor.alt.trim().length < 3}>{saving ? <><LoaderCircle className="spinning" size={15} /> {progress ? `Enviando ${progress}%` : 'Publicando…'}</> : 'Publicar no site'}</button></footer>
      </section>
    </div>}
  </>;
}

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function safeFilename(value: string) {
  const extension = value.toLowerCase().match(/\.(jpe?g|png|webp|avif)$/)?.[0] || '.jpg';
  const name = value.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'imagem';
  return `${name}${extension}`;
}
