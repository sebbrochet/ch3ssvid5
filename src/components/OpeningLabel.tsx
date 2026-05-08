import type { OpeningInfo } from '../utils/openingLookup';
import './OpeningLabel.css';

interface Props {
  opening: OpeningInfo | null;
}

export function OpeningLabel({ opening }: Props) {
  if (!opening) return null;

  return (
    <div className="opening-label">
      <span className="opening-eco">{opening.eco}</span>
      <span className="opening-name">{opening.name}</span>
    </div>
  );
}
