import { describe, expect, it } from 'vitest'
import { chartCSV } from '../csv'

describe('chartCSV', () => {
  it('writes suppressed as a word, missing as blank, and escapes labels', () => {
    const csv = chartCSV([
      {
        label: 'Athens, "small"',
        cells: {
          '2023-24': { value: 19.1, suppressed: false },
          '2024-25': { value: null, suppressed: true },
        },
      },
      { label: 'Wisconsin', cells: { '2024-25': { value: 19.23, suppressed: false } } },
    ])
    const lines = csv.trimEnd().split('\n')
    expect(lines[0]).toBe('school_year,"Athens, ""small""",Wisconsin')
    expect(lines[1]).toBe('2023-24,19.1,')
    expect(lines[2]).toBe('2024-25,suppressed,19.23')
  })
})
