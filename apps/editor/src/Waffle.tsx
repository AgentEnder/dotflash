import type { Anchor } from "./align";

const ANCHORS: Anchor[] = ["start", "center", "end"];
const NAMES = { vertical: ["top", "middle", "bottom"], horizontal: ["left", "centre", "right"] };

type Props = {
  onAlign: (horizontal: Anchor, vertical: Anchor) => void;
};

/** A 3 × 3 grid that snaps the selection to a corner, an edge midpoint, or the centre. */
export function Waffle({ onAlign }: Props) {
  return (
    <div className="waffle" role="group" aria-label="Align on printable area">
      {ANCHORS.flatMap((vertical, row) =>
        ANCHORS.map((horizontal, column) => (
          <button
            key={`${vertical}-${horizontal}`}
            className={`waffle-cell h-${horizontal} v-${vertical}`}
            aria-label={`Align ${NAMES.vertical[row]} ${NAMES.horizontal[column]}`}
            title={`Align ${NAMES.vertical[row]} ${NAMES.horizontal[column]}`}
            onClick={() => onAlign(horizontal, vertical)}
          />
        )),
      )}
    </div>
  );
}
