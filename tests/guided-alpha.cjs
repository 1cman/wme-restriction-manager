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
assert.ok(src.includes('const conditions=normalizeAdvanced(advanced,current.permits);') &&
          src.includes('normalizeDraft(draft,current.segment,conditions);'),
  'Next handler must validate advanced conditions and whitelist before reaching summary');
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
assert.deepEqual(a.RESTRICTION_TYPES,['BLOCKED','ALLOWED','TOLL']);
assert.deepEqual(a.DEFAULT_TYPES,{BLOCKED:'BLOCKED',ALLOWED:'BLOCKED',TOLL:'TOLL'});
assert.ok(!a.RESTRICTION_TYPES.includes('FREE'),'Do not confuse wizard intents with SDK defaultType FREE');
assert.equal(a.VEHICLE_TYPES.length,15);
assert.equal(new Set(a.VEHICLE_TYPES).size,15);
assert.equal(a.OVERRIDE_TYPES.BLOCKED,'FREE');
assert.equal(a.OVERRIDE_TYPES.ALLOWED,'FREE');
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
  direction:'FWD',scope:'segment',lane:'lane_none',restrictionIntent:'BLOCKED',
  defaultType:'BLOCKED',overrideType:'FREE',vehicleTypes:[],verified:false
});
for (const restrictionType of a.RESTRICTION_TYPES) {
  const draft={direction:'FWD',scope:'segment',lane:'lane_none',restrictionType,vehicleTypes:['MOTORCYCLE','TRUCK']};
  const result=a.normalizeDraft(draft,{isAtoB:true});
  assert.equal(result.restrictionIntent,restrictionType);
  assert.equal(result.defaultType,a.DEFAULT_TYPES[restrictionType]);
  assert.equal(result.overrideType,a.OVERRIDE_TYPES[restrictionType]);
  assert.deepEqual(result.vehicleTypes,['MOTORCYCLE','TRUCK']);
  assert.equal(result.verified,false);
  assert.deepEqual(draft.vehicleTypes,['MOTORCYCLE','TRUCK'],'Input must not be modified');
}
for (const restrictionType of ['ALLOWED','TOLL']) {
  const expected=restrictionType==='ALLOWED'?/ALLOWED requires explicit authorization criteria/:/TOLL requires explicit vehicle exemption rules/;
  assert.throws(()=>a.normalizeDraft({direction:'FWD',scope:'segment',lane:'lane_none',restrictionType,vehicleTypes:[]},{isAtoB:true}),expected);
}
// White-list mode must NOT produce an SDK FREE default (which allows all vehicles).
const whitelist={direction:'FWD',scope:'segment',lane:'lane_none',restrictionType:'ALLOWED',vehicleTypes:['PRIVATE','EV']};
assert.deepEqual(a.normalizeDraft(whitelist,{isAtoB:true}),{
 direction:'FWD',scope:'segment',lane:'lane_none',restrictionIntent:'ALLOWED',
 defaultType:'BLOCKED',overrideType:'FREE',vehicleTypes:['EV','PRIVATE'],verified:false
});
const passOnly={...whitelist,vehicleTypes:[]};
assert.equal(a.hasAllowedCriteria(passOnly,{minPassengers:null,permitIds:['pass1']}),false);
assert.equal(a.hasAllowedCriteria(passOnly,{minPassengers:2,permitIds:[]}),false);
assert.equal(a.hasAllowedCriteria(passOnly,{minPassengers:null,permitIds:[]}),false);
assert.equal(a.hasAllowedCriteria(whitelist),true);
assert.throws(()=>a.normalizeDraft(passOnly,{isAtoB:true},{minPassengers:3,permitIds:[]}),
  /ALLOWED requires at least one authorized vehicle type/);
assert.throws(()=>a.normalizeDraft(passOnly,{isAtoB:true},{minPassengers:null,permitIds:['pass1']}),
  /ALLOWED requires at least one authorized vehicle type/);
assert.throws(()=>a.normalizeDraft(passOnly,{isAtoB:true},{minPassengers:null,permitIds:[]}),
  /ALLOWED requires at least one authorized vehicle type/);
assert.equal(a.normalizeDraft(whitelist,{isAtoB:true}).defaultType,'BLOCKED');
assert.throws(()=>a.normalizeDraft({...whitelist,restrictionType:'FREE'},{isAtoB:true}),/Invalid restriction intent/);
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
assert.ok(src.includes('(draft.restrictionType==="TOLL"||draft.restrictionType==="ALLOWED")'),
  'Both ALLOWED and TOLL steps must require at least one selected vehicle');
assert.ok(src.includes('if (step===4 && (draft.restrictionType==="TOLL"||draft.restrictionType==="ALLOWED")'),
  'Advance must enforce selection, not just disable the button');
assert.ok(src.includes('(step===4&&(draft.restrictionType==="TOLL"||draft.restrictionType==="ALLOWED")&&!draft.vehicleTypes.length)'),
  'Next button must be disabled when green whitelist has no vehicle');
assert.ok(src.includes('normalizeDraft(draft,current.segment,conditions);'),
  'Advanced draft must be validated before proceeding and in the summary');
assert.ok(src.includes('draft.restrictionType==="ALLOWED"&&!hasAllowedCriteria(draft)'),
  'ALLOWED requires vehicle types irrespective of passes and occupancy');
assert.ok(src.includes('advanced.minPassengers=null;') && src.includes('advanced.permitIds=[];'),
  'Changing restriction intent must clear stale advanced permissions');
assert.ok(src.includes('node("p",tr("others_blocked"))'),
  'Whitelist summary must clearly state the default prohibition');
// Sorting and typeahead must be locale aware, accent-insensitive, and non-mutating.
const rawPermits=[
  {id:'z',name:'ZTL Zeta'},
  {id:'a',name:'Àrea centrale'},
  {id:'b',name:'area nord'},
  {id:'c',name:'Èlite'},
  {id:'d',name:'Carpool 10'},
  {id:'e',name:'Carpool 2'}
];
assert.deepEqual(a.sortPermits(rawPermits,'it').map(p=>p.id),['a','b','e','d','c','z']);
assert.equal(rawPermits[0].id,'z','Sorting must not mutate SDK data');
assert.deepEqual(a.filterPermits(rawPermits,'AREA','it').map(p=>p.id),['a','b']);
assert.deepEqual(a.filterPermits(rawPermits,'elite','it').map(p=>p.id),['c']);
assert.deepEqual(a.filterPermits(rawPermits,'CARPOOL','it').map(p=>p.id),['e','d']);
assert.deepEqual(a.filterPermits(rawPermits,'no-match','it'),[]);
assert.deepEqual(a.filterPermits(rawPermits,'','it').map(p=>p.id),['a','b','e','d','c','z']);
assert.ok(src.includes('search.setAttribute("role","combobox")'),
  'Pass search must expose accessible autocomplete');
assert.ok(src.includes('search.addEventListener("input"'),
  'Pass autocomplete must refresh on each keystroke');
assert.ok(src.includes('search.addEventListener("keydown"'),
  'Pass autocomplete must support keyboard input');
assert.ok(src.includes('const sorted=sortPermits(current.permits,lang);'),
  'Visible pass list must be sorted by WME locale');
assert.ok(src.includes('advanced.permitIds=advanced.permitIds.includes(id)?'),
  'Autocomplete and checkboxes must share a persistent selection');
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
 console.log('PASS: guided alpha vehicle requirement, alphabetic permit autocomplete and read-only guards');
})().catch(e=>{console.error(e);process.exitCode=1;});
