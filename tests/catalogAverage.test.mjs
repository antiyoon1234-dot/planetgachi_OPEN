import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogAverage } from '../src/lib/catalogAverage.ts';
const item = { code: 'Diamond', name: '다이아몬드' };
const tx = (name, price=6400, amount=64) => ({ item_type: 'minecraft:diamond', price, item_info: { displayName: name, amount } });
test('does not substitute specialty diamond transactions for ordinary diamonds', () => {
 assert.equal(catalogAverage(item, [tx('특산품')], 64).average, null);
 assert.equal(catalogAverage(item, [tx('특산품', 99999), tx(null)], 64).average, 6400);
});
test('uses exact display names for custom items sharing a material', () => {
 assert.equal(catalogAverage({code:'special', name:'특산품'}, [tx('특산품',200),tx(null,50000)],1).average,3);
});
test('normalizes arbitrary sale quantities to the catalog unit', () => {
 assert.equal(catalogAverage(item,[tx(null,6400,64),tx(null,1600,16)],64).average,6400);
 assert.equal(catalogAverage(item,[tx(null,6400,64)],1).average,100);
});
test('retains low prices and excludes outliers using the home median rule', () => {
 const result=catalogAverage(item,[tx(null,31,1),tx(null,32,1),tx(null,30000,1)],1);
 assert.equal(result.average,32);assert.equal(result.samples,2);
});
test('rejects invalid quantities and prices', () => {
 assert.equal(catalogAverage(item,[tx(null,100,0),tx(null,-1,1)],64).average,null);
});
