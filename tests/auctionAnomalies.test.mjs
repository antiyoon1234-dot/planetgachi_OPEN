import test from 'node:test';
import assert from 'node:assert/strict';
import { detectAuctionAnomalies, buildAuctionBaselines } from '../src/lib/auctionAnomalies.ts';
const base = { item_type: 'minecraft:stone', display_name: null, avg_price: 100, tx_count: 10 };
const tx = { id: 'uuid-transaction', item_type: base.item_type, price: 100, transaction_date: '2026-10-02T00:00:00Z', item_info: { amount: 1, displayName: null } };
test('detects both threshold boundaries with string IDs and current view columns', () => {
  const rows = detectAuctionAnomalies([{ ...tx, price: 150 }, { ...tx, id: 'low', price: 50 }, tx], [base], 50);
  assert.deepEqual(rows.map(r => r.diff_percent), [50, -50]);
  assert.equal(rows[0].id, tx.id);
});
test('compares stack unit prices and reports matching total price units', () => {
  assert.equal(detectAuctionAnomalies([{ ...tx, price: 6400, item_info: { amount: 64 } }], [base]).length, 0);
  const [row] = detectAuctionAnomalies([{ ...tx, price: 9600, item_info: { amount: 64 } }], [base]);
  assert.equal(row.price, 9600);
  assert.equal(row.avg_price, 6400);
});
test('does not round inexpensive items to zero before detection', () => {
  assert.equal(detectAuctionAnomalies([{ ...tx, price: 20 }], [{ ...base, avg_price: 10 }])[0].diff_percent, 100);
});
test('honors configured threshold and minimum sample count', () => {
  assert.equal(detectAuctionAnomalies([{ ...tx, price: 130 }], [base], 20).length, 1);
  assert.equal(detectAuctionAnomalies([{ ...tx, price: 130 }], [base], 50).length, 0);
  assert.equal(detectAuctionAnomalies([{ ...tx, price: 130 }], [{ ...base, tx_count: 2 }], 20, 3).length, 0);
});
test('does not compare named variants against base items or enhanced items', () => {
  for (const extra of [{ item_info: { displayName: 'custom' } }, { enhancement_level: 1 }, { enchants: [{}] }]) {
    assert.equal(detectAuctionAnomalies([{ ...tx, price: 1000, ...extra }], [base]).length, 0);
  }
});
test('ignores invalid prices, amounts, and baselines', () => {
  for (const price of [-1, NaN, Infinity]) assert.equal(detectAuctionAnomalies([{ ...tx, price }], [base]).length, 0);
  assert.equal(detectAuctionAnomalies([{ ...tx, item_info: { amount: 0 } }], [base]).length, 0);
  assert.equal(detectAuctionAnomalies([tx], [{ ...base, avg_price: 0 }]).length, 0);
});

test('spruce log regression: 64 logs for 100 must not compare against 10688', () => {
 const normal = Array.from({length: 10}, (_,i) => ({...tx, id: String(i), item_type:'minecraft:spruce_log', price:100, item_info:{amount:64,displayName:null}}));
 const outlier = {...normal[0],id:'outlier',price:100000};
 const rows = [...normal,outlier];
 const refs = buildAuctionBaselines(rows,20);
 assert.equal(refs[0].avg_price,100/64);
 assert.equal(refs[0].tx_count,10);
 const detected = detectAuctionAnomalies(rows,refs,20,3);
 assert.deepEqual(detected.map(r=>r.id),['outlier']);
 assert.equal(detected[0].avg_price,100);
});
test('baseline groups separate custom variants and ignore enhanced records', () => {
 const refs=buildAuctionBaselines([tx,{...tx,id:'custom',price:10000,item_info:{displayName:'special',amount:1}},{...tx,id:'enhanced',price:99999,enhancement_level:1}]);
 assert.equal(refs.length,2);
 assert.equal(refs.find(row=>row.display_name===null).avg_price,100);
});
