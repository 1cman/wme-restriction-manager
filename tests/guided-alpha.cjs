'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const file=path.join(__dirname,'../alpha/Restriction_Manager_Guided_Alpha.user.js');
const src=fs.readFileSync(file,'utf8');
new vm.Script(src,{filename:file});
const a=require(file);
assert.deepEqual(a.normalizeAdvanced({minPassengers:null,permitIds:[]},null),{minPassengers:null,permitIds:[],verified:false});
assert.deepEqual(a.normalizeAdvanced({minPassengers:3,permitIds:['pass1','pass1']},[{id:'pass1',name:'Example'}]),{minPassengers:3,permitIds:['pass1'],verified:false});
for(const bad of [0,1,-1,1.5,NaN,Infinity,'2']) {
    assert.throws(()=>a.normalizeAdvanced({minPassengers:bad,permitIds:[]},[]),/Invalid occupancy/);
}
assert.throws(()=>a.normalizeAdvanced({minPassengers:null,permitIds:['unlisted']},[]),/Unrecognized country permit/);
assert.throws(()=>a.normalizeAdvanced({minPassengers:null,permitIds:['pass1']},null),/Unrecognized country permit/);
assert.throws(()=>a.normalizeAdvanced({minPassengers:null,permitIds:'pass1'},null),/Invalid permits/);
assert.ok(src.includes('if(step===6) {'),'Advanced step must precede the summary');
assert.ok(src.includes('if(step===5){try{normalizeAdvanced(advanced,current.permits);}catch(_){return;}}'),
  'Next handler must block invalid advanced conditions');
assert.ok(src.includes('JSON.stringify(fresh.permits)!==JSON.stringify(current.permits)'),
  'Changes to country permit choices must abort the wizard');
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
assert.deepEqual(a.RESTRICTION_TYPES,['BLOCKED','FREE','TOLL']);
assert.equal(a.VEHICLE_TYPES.length,15);
assert.equal(new Set(a.VEHICLE_TYPES).size,15);
assert.equal(a.OVERRIDE_TYPES.BLOCKED,'FREE');
assert.equal(a.OVERRIDE_TYPES.FREE,'BLOCKED');
assert.equal(a.OVERRIDE_TYPES.TOLL,'FREE');
assert.deepEqual(a.selectedVehicleTypes(['TAXI','BUS','TAXI']),['BUS','TAXI']);
assert.throws(()=>a.selectedVehicleTypes(['INVENTED']));
assert.throws(()=>a.selectedVehicleTypes('BUS'));
assert.ok(!a.SCOPES.includes('scope_none'));
assert.ok(!a.SCOPES.includes(null));
assert.ok(a.SCOPES.includes('segment'));
assert.ok(a.SCOPES.includes('left') && a.SCOPES.includes('center') && a.SCOPES.includes('right'));
assert.ok(a.LANES.includes('lane_none'));
for(const scope of a.SCOPES)for(const lane of a.LANES){
    const draft=a.normalizeDraft({direction:'FWD',scope,lane,restrictionType:'BLOCKED',vehicleTypes:[]},{isAtoB:true});
    assert.equal(draft.verified,false);
    assert.equal(draft.lane,lane);
}
assert.throws(()=>a.normalizeDraft({direction:'REV',scope:'left',lane:'hov',restrictionType:'BLOCKED',vehicleTypes:[]},{isAtoB:true}));
assert.throws(()=>a.normalizeDraft({direction:'FWD',scope:'left',lane:'invented',restrictionType:'BLOCKED',vehicleTypes:[]},{isAtoB:true}));
assert.throws(()=>a.normalizeDraft({direction:'FWD',scope:'segment',lane:null,restrictionType:'BLOCKED',vehicleTypes:[]},{isAtoB:true}));
assert.throws(()=>a.normalizeDraft({direction:'FWD',scope:'random',lane:'hov',restrictionType:'BLOCKED',vehicleTypes:[]},{isAtoB:true}));
assert.throws(()=>a.normalizeDraft({direction:'FWD',scope:'scope_none',lane:'lane_none',restrictionType:'BLOCKED',vehicleTypes:[]},{isAtoB:true}));
assert.throws(()=>a.normalizeDraft({direction:'FWD',scope:null,lane:'lane_none',restrictionType:'BLOCKED',vehicleTypes:[]},{isAtoB:true}));
assert.deepEqual(a.normalizeDraft({direction:'FWD',scope:'segment',lane:'lane_none',restrictionType:'BLOCKED',vehicleTypes:[]},{isAtoB:true}),{
  direction:'FWD',scope:'segment',lane:'lane_none',defaultType:'BLOCKED',overrideType:'FREE',vehicleTypes:[],verified:false
});
for (const restrictionType of a.RESTRICTION_TYPES) {
  const draft={direction:'FWD',scope:'segment',lane:'lane_none',restrictionType,vehicleTypes:['MOTORCYCLE','TRUCK']};
  const result=a.normalizeDraft(draft,{isAtoB:true});
  assert.equal(result.defaultType,restrictionType);
  assert.equal(result.overrideType,a.OVERRIDE_TYPES[restrictionType]);
  assert.deepEqual(result.vehicleTypes,['MOTORCYCLE','TRUCK']);
  assert.equal(result.verified,false);
  assert.deepEqual(draft.vehicleTypes,['MOTORCYCLE','TRUCK'],'Input must not be modified');
}
for (const restrictionType of ['FREE','TOLL']) {
  assert.throws(()=>a.normalizeDraft({direction:'FWD',scope:'segment',lane:'lane_none',restrictionType,vehicleTypes:[]},{isAtoB:true}),
    /requires explicit vehicle override rules/);
}
assert.throws(()=>a.normalizeDraft({direction:'FWD',scope:'segment',lane:'lane_none',restrictionType:'FAKE',vehicleTypes:[]},{isAtoB:true}));
assert.throws(()=>a.normalizeDraft({direction:'FWD',scope:'segment',lane:'lane_none',restrictionType:'BLOCKED',vehicleTypes:['FAKE']},{isAtoB:true}));
assert.ok(src.includes('next.disabled=(step===1&&!SCOPES.includes(draft.scope))'),
  'User cannot progress from scope step until an explicit valid choice');
