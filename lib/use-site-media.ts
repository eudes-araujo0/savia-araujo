'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SITE_MEDIA_SLOTS, defaultMediaValue, getMediaSlot, type SiteMediaValue } from './site-media';

const defaults = new Map(SITE_MEDIA_SLOTS.map((slot) => [slot.id, defaultMediaValue(slot)]));

export function useSiteMedia() {
  const [overrides, setOverrides] = useState<Map<string, SiteMediaValue>>(new Map());
  useEffect(() => {
    let active = true;
    fetch('/api/site-media', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() as Promise<{ media?: SiteMediaValue[] }> : { media: [] })
      .then((result) => { if (active) setOverrides(new Map((result.media || []).map((item) => [item.slotId, item]))); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  const media = useMemo(() => new Map([...defaults, ...overrides]), [overrides]);
  return useCallback((slotId: string) => media.get(slotId) || defaultMediaValue(getMediaSlot(slotId) || SITE_MEDIA_SLOTS[0]), [media]);
}
