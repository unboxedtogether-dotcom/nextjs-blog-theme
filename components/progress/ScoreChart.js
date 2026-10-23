import { useEffect, useRef, useState } from 'react';
import { formatChange, weekLabel } from '../../utils/progress-timeline.mjs';

// Drawn at the container's real width so text stays readable on phones.
const layout = (width) => {
  const size = { width, height: width < 500 ? 230 : 260, left: 34, right: width < 500 ? 58 : 64, top: 18, bottom: 34 };
  const plotWidth = size.width - size.left - size.right;
  const plotHeight = size.height - size.top - size.bottom;
  return { size, plotWidth, plotHeight, y: (value) => size.top + plotHeight - (value / 100) * plotHeight };
};
const formatDay = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function describeWeek(week) {
  if (week.status === 'missed') return `${weekLabel(week.weekNumber)}: no check-in`;
  if (week.status === 'due') return `${weekLabel(week.weekNumber)}: check-in due this week`;
  if (week.status === 'incomplete') return `${weekLabel(week.weekNumber)}: incomplete, not scored`;
  const change = week.change === null ? '' : `, ${changeWords(week.change, week.previousWeekNumber)}`;
  return `${weekLabel(week.weekNumber)}: ${Math.round(week.overall)} out of 100${change}`;
}

export function changeWords(delta, comparedWeek) {
  const rounded = Math.round(delta);
  const against = comparedWeek === null || comparedWeek === undefined ? '' : ` than ${weekLabel(comparedWeek)}`;
  if (rounded === 0) return `no change from ${weekLabel(comparedWeek)}`;
  return `${Math.abs(rounded)} ${Math.abs(rounded) === 1 ? 'point' : 'points'} ${rounded > 0 ? 'higher' : 'lower'}${against}`;
}

// Up, down or level, always with a symbol and words so it never relies on colour.
// The wording describes the score only; it does not claim a health change.
export function Change({ delta, comparedWeek, compact = false }) {
  if (delta === null || delta === undefined) return null;
  const rounded = Math.round(delta);
  const kind = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'same';
  const symbol = { up: '▲', down: '▼', same: '●' }[kind];
  return (
    <span className={`score-change is-${kind}`}>
      <span aria-hidden="true">{symbol}</span> {rounded === 0 ? 'No change' : formatChange(rounded)}
      <span className={compact ? 'sr-only' : 'score-change__words'}>{compact ? `, ${changeWords(rounded, comparedWeek)}` : rounded === 0 ? '' : ` vs ${weekLabel(comparedWeek)}`}</span>
    </span>
  );
}

