import test from 'node:test';
import assert from 'node:assert/strict';
import {billingListenOptions} from './listen.mjs';

test('normal starts remain loopback; containers explicitly opt in',()=>{
 assert.deepEqual(billingListenOptions({}),{host:'127.0.0.1',port:37326});
 assert.deepEqual(billingListenOptions({CAFE_BILLING_HOST:'0.0.0.0',CAFE_BILLING_PORT:'37327'}),{host:'0.0.0.0',port:37327});
});
test('invalid or empty listen configuration fails before reading credentials',()=>{
 for(const host of ['', 'localhost', '::', '192.168.1.1'])assert.throws(()=>billingListenOptions({CAFE_BILLING_HOST:host}),/invalid_CAFE_BILLING_HOST/);
 for(const port of ['', '0', '-1', '65536', '1.5', '1e3', ' 37326'])assert.throws(()=>billingListenOptions({CAFE_BILLING_PORT:port}),/invalid_CAFE_BILLING_PORT/);
});
