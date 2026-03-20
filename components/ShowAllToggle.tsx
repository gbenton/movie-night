interface ShowAllToggleProps {
  checked: boolean;
  onChange: (nextValue: boolean) => void;
}

export function ShowAllToggle({ checked, onChange }: ShowAllToggleProps) {
  return (
    <label className="toggle-row">
      <span>
        <strong>Show all</strong>
        <small>Reveal titles without a match on your selected services.</small>
      </span>
      <button
        type="button"
        className={`toggle-button ${checked ? "active" : ""}`}
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-thumb" />
      </button>
    </label>
  );
}
