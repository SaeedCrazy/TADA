'use client';
import { localizeDigits, type Locale } from '@tada/shared';
import type { Branch } from '@/lib/types';
import { dict } from '@/lib/i18n';
import { Art, Sheet } from '../ui';

export function branchStatusText(b: Branch, locale: Locale) {
  const t = dict(locale);
  if (!b.acceptsOrders) return t.branch.paused;
  return b.open.open
    ? t.branch.open(localizeDigits(b.open.closesAt ?? '', locale))
    : t.branch.closedUntil(localizeDigits(b.open.opensAt ?? '', locale), Boolean(b.open.tomorrow));
}

export function BranchPicker({ open, onClose, branches, locale, selected, onPick }: {
  open: boolean; onClose: () => void; branches: Branch[]; locale: Locale; selected: string | null; onPick: (id: string) => void;
}) {
  const t = dict(locale);
  return (
    <Sheet open={open} onClose={onClose} label={t.branch.pick}>
      <div className="stack">
        <h2 style={{ fontSize: 22 }}>{t.branch.pick}</h2>
        <p className="muted tiny">{t.branch.chooseHint}</p>
        <div className="stack" role="radiogroup" aria-label={t.branch.pick}>
          {branches.map((b) => {
            const live = b.open.open && b.acceptsOrders;
            return (
              <button
                type="button" key={b.id} role="radio" aria-checked={selected === b.id} onClick={() => onPick(b.id)}
                className="addr" style={{ textAlign: 'start', background: selected === b.id ? '#FAF5FC' : '#fff', borderColor: selected === b.id ? 'var(--tada)' : undefined }}
              >
                <Art name={b.slug === 'jomhouri' ? 'icedCup' : b.slug === 'daneshgah' ? 'glass2' : 'coffeeCup'} style={{ width: 26, height: 36, color: 'var(--tada)' }} />
                <span className="stack" style={{ gap: 2 }}>
                  <b style={{ color: 'var(--plum)' }}>{locale === 'fa' ? b.nameFa : b.nameEn}</b>
                  <small className="muted">{locale === 'fa' ? b.addressFa : b.addressEn}</small>
                  <span className={`badge ${live ? 'ok' : 'warn'}`} style={{ width: 'fit-content' }}>{branchStatusText(b, locale)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
