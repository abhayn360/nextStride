import { endpointsFeature, projectRoute, type Route, routeBounds, routeFeature, routeIsEmpty } from '../route-geometry';

const route: Route = [
  [
    [-0.12, 51.5],
    [-0.119, 51.501],
    [-0.118, 51.502],
  ],
  [
    [-0.11, 51.51],
    [-0.109, 51.511],
  ],
];

describe('route visualisation geometry', () => {
  it('builds a MultiLineString with one line per segment (no line across pauses)', () => {
    const feature = routeFeature(route);
    expect(feature.geometry.type).toBe('MultiLineString');
    expect(feature.geometry.coordinates).toHaveLength(2);
    expect(routeFeature([[[0.1, 0.1]]]).geometry.coordinates).toHaveLength(0);
  });

  it('marks start and, for finished runs, the finish', () => {
    const live = endpointsFeature(route, false);
    expect(live.features.map((f) => f.properties?.kind)).toEqual(['start']);
    const done = endpointsFeature(route, true);
    expect(done.features.map((f) => f.properties?.kind)).toEqual(['start', 'finish']);
    expect(done.features[0]!.geometry.coordinates).toEqual([-0.12, 51.5]);
    expect(done.features[1]!.geometry.coordinates).toEqual([-0.109, 51.511]);
    expect(endpointsFeature([], true).features).toHaveLength(0);
  });

  it('frames the whole route for the overview camera', () => {
    expect(routeBounds(route)).toEqual([-0.12, 51.5, -0.109, 51.511]);
    // A single point still gets a sensible minimum span.
    const [w, s, e, n] = routeBounds([[[-0.12, 51.5]]])!;
    expect(e - w).toBeCloseTo(0.002);
    expect(n - s).toBeCloseTo(0.002);
    expect(routeBounds([])).toBeNull();
    expect(routeIsEmpty([[], []])).toBe(true);
  });

  it('projects into an SVG box without distortion, north up', () => {
    const { lines } = projectRoute(route, 200, 100, 10);
    const all = lines.flat();
    for (const p of all) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(200);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
    // Going north moves up the screen.
    expect(lines[0]![1]!.y).toBeLessThan(lines[0]![0]!.y);
  });
});
