interface ShowAllToggleProps {
  checked: boolean;
  onChange: (nextValue: boolean) => void;
}

export function ShowAllToggle({ checked, onChange }: ShowAllToggleProps) {
  return (
    <div className="toggle-row">
      <span className="toggle-copy">
        <strong>Show all</strong>
        <small>Reveal titles without a match on your selected services.</small>
      </span>
      <button
        type="button"
        className={`toggle-button ${checked ? "active" : ""}`}
        aria-label="Show all titles"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}
