import type { MovieList } from "../lib/types.ts";

interface ListPickerProps {
  lists: MovieList[];
  activeListId?: string;
  onSelect: (listId: string) => void;
}

export function ListPicker({ lists, activeListId, onSelect }: ListPickerProps) {
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
            <button
              key={list.id}
              type="button"
              className={`list-pill ${active ? "active" : ""}`}
              onClick={() => onSelect(list.id)}
            >
              <span>{list.name}</span>
              <small>{list.movies.length} movies</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
