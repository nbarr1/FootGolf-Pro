import test from 'node:test';
import assert from 'node:assert/strict';
import { getAtmosphere, sunDirection } from './atmosphere';

test('each course theme gets its own sun height', () => {
  assert.ok(getAtmosphere({ theme: 'desert' }).sunElevationDeg < getAtmosphere({ theme: 'alpine' }).sunElevationDeg);
  assert.equal(getAtmosphere({ theme: 'unknown' as never }).sunElevationDeg, getAtmosphere({ theme: 'parkland' }).sunElevationDeg);
});

test('sun direction is a unit vector above the horizon', () => {
  for (const theme of ['parkland', 'desert', 'alpine', 'japanese_garden'] as const) {
    const d = sunDirection(getAtmosphere({ theme }));
    assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - 1) < 1e-9);
    assert.ok(d.y > 0);
  }
  const zenith = sunDirection({ sunElevationDeg: 90, sunAzimuthDeg: 0 });
  assert.ok(Math.abs(zenith.y - 1) < 1e-9);
});
