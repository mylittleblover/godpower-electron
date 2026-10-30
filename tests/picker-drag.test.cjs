const {test}=require('node:test');const assert=require('node:assert/strict');const {point,move}=require('../desktop/picker-drag.cjs');
test('pointer deltas move icon directly without relying on mouse cursor',()=>{const drag={cursor:{x:100,y:200},bounds:{x:-100,y:70},moved:false};assert.deepEqual(move(drag,{x:140,y:250}),{x:-60,y:120,moved:true});assert.deepEqual(move(drag,{x:101,y:201}),{x:-99,y:71,moved:false});});
test('drag intent remains set after returning to initial position',()=>{assert.equal(move({cursor:{x:1,y:1},bounds:{x:10,y:10},moved:true},{x:1,y:1}).moved,true)});
test('malformed cross-window coordinates are rejected',()=>{for(const p of [null,{x:Infinity,y:0},{x:NaN,y:4},{x:100001,y:0},{x:'10',y:1}])assert.throws(()=>point(p));});
