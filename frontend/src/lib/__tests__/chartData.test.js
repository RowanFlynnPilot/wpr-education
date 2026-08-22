import { describe, expect, it } from 'vitest'
import { buildChart, buildChartWithBreaks, pctChangeSeries, suppressedYears } from '../chartData'

const cell = (v) => ({ value: v, suppressed: false })
const SUP = { value: null, suppressed: true }

describe('buildChart', () => {
  it('splits series at a comparability break — no key spans it', () => {
    const cells = {}
    for (const y of ['2019-20', '2020-21', '2021-22', '2022-23', '2023-24', '2024-25']) {
      cells[y] = cell(19)
    }
    const breaks = [{ id: 'x', school_year: '2023-24', type: 'comparability_break' }]
    const { rows, seriesKeys } = buildChartWithBreaks(breaks, [{ key: 'd', cells }])
    expect(seriesKeys.d).toHaveLength(2)
    const [seg0, seg1] = seriesKeys.d
    const rowFor = (y) => rows.find((r) => r.year === y)
    expect(rowFor('2022-23')[seg0]).toBe(19)
    expect(rowFor('2022-23')[seg1]).toBeUndefined()
    expect(rowFor('2023-24')[seg1]).toBe(19)
    expect(rowFor('2023-24')[seg0]).toBeUndefined()
  })

  it('keeps the ACT line continuous across 2023-24 (cut-score entry is an annotation)', () => {
    const cells = {}
    for (const y of ['2022-23', '2023-24', '2024-25']) cells[y] = cell(19)
    const { seriesKeys, topicBreaks } = buildChart('act', [{ key: 'd', cells }])
    expect(seriesKeys.d).toHaveLength(1)
    expect(topicBreaks.find((b) => b.id === 'cutscores-2023-24').type).toBe('annotation')
  })

  it('hard-splits Forward at the 2023-24 cut-score break while ACT stays whole', () => {
    // The same DPI decision is two config entries: proficiency-category
    // rates (forward) break, score averages (act) do not. Guards against
    // ever re-merging them into one entry with one type.
    const cells = {}
    for (const y of ['2021-22', '2022-23', '2023-24', '2024-25']) cells[y] = cell(50)
    const fw = buildChart('forward', [{ key: 'd', cells }])
    expect(fw.seriesKeys.d).toHaveLength(2)
    expect(fw.topicBreaks.find((b) => b.id === 'cutscores-2023-24-forward').type)
      .toBe('comparability_break')
    expect(buildChart('act', [{ key: 'd', cells }]).seriesKeys.d).toHaveLength(1)
  })

  it('extends the x-domain to annotation years with no data (2025-26 ACT)', () => {
    const { years } = buildChart('act', [{ key: 'd', cells: { '2024-25': cell(19) } }])
    expect(years).toContain('2025-26')
  })

  it('does not split topics without comparability breaks', () => {
    const { seriesKeys } = buildChart('enrollment', [
      { key: 'd', cells: { '2005-06': cell(100), '2024-25': cell(90) } },
    ])
    expect(seriesKeys.d).toHaveLength(1)
  })

  it('carries suppression flags into rows as nulls, never zeros', () => {
    const { rows, seriesKeys } = buildChart('enrollment', [
      { key: 'd', cells: { '2020-21': SUP } },
    ])
    const row = rows.find((r) => r.year === '2020-21')
    expect(row[seriesKeys.d[0]]).toBeNull()
    expect(row.d__sup).toBe(true)
  })
})

describe('pctChangeSeries', () => {
  it('indexes to the first non-suppressed year and keeps suppression', () => {
    const out = pctChangeSeries({
      '2005-06': cell(1000),
      '2006-07': cell(900),
      '2007-08': SUP,
    })
    expect(out['2005-06'].value).toBe(0)
    expect(out['2006-07'].value).toBe(-10)
    expect(out['2007-08']).toEqual(SUP)
  })

  it('skips a suppressed base year', () => {
    const out = pctChangeSeries({ '2005-06': SUP, '2006-07': cell(200), '2007-08': cell(100) })
    expect(out['2006-07'].value).toBe(0)
    expect(out['2007-08'].value).toBe(-50)
  })
})

describe('suppressedYears', () => {
  it('lists only suppressed years, sorted', () => {
    expect(suppressedYears({ '2010-11': cell(1), '2009-10': SUP, '2012-13': SUP }))
      .toEqual(['2009-10', '2012-13'])
  })
})
