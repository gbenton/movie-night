import type { MovieList } from "../lib/types";

interface ListPickerProps {
  lists: MovieList[];
  activeListId?: string;
  onSelect: (listId: string) => void;
  onDelete: (listId: string) => void;
}

export function ListPicker({ lists, activeListId, onSelect, onDelete }: ListPickerProps) {
  if (lists.length === 0) {
    return null;
  }

  return (
    <section className="panel">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Step 3</p>
          <h2>Your lists</h2>
        </div>
      </div>
      <div className="list-picker">
        {lists.map((list) => {
          const active = list.id === activeListId;
          return (
            <div key={list.id} className={`list-pill ${active ? "active" : ""}`}>
              <button type="button" className="list-select" onClick={() => onSelect(list.id)}>
                <span>{list.name}</span>
                <small>{list.movies.length} movies</small>
              </button>
              <button type="button" className="list-delete" aria-label={`Delete ${list.name}`} onClick={() => onDelete(list.id)}>
                x
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
