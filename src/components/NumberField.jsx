import { useEffect, useState } from 'react';

/**
 * A number input that keeps whatever you are typing (including an empty box)
 * until you leave the field or press Enter, then commits a parsed number.
 * Invalid or empty drafts snap back to the last committed value.
 */
export default function NumberField({ value, onCommit, clamp = null, ...rest }) {
  const [draft, setDraft] = useState(value === null || value === undefined ? '' : String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value === null || value === undefined ? '' : String(value));
  }, [value, focused]);

  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(parsed)) {
      setDraft(value === null || value === undefined ? '' : String(value));
      return;
    }
    const next = clamp ? clamp(parsed) : parsed;
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      {...rest}
      value={draft}
      onChange={event => setDraft(event.target.value)}
      onFocus={(event) => { setFocused(true); rest.onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); commit(); rest.onBlur?.(event); }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        rest.onKeyDown?.(event);
      }}
    />
  );
}
