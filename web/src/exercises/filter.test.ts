import { describe, expect, it } from 'vitest';
import { filterByName } from './filter';

const items = [{ name: 'Plank' }, { name: 'Side plank' }, { name: 'Squat' }];

describe('filterByName', () => {
  it('returns everything for a blank query', () => expect(filterByName(items, '  ')).toEqual(items));
  it('matches anywhere in the name, ignoring case and outer spaces', () => {
    expect(filterByName(items, ' PLANK ')).toEqual([{ name: 'Plank' }, { name: 'Side plank' }]);
  });
  it('returns nothing when nothing matches', () => expect(filterByName(items, 'lunge')).toEqual([]));
});
