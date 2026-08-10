# Frontend design

## Visual foundation

The interface uses the tokens and panel system defined in
`apps/frontend/app/globals.css`: dark green navigation, light neutral content
surfaces, lime active states, compact monospace values and responsive panels.

## Backtesting workspace

The Strategies route is split into a configuration/research sidebar and a
result workspace. Saved research stays compact and supports row selection plus
one select-all checkbox in the table header.

## Animated execution map

- Animation, follow-chart, speed and playback controls share one toolbar.
- Follow-chart keeps the latest candle near 72% of the visible chart width so
  upcoming movement and exit labels have space.
- Supported speeds are 0.5x, 1x, 2x, 4x, 5x, 10x, 20x, 50x and 100x.
- Entry markers are triangles; exit markers are circles with a nearby signed
  P&L value.
- A dotted line connects each visible entry and exit pair.
- Vertical dashed separators indicate UTC days for intraday charts, months for
  daily/weekly charts and years for monthly charts.
- While animation is enabled, Virtual execution reveals trades at entry and
  withholds close information until exit. Disabling animation shows all rows.

## Responsive and accessible behavior

The chart scrolls inside its own frame and must not create document-level
horizontal overflow. Controls use native labels, checkboxes and buttons;
visual-only SVG elements retain translated accessible labels on meaningful
markers and exits.
