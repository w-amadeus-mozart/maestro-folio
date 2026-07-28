export function PageNumberingControls({ value, onChange }) {
  const update = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="numbering-settings">
      <div className="book-option tab-option">
        <div><strong>Display page numbers</strong><small>Cover and index pages are excluded automatically.</small></div>
        <button className={`switch ${value.enabled ? "on" : ""}`} role="switch" aria-label="Display page numbers"
          aria-checked={value.enabled}
          onClick={() => update({ enabled: !value.enabled })}><span /></button>
      </div>
      {value.enabled && <div className="numbering-grid">
        <label className="field"><span>Start at</span>
          <input aria-label="Start at" type="number" min="0" max="9999" value={value.startAt}
            onChange={(event) => update({ startAt: event.target.value })} />
        </label>
        <label className="field"><span>Number every</span>
          <select aria-label="Number every" value={value.every} onChange={(event) => update({ every: event.target.value })}>
            <option value="1">Every page</option>
            <option value="2">Every 2nd page</option>
            <option value="3">Every 3rd page</option>
            <option value="4">Every 4th page</option>
          </select>
        </label>
        <label className="field"><span>Position</span>
          <select aria-label="Position" value={value.position} onChange={(event) => update({ position: event.target.value })}>
            <option value="bottom">Bottom</option>
            <option value="top">Top</option>
          </select>
        </label>
        <label className="field"><span>Alignment</span>
          <select aria-label="Alignment" value={value.alignment} onChange={(event) => update({ alignment: event.target.value })}>
            <option value="outer">Outer corners</option>
            <option value="inner">Inner corners</option>
            <option value="center">Centered</option>
          </select>
        </label>
      </div>}
    </div>
  );
}