assert.ok(src.includes('if (step === 1 && !SCOPES.includes(draft.scope)) return;'),
  'Programmatic progression must enforce scope selection');
assert.ok(src.includes('warning.setAttribute("role","alert")'),
  'Missing selection must display an accessible warning');
assert.ok(src.includes('const draft={direction:availableDirections(current.segment).at(-1),scope:null,lane:"lane_none",restrictionType:"BLOCKED",vehicleTypes:[]};'),
  'The wizard must never preselect an arbitrary scope');
assert.ok(src.includes('if (step === 4 && draft.restrictionType !== "BLOCKED" && !selectedVehicleTypes(draft.vehicleTypes).length) return;'),
  'FREE and TOLL steps must require exception types');
assert.ok(src.includes('next.disabled=(step===1&&!SCOPES.includes(draft.scope))'),
  'Next button must still guard scope');
assert.ok(!/\b(updateSegment|savePreset|localStorage|GM_xmlhttpRequest|fetch)\s*\(/.test(src),'Read-only alpha must not write or export map data');
(async()=>{
 const mockPermits=[{id:'pass1',name:'Local Pass'},{id:'pass2',name:'Area Pass'}];
 let requestedCountryId=null;
 const countrySdk={DataModel:{Countries:{getById:async ({countryId})=>{
   requestedCountryId=countryId;
   return {restrictionSubscriptions:[...mockPermits,{id:'pass1',name:'Duplicate'},{name:'Invalid'}]};
 }}}};
 assert.deepEqual(await a.readPermits(countrySdk,{id:77,name:'Any Country'}),mockPermits);
 assert.equal(requestedCountryId,77);
 assert.equal(await a.readPermits(countrySdk,null),null);
 assert.equal(await a.readPermits({DataModel:{}},{id:77}),null);
 assert.deepEqual(await a.readPermits({DataModel:{Countries:{getById:async()=>({restrictionSubscriptions:[]})}}},{id:77}),[]);
 assert.equal(await a.readPermits({DataModel:{Countries:{getById:async()=>{throw Error('Unavailable')}}}},{id:77}),null);
 const segment={id:1,isAtoB:true,restrictions:[]};
 const sdk={Editing:{getSelection:async()=>({objectType:'segment',ids:[1]})},DataModel:{Segments:{getById:async()=>segment,getAddress:async()=>({country:{id:1,name:'Italy'}})}}};
 assert.equal((await a.readContext(sdk)).country.name,'Italy');
 assert.equal((await a.readContext(sdk)).permits,null);
 sdk.DataModel.Countries=countrySdk.DataModel.Countries;
 assert.deepEqual((await a.readContext(sdk)).permits,mockPermits);
 sdk.DataModel.Segments.getAddress=async()=>{throw Error('unknown')};
 assert.equal((await a.readContext(sdk)).country,null);
 sdk.Editing.getSelection=async()=>({objectType:'venue',ids:[1]});
 assert.equal(await a.readContext(sdk),null);
 sdk.Editing.getSelection=async()=>({objectType:'segment',ids:[1,2]});
 assert.equal(await a.readContext(sdk),null);
 console.log('PASS: guided alpha choices, country permits, advanced draft and read-only guards');
})().catch(e=>{console.error(e);process.exitCode=1;});
