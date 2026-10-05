import test from 'node:test'
import assert from 'node:assert/strict'
import { assignLabelCodes, createLabelCode, labelSnapshot, parseLabelSnapshot, mergeLabelRecords, matchLabel, persistLabels, readStoredLabels } from './bowelLabels.js'
const sample = (id = '1') => ({ id, name: '測試甲', identity: 'A200000012', provider: '測試衛生所', area: '彰化市', category: '衛生所', state: '已預約', date: '2026-10-02', tubeReturned: false })
test('random identifiers have 12 digits, remain unique, and survive reprinting', () => {
  const records = Array.from({ length: 1000 }, (_, index) => sample(String(index)))
  assignLabelCodes(records)
  const codes = records.map(record => record.barcode)
  assert.ok(codes.every(code => /^\d{12}$/.test(code)))
  assert.equal(new Set(codes).size, 1000)
  assignLabelCodes(records)
  assert.deepEqual(records.map(record => record.barcode), codes)
  assert.ok(!new Set(codes).has(createLabelCode(new Set(codes))))
})
test('snapshot round trip preserves label identity and current status without arbitrary properties', () => {
  const record = { ...sample(), malicious: '<script>bad()</script>' }; assignLabelCodes([record])
  const parsed = parseLabelSnapshot(JSON.stringify(labelSnapshot([record])))
  assert.equal(parsed[0].barcode, record.barcode)
  assert.equal(parsed[0].identity, record.identity)
  assert.equal(parsed[0].state, '已預約')
  assert.ok(!Object.hasOwn(parsed[0], 'malicious'))
})
test('malformed or duplicate files fail before any roster mutation', () => {
  const records = [sample()]; assignLabelCodes(records)
  for (const text of ['invalid', '{}', JSON.stringify({ ...labelSnapshot(records), records: [...labelSnapshot(records).records, ...labelSnapshot(records).records] }), JSON.stringify({ ...labelSnapshot(records), records: [{ ...labelSnapshot(records).records[0], barcode: 'bad' }] })]) assert.throws(() => parseLabelSnapshot(text))
  assert.equal(records.length, 1)
})
test('merge updates matching ids, adds new ids, and refuses barcode collisions', () => {
  const current = [sample('1')]; const incoming = [sample('2')]; assignLabelCodes([...current, ...incoming])
  assert.equal(mergeLabelRecords(current, incoming).length, 2)
  assert.equal(mergeLabelRecords(current, [{ ...current[0], state: '已派送' }])[0].state, '已派送')
  assert.throws(() => mergeLabelRecords(current, [{ ...incoming[0], barcode: current[0].barcode }]))
  assert.equal(current[0].state, '已預約')
})
test('matching requires exactly one existing code; cancelled records remain visible', () => {
  const record = { ...sample(), state: '已取消' }; assignLabelCodes([record])
  assert.equal(matchLabel([record], ` ${record.barcode} `).record, record)
  assert.match(matchLabel([record], 'abc').error, /12 碼/)
  assert.match(matchLabel([record], '000000000000').error, /查無/)
  assert.match(matchLabel([record, { ...record, id: '2' }], record.barcode).error, /多筆/)
})
test('local storage snapshot is recoverable and unavailable storage is handled', () => {
  const records = [sample()]; assignLabelCodes(records)
  let stored; const storage = { getItem: () => stored, setItem: (_key, value) => { stored = value } }
  assert.equal(persistLabels(records, storage), true)
  assert.equal(readStoredLabels(storage)[0].barcode, records[0].barcode)
  assert.equal(persistLabels(records, null), false)
  assert.deepEqual(readStoredLabels(null), [])
})
