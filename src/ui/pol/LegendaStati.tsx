import { ETICHETTA_STATO, type StatoCella } from '../../analysis/pol';

export function LegendaStati({ stati }: { stati: StatoCella[] }) {
  return (
    <ul className="legenda-stati">
      {stati.map((s) => (
        <li key={s}>
          <span className={`campione st-${s}`} aria-hidden="true" />
          {ETICHETTA_STATO[s]}
        </li>
      ))}
    </ul>
  );
}
