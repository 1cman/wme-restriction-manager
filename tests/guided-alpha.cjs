'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const file=path.join(__dirname,'../alpha/Restriction_Manager_Guided_Alpha.user.js');
const src=fs.readFileSync(file,'utf8');
new vm.Script(src,{filename:file});
const a=require(file);
assert.deepEqual(a.availableDirections({isAtoB:true}),['FWD']);
assert.deepEqual(a.availableDirections({isBtoA:true}),['REV']);
assert.deepEqual(a.availableDirections({isTwoWay:true}),['FWD','REV','BOTH']);
assert.deepEqual(a.availableDirections({}),[]);
assert.deepEqual(a.countryIdentity({country:{id:1,name:'Italy'}}),{id:1,name:'Italy',code:null});
assert.equal(a.countryIdentity(null),null);
assert.equal(a.countryIdentity({country:{name:'Italy'}}),null);
assert.equal(a.normalizeLabel(' + Aggiungi   restrizioni '),'aggiungi restrizioni');
assert.equal(a.SCOPES.length,4);
assert.equal(a.LANES.length,6);
assert.ok(!a.SCOPES.includes('scope_none'));
assert.ok(!a.SCOPES.includes(null));
assert.ok(a.SCOPES.includes('segment'));
assert.ok(a.SCOPES.includes('left') && a.SCOPES.includes('center') && a.SCOPES.includes('right'));
assert.ok(a.LANES.includes('lane_none'));
for(const scope of a.SCOPES)for(const lane of a.LANES){
    const draft=a.normalizeDraft({direction:'FWD',scope,lane},{isAtoB:true});
    assert.equal(draft.verified,false);
    assert.equal(draft.lane,lane);
}
assert.throws(()=>a.normalizeDraft({direction:'REV',scope:'left',lane:'hov'},{isAtoB:true}));
assert.throws(()=>a.normalizeDraft({direction:'FWD',scope:'left',lane:'invented'},{isAtoB:true}));
assert.throws(()=>a.normalizeDraft({direction:'FWD',scope:'segment',lane:null},{isAtoB:true}));
assert.throws(()=>a.normalizeDraft({direction:'FWD',scope:'random',lane:'hov'},{isAtoB:true}));
assert.throws(()=>a.normalizeDraft({direction:'FWD',scope:'scope_none',lane:'lane_none'},{isAtoB:true}));
assert.throws(()=>a.normalizeDraft({direction:'FWD',scope:null,lane:'lane_none'},{isAtoB:true}));
assert.deepEqual(a.normalizeDraft({direction:'FWD',scope:'segment',lane:'lane_none'},{isAtoB:true}),{
  direction:'FWD',scope:'segment',lane:'lane_none',verified:false
});
assert.ok(src.includes('next.disabled=(step===1&&!SCOPES.includes(draft.scope))'),
  'User cannot progress from scope step until an explicit valid choice');
assert.ok(src.includes('if (step === 1 && !SCOPES.includes(draft.scope)) return;'),
  'Programmatic progression must enforce scope selection');
assert.ok(src.includes('warning.setAttribute("role","alert")'),
  'Missing selection must display an accessible warning');
assert.ok(src.includes('const draft={direction:availableDirections(current.segment).at(-1),scope:null,lane:"lane_none"};'),
  'The wizard must never preselect an arbitrary scope');
assert.ok(!/\b(updateSegment|savePreset|localStorage|GM_xmlhttpRequest|fetch)\s*\(/.test(src),'Read-only alpha must not write or export map data');
(async()=>{
 const segment={id:1,isAtoB:true,restrictions:[]};
 const sdk={Editing:{getSelection:async()=>({objectType:'segment',ids:[1]})},DataModel:{Segments:{getById:async()=>segment,getAddress:async()=>({country:{id:1,name:'Italy'}})}}};
 assert.equal((await a.readContext(sdk)).country.name,'Italy');
 sdk.DataModel.Segments.getAddress=async()=>{throw Error('unknown')};
 assert.equal((await a.readContext(sdk)).country,null);
 sdk.Editing.getSelection=async()=>({objectType:'venue',ids:[1]});
 assert.equal(await a.readContext(sdk),null);
 sdk.Editing.getSelection=async()=>({objectType:'segment',ids:[1,2]});
 assert.equal(await a.readContext(sdk),null);
 console.log('PASS: guided alpha direction, country, scope, lane draft and read-only guards');
})().catch(e=>{console.error(e);process.exitCode=1;});
