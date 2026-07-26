import { describe, expect, it } from 'vitest'
import { TOPICS } from '../meta'
import { buildSeriesList } from '../series'

const cell = (v) => ({ value: v, suppressed: false })
const doc = (code, topics) => ({ district: { dpi_code: code, dpi_name: `D${code}` }, topics })

const enrollment = TOPICS.find((t) => t.id === 'enrollment')
const act = TOPICS.find((t) => t.id === 'act')

const districtDoc = doc('6223', {
  enrollment: { '2005-06': { total_enrollment: cell(1000) }, '2006-07': { total_enrollment: cell(900) } },
  act: { '2024-25': { composite_avg: cell(19) } },
})
const stateDoc = doc('0000', {
  enrollment: { '2005-06': { total_enrollment: cell(800000) } },
  act: { '2024-25': { composite_avg: cell(19.23) } },
})

describe('buildSeriesList', () => {
  it('omits the statewide overlay for raw-count metrics', () => {
    const list = buildSeriesList({
      topic: enrollment, metric: 'total_enrollment',
      doc: districtDoc, stateDoc, peerDocs: [], peerColorOf: () => '#000',
    })
    expect(list.map((s) => s.key)).toEqual(['district'])
  })

  it('includes the statewide overlay for scores, district drawn last (on top)', () => {
    const list = buildSeriesList({
      topic: act, metric: 'composite_avg',
      doc: districtDoc, stateDoc, peerDocs: [], peerColorOf: () => '#000',
    })
    expect(list.map((s) => s.key)).toEqual(['state', 'district'])
    expect(list[list.length - 1].label).toBe('D6223')
  })

  it('restores the statewide overlay on the derived enrollment-change view', () => {
    const list = buildSeriesList({
      topic: enrollment, metric: 'enrollment_change',
      doc: districtDoc, stateDoc, peerDocs: [], peerColorOf: () => '#000',
    })
    expect(list.map((s) => s.key)).toEqual(['nation', 'state', 'district'])
    const district = list[list.length - 1]
    expect(district.cells['2005-06'].value).toBe(0)
    expect(district.cells['2006-07'].value).toBe(-10)
  })
})

describe('buildGroupSeriesList', () => {
  const subDoc = {
    district: { dpi_code: '6223', dpi_name: 'Wausau' },
    topics: {
      act: {
        '2023-24': {
          race_ethnicity: {
            White: { composite_avg: cell(19.5) },
            Hispanic: { composite_avg: { value: null, suppressed: true } },
          },
        },
        '2024-25': {
          race_ethnicity: {
            White: { composite_avg: cell(19.2) },
            Hispanic: { composite_avg: cell(17.1) },
            'Two or More': { composite_avg: cell(18.0) },
          },
        },
      },
    },
  }

  it('builds one series per group, sorted, with suppression preserved', async () => {
    const { buildGroupSeriesList } = await import('../series')
    const { TOPICS } = await import('../meta')
    const act = TOPICS.find((t) => t.id === 'act')
    const list = buildGroupSeriesList({ topic: act, metric: 'composite_avg', subDoc, dimension: 'race_ethnicity' })
    expect(list.map((s) => s.label)).toEqual(['Hispanic', 'Two or more races', 'White'])
    const hispanic = list[0]
    expect(hispanic.cells['2023-24'].suppressed).toBe(true)
    expect(hispanic.cells['2024-25'].value).toBe(17.1)
    // late-added category simply starts when DPI's data does
    expect(Object.keys(list[1].cells)).toEqual(['2024-25'])
  })
})

describe('national (United States) series', () => {
  const grad = TOPICS.find((t) => t.id === 'graduation')
  const gradDoc = doc('6223', {
    graduation: { '2018-19': { grad_rate_4yr: cell(92.0) } },
  })
  const gradState = doc('0000', {
    graduation: { '2018-19': { grad_rate_4yr: cell(90.0) } },
  })

  it('adds the U.S. line for graduation rate (comparable ACGR methodology)', () => {
    const list = buildSeriesList({
      topic: grad, metric: 'grad_rate_4yr',
      doc: gradDoc, stateDoc: gradState, peerDocs: [], peerColorOf: () => '#000',
    })
    expect(list.map((s) => s.key)).toEqual(['nation', 'state', 'district'])
    const nation = list[0]
    expect(nation.label).toBe('United States')
    expect(nation.cells['2018-19'].value).toBe(86)
    expect(nation.cells['2021-22'].value).toBe(87)
  })

  it('adds the U.S. line to enrollment change (indexed), based to 2005-06', () => {
    const list = buildSeriesList({
      topic: enrollment, metric: 'enrollment_change',
      doc: districtDoc, stateDoc, peerDocs: [], peerColorOf: () => '#000',
    })
    const nation = list.find((s) => s.key === 'nation')
    expect(nation).toBeDefined()
    expect(nation.cells['2005-06'].value).toBe(0)
    // 49,618,000 / 49,113,000 - 1 = +1.0%
    expect(nation.cells['2022-23'].value).toBe(1)
  })

  it('never adds a U.S. line to ACT or raw counts', () => {
    const actList = buildSeriesList({
      topic: act, metric: 'composite_avg',
      doc: districtDoc, stateDoc, peerDocs: [], peerColorOf: () => '#000',
    })
    expect(actList.some((s) => s.key === 'nation')).toBe(false)
    const countList = buildSeriesList({
      topic: enrollment, metric: 'total_enrollment',
      doc: districtDoc, stateDoc, peerDocs: [], peerColorOf: () => '#000',
    })
    expect(countList.some((s) => s.key === 'nation')).toBe(false)
  })
})