// Overall score over time. One series, so no legend: the heading names it.
// Missed and incomplete weeks are gaps (dashed bridge), never zero.
export default function ScoreChart({ weeks, baselineScore, onSelect, label = 'Overall score over time' }) {
  const wrap = useRef(null);
  const [active, setActive] = useState(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const observer = new ResizeObserver(([item]) => setWidth(Math.max(280, Math.round(item.contentRect.width))));
    if (wrap.current) observer.observe(wrap.current);
    return () => observer.disconnect();
  }, []);
  const { size, plotWidth, plotHeight, y } = layout(width);
  const points = weeks.map((week, index) => ({
    week,
    x: size.left + (weeks.length === 1 ? plotWidth / 2 : (index * plotWidth) / (weeks.length - 1)),
    y: week.status === 'complete' ? y(week.overall) : null,
  }));
  const plotted = points.filter((point) => point.y !== null);

  const segments = [];
  const bridges = [];
  let previous = null;
  points.forEach((point, index) => {
    if (point.y === null) return;
    if (previous) (previous.index === index - 1 ? segments : bridges).push([previous, point]);
    previous = { ...point, index };
  });

  const labelEvery = Math.max(1, Math.ceil(weeks.length / (width < 500 ? 6 : 10)));
  const last = plotted[plotted.length - 1];
  const activePoint = active === null ? null : points[active];

  const nearest = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * size.width;
    let best = 0;
    points.forEach((point, index) => { if (Math.abs(point.x - x) < Math.abs(points[best].x - x)) best = index; });
    return best;
  };

  if (!plotted.length) {
    return <p className="chart-empty">Your chart appears once your baseline is complete.</p>;
  }

  return (
    <div className="score-chart" ref={wrap}>
      <svg viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label={`${label}. ${weeks.map(describeWeek).join('. ')}.`}>
        {[0, 25, 50, 75, 100].map((value) => (
          <g key={value} className="score-chart__grid">
            <line x1={size.left} x2={size.width - size.right + 8} y1={y(value)} y2={y(value)} />
            <text x={size.left - 8} y={y(value) + 4} textAnchor="end">{value}</text>
          </g>
        ))}
        {baselineScore !== null && baselineScore !== undefined && (
          <g className="score-chart__baseline">
            <line x1={size.left} x2={size.width - size.right + 8} y1={y(baselineScore)} y2={y(baselineScore)} />
            <text x={size.width - size.right + 12} y={y(baselineScore) + 4}>Baseline</text>
          </g>
        )}
        {points.map((point, index) => (index % labelEvery === 0 || index === points.length - 1) && (
          <text key={point.week.weekNumber} className="score-chart__axis" x={point.x} y={size.height - 12} textAnchor="middle">
            {point.week.weekNumber === 0 ? 'Base' : `W${point.week.weekNumber}`}
          </text>
        ))}
        {points.filter((point) => point.y === null && point.week.status !== 'due').map((point) => (
          <g key={`gap-${point.week.weekNumber}`} className="score-chart__gap">
            <line x1={point.x} x2={point.x} y1={size.top} y2={size.top + plotHeight} />
          </g>
        ))}
        {bridges.map(([from, to]) => <line key={`b-${from.week.weekNumber}`} className="score-chart__bridge" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />)}
        {segments.map(([from, to]) => <line key={`s-${from.week.weekNumber}`} className="score-chart__line" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />)}
        {activePoint && <line className="score-chart__crosshair" x1={activePoint.x} x2={activePoint.x} y1={size.top} y2={size.top + plotHeight} />}
        {plotted.map((point) => (
          <g
            key={point.week.weekNumber}
            className={`score-chart__point${activePoint === point ? ' is-active' : ''}`}
            tabIndex={0}
            role="button"
            aria-label={`${describeWeek(point.week)}. Show details.`}
            onFocus={() => setActive(points.indexOf(point))}
            onBlur={() => setActive(null)}
            onClick={() => onSelect?.(point.week.weekNumber)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(point.week.weekNumber); } }}
          >
            <circle className="score-chart__hit" cx={point.x} cy={point.y} r={14} />
            <circle className="score-chart__dot" cx={point.x} cy={point.y} r={4.5} />
          </g>
        ))}
        {last && <text className="score-chart__label" x={last.x + 10} y={last.y - 8}>{Math.round(last.week.overall)}</text>}
        <rect
          className="score-chart__overlay"
          x={size.left - 10} y={size.top} width={plotWidth + 20} height={plotHeight}
          onPointerMove={(event) => setActive(nearest(event))}
          onPointerDown={(event) => setActive(nearest(event))}
          onPointerLeave={() => setActive(null)}
          onClick={(event) => { const index = nearest(event); if (points[index].week.status !== 'missed') onSelect?.(points[index].week.weekNumber); }}
        />
      </svg>
      {activePoint && (
        <div className="score-chart__tooltip" style={{ left: `${(activePoint.x / size.width) * 100}%`, top: `${((activePoint.y ?? size.top + plotHeight / 2) / size.height) * 100}%` }} role="status">
          {activePoint.week.status === 'complete' ? (
            <>
              <strong>{Math.round(activePoint.week.overall)}/100</strong>
              <span>{weekLabel(activePoint.week.weekNumber)} · {formatDay(activePoint.week.entryDate ? `${activePoint.week.entryDate}T12:00:00Z` : activePoint.week.submittedAt)}</span>
              {activePoint.week.change !== null && <Change delta={activePoint.week.change} comparedWeek={activePoint.week.previousWeekNumber} />}
            </>
          ) : (
            <>
              <strong>{activePoint.week.status === 'incomplete' ? 'Incomplete' : activePoint.week.status === 'due' ? 'Due this week' : 'No check-in'}</strong>
              <span>{weekLabel(activePoint.week.weekNumber)}{activePoint.week.status === 'incomplete' ? ' · not scored' : ''}</span>
            </>
          )}
        </div>
      )}
      <p className="score-chart__note">Breaks in the line are weeks without a completed check-in. They are not counted as zero.</p>
    </div>
  );
}
