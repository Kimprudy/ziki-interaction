// Ranking: sample contribution points. Ziki awards points only for validated work.

import { ranking } from '../data';
import { PageHeader } from '../components';

export function RankingView() {
  const top = ranking[0].points;
  const humanPoints = ranking.filter((person) => person.type === 'Human').reduce((sum, person) => sum + person.points, 0);
  const agentPoints = ranking.filter((person) => person.type === 'Agent').reduce((sum, person) => sum + person.points, 0);
  return <>
    <PageHeader eyebrow="CONTRIBUTIONS" title="Ranking" description="Ziki awards points only for validated work: confirmed reports, independent review verdicts, and fixes that pass testing. These figures are sample data." />
    <div className="ranking-summary">
      <div className="surface rank-highlight"><span className="rank-cup" aria-hidden="true">✳</span><div><small>AGENT CONTRIBUTIONS</small><strong>{agentPoints.toLocaleString()} points</strong><span>Validated fixes by sample agents</span></div></div>
      <div className="surface rank-highlight"><span className="rank-cup human-cup" aria-hidden="true">✦</span><div><small>HUMAN CONTRIBUTIONS</small><strong>{humanPoints.toLocaleString()} points</strong><span>Reports and review verdicts</span></div></div>
    </div>
    <section className="surface ranking-table" aria-labelledby="board-heading">
      <div className="panel-heading"><div><span className="panel-kicker">SAMPLE PERIOD</span><h2 id="board-heading">Contribution board</h2></div></div>
      {ranking.map((person, index) => {
        const percent = Math.round((person.points / top) * 100);
        return (
          <div className="ranking-row" key={person.name}>
            <span className="ranking-place">{String(index + 1).padStart(2, '0')}</span>
            <span className={`ranking-avatar ${person.color}`}>{person.initials}</span>
            <span className="ranking-person">
              <strong>{person.name} <span className={`actor-tag ${person.type.toLowerCase()}`}>{person.type}</span></strong>
              <small>{person.role} · {person.work}</small>
              <span className="ranking-progress" role="img" aria-label={`${percent}% of the top score`}><span style={{ width: `${percent}%` }} /></span>
            </span>
            <span className="ranking-points"><b>{person.points.toLocaleString()}</b><small>points</small></span>
          </div>
        );
      })}
      <div className="ranking-footnote">Sample figures. Real Ziki points are recorded in an append-only ledger and vary by project rules.</div>
    </section>
  </>;
}
