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
const redBase={direction:'FWD',scope:'segment',lane:'lane_none',restrictionType:'BLOCKED'};
const redAll=a.normalizeDraft({...redBase,vehicleTypes:[]},{isAtoB:true});
assert.equal(redAll.defaultType,'BLOCKED');
assert.deepEqual(redAll.vehicleTypes,[]);
const redOnlyMotor=a.normalizeDraft({...redBase,vehicleTypes:['MOTORCYCLE']},{isAtoB:true});
assert.equal(redOnlyMotor.defaultType,'FREE');
assert.equal(redOnlyMotor.overrideType,'BLOCKED');
assert.deepEqual(redOnlyMotor.vehicleTypes,['MOTORCYCLE']);
const redTwo=a.normalizeDraft({...redBase,vehicleTypes:['MOTORCYCLE','PRIVATE']},{isAtoB:true});
assert.equal(redTwo.defaultType,'FREE');
assert.equal(redTwo.overrideType,'BLOCKED');
assert.deepEqual(redTwo.vehicleTypes,['MOTORCYCLE','PRIVATE']);
assert.ok(src.includes('tr("blocked_everyone")+" (SDK BLOCKED)"'), 'All forbidden summary must be explicit');
assert.ok(src.includes('tr("blocked_only_selected")'), 'Selective red prohibition must preserve other vehicle access');
assert.ok(src.includes('"FREE":DEFAULT_TYPES[draft.restrictionType]'), 'Selective red default must switch to FREE');
assert.ok(src.includes('"BLOCKED":OVERRIDE_TYPES[draft.restrictionType]'), 'Selective red vehicle rules must be BLOCKED');
assert.ok(src.includes('"BLOCKED"?"blocked_vehicle_step"'), 'Red vehicle question must refer to prohibited, not exempt types');
assert.ok(src.includes('motorDraft.conditions'), 'Motor conditions must be tracked separately');
assert.ok(src.includes('motor_select_fuel') && src.includes('motor_select_electric'), 'Native-style fuel/electric UI missing');
assert.ok(src.includes('motor_limit_cc') && src.includes('motor_limit_kw'), 'Native-style cc/kW thresholds missing');

for (const restrictionType of a.RESTRICTION_TYPES) {
  const draft={direction:'FWD',scope:'segment',lane:'lane_none',restrictionType,vehicleTypes:['MOTORCYCLE','TRUCK']};
  const result=a.normalizeDraft(draft,{isAtoB:true});
  assert.equal(result.restrictionIntent,restrictionType);
  assert.equal(result.defaultType,restrictionType==='BLOCKED'?'FREE':a.DEFAULT_TYPES[restrictionType]);
  assert.equal(result.overrideType,restrictionType==='BLOCKED'?'BLOCKED':a.OVERRIDE_TYPES[restrictionType]);
  assert.deepEqual(result.vehicleTypes,['MOTORCYCLE','TRUCK']);
  assert.equal(result.verified,false);
  assert.deepEqual(draft.vehicleTypes,['MOTORCYCLE','TRUCK'],'Input must not be modified');
}
for (const restrictionType of ['ALLOWED','TOLL']) {
  const expected=restrictionType==='ALLOWED'?/ALLOWED requires at least one authorized vehicle type/:/TOLL requires explicit vehicle exemption rules/;
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
// Alpha 9: conditions are attached to INDIVIDUAL authorized vehicle types.
const selectedVehicles=['PRIVATE','MOTORCYCLE','EV','HYBRID'];
const vehicleRules={
  PRIVATE:{requiresPass:true,requiresOccupancy:false,permitIds:['zone'],minPassengers:null},
  MOTORCYCLE:{requiresPass:true,requiresOccupancy:false,permitIds:['zone'],minPassengers:null},
  EV:{requiresPass:false,requiresOccupancy:false,permitIds:[],minPassengers:null},
  HYBRID:{requiresPass:false,requiresOccupancy:false,permitIds:[],minPassengers:null}
};
const knownPermits=[{id:'zone',name:'ZTL zone'}];
const mixed=a.normalizeVehicleRules(selectedVehicles,vehicleRules,knownPermits);
assert.equal(mixed.verified,false);
assert.deepEqual(mixed.vehicles.map(v=>[v.vehicleType,v.access]),[
  ['EV','DIRECT'],['HYBRID','DIRECT'],['MOTORCYCLE','CONDITIONAL'],['PRIVATE','CONDITIONAL']
]);
for(const direct of ['EV','HYBRID']){
  const row=mixed.vehicles.find(v=>v.vehicleType===direct);
  assert.deepEqual(row.permitIds,[]);
  assert.equal(row.minPassengers,null);
}
for(const conditional of ['MOTORCYCLE','PRIVATE']){
  const row=mixed.vehicles.find(v=>v.vehicleType===conditional);
  assert.deepEqual(row.permitIds,['zone']);
  assert.equal(row.minPassengers,null);
}
assert.deepEqual(vehicleRules.PRIVATE.permitIds,['zone'],'Validation must not mutate source');
assert.equal(a.normalizeDraft({...whitelist,vehicleTypes:selectedVehicles},{isAtoB:true}).defaultType,'BLOCKED');
assert.deepEqual(a.normalizeVehicleRules(['EV'],{},null).vehicles[0],{
  vehicleType:'EV',access:'DIRECT',requiresPass:false,
  requiresOccupancy:false,permitIds:[],minPassengers:null
});
const minOnly={PRIVATE:{requiresPass:false,requiresOccupancy:true,permitIds:[],minPassengers:3}};
assert.equal(a.normalizeVehicleRules(['PRIVATE','EV'],minOnly,null).vehicles[0].access,'DIRECT');
assert.equal(a.normalizeVehicleRules(['PRIVATE','EV'],minOnly,null).vehicles[1].minPassengers,3);
const both={PRIVATE:{requiresPass:true,requiresOccupancy:true,permitIds:['zone'],minPassengers:2}};
assert.equal(a.normalizeVehicleRules(['PRIVATE'],both,knownPermits).vehicles[0].access,'CONDITIONAL');
assert.throws(()=>a.normalizeVehicleRules([],{},knownPermits),/No authorized vehicle/);
assert.throws(()=>a.normalizeVehicleRules(['EV'],{PRIVATE:vehicleRules.PRIVATE},knownPermits),/unselected vehicle/);
assert.throws(()=>a.normalizeVehicleRules(['PRIVATE'],{PRIVATE:{
  requiresPass:true,requiresOccupancy:false,permitIds:[],minPassengers:null
}},knownPermits),/Missing vehicle permit/);
assert.throws(()=>a.normalizeVehicleRules(['PRIVATE'],{PRIVATE:{
  requiresPass:true,requiresOccupancy:false,permitIds:['not-listed'],minPassengers:null
}},knownPermits),/Unrecognized vehicle permit/);
assert.throws(()=>a.normalizeVehicleRules(['PRIVATE'],{PRIVATE:{
  requiresPass:true,requiresOccupancy:false,permitIds:['zone'],minPassengers:null
}},null),/Unrecognized vehicle permit/);
assert.throws(()=>a.normalizeVehicleRules(['PRIVATE'],{PRIVATE:{
  requiresPass:false,requiresOccupancy:true,permitIds:[],minPassengers:null
}},knownPermits),/Invalid vehicle occupancy/);
assert.throws(()=>a.normalizeVehicleRules(['PRIVATE'],{PRIVATE:{
  requiresPass:false,requiresOccupancy:true,permitIds:[],minPassengers:1
}},knownPermits),/Invalid vehicle occupancy/);
assert.throws(()=>a.normalizeVehicleRules(['PRIVATE'],{PRIVATE:{
  requiresPass:false,requiresOccupancy:false,permitIds:['zone'],minPassengers:null
}},knownPermits),/Inactive permit/);
assert.throws(()=>a.normalizeVehicleRules(['PRIVATE'],{PRIVATE:{
  requiresPass:false,requiresOccupancy:false,permitIds:[],minPassengers:3
}},knownPermits),/Inactive occupancy/);
assert.ok(src.includes('if(input.checked)vehicleRules[type]=emptyRule();') &&
  src.includes('else delete vehicleRules[type];'),'Deselection must remove the vehicle conditions');
assert.ok(src.includes('if(draft.restrictionType==="ALLOWED")') &&
  src.includes('normalizeVehicleRules(draft.vehicleTypes,vehicleRules,current.permits)'),
  'Whitelist next-step validation must use per-vehicle rules');
assert.ok(src.includes('vehiclePermitPicker(type,rule)') &&
  src.includes('search.setAttribute("role","combobox")'),
  'Vehicles requiring permits must retain searchable autocomplete');
assert.ok(src.includes('const conditions=normalizeVehicleRules(') &&
  src.includes('node("h4",tr("vehicle_rules_summary"))'),
  'Summary must distinguish vehicle-by-vehicle rules');
assert.ok(src.includes('if(rule.access==="DIRECT")box.append(node("p",tr("direct_access")))'),
  'Summary must clearly label direct access');
assert.ok(src.includes('(step===5&&!isAdvancedValid())'),
  'Next button must be blocked on invalid per-vehicle requirements');
// Alpha 10 red flow: skip permits/occupancy entirely, except optional motorcycle engine.
for(const types of [[],['PRIVATE'],['TRUCK']]){
 assert.equal(a.nextWizardStep(4,'BLOCKED',types),7);
 assert.equal(a.previousWizardStep(7,'BLOCKED',types),4);
}
assert.equal(a.nextWizardStep(4,'BLOCKED',['MOTORCYCLE']),5);
assert.equal(a.nextWizardStep(4,'BLOCKED',['PRIVATE','MOTORCYCLE']),5);
assert.equal(a.nextWizardStep(5,'BLOCKED',['MOTORCYCLE']),7);
assert.equal(a.nextWizardStep(7,'BLOCKED',['MOTORCYCLE']),6);
assert.equal(a.previousWizardStep(6,'BLOCKED',['MOTORCYCLE']),7);
assert.equal(a.previousWizardStep(7,'BLOCKED',['MOTORCYCLE']),5);
assert.equal(a.previousWizardStep(5,'BLOCKED',['MOTORCYCLE']),4);
for(const intent of ['ALLOWED','TOLL']){
 assert.equal(a.nextWizardStep(4,intent,['MOTORCYCLE']),5);
 assert.equal(a.nextWizardStep(5,intent,['MOTORCYCLE']),6);
 assert.equal(a.previousWizardStep(6,intent,['MOTORCYCLE']),5);
}
const redSchedule={
 startDate:'2026-12-01',endDate:'2027-01-15',
 weekdays:['MONDAY','FRIDAY'],allDay:false,
 slots:[{fromTime:'07:00',toTime:'09:00'},{fromTime:'17:30',toTime:'19:00'}]
};
assert.deepEqual(a.normalizeRedSchedule(redSchedule),{
 timeFrames:[{startDate:'2026-12-01',endDate:'2027-01-15',
   weekdays:['MONDAY','FRIDAY'],fromTime:'07:00',toTime:'09:00',
   timeZone:null,verified:false},
  {startDate:'2026-12-01',endDate:'2027-01-15',
   weekdays:['MONDAY','FRIDAY'],fromTime:'17:30',toTime:'19:00',
   timeZone:null,verified:false}],
 verified:false
});
assert.equal(a.normalizeRedSchedule({...redSchedule,allDay:true}).timeFrames.length,1);
assert.equal(a.normalizeRedSchedule({
 ...redSchedule,startDate:'',endDate:''
}).timeFrames[0].startDate,null);
assert.equal(redSchedule.slots[0].fromTime,'07:00','Validation must not mutate calendar input');
for(const date of ['2026-02-30','2026-13-01','not-date']){
 assert.throws(()=>a.normalizeRedSchedule({...redSchedule,startDate:date}),/Invalid dates/);
}
assert.throws(()=>a.normalizeRedSchedule({...redSchedule,
 endDate:'2026-11-30'}),/Invalid dates/);
assert.throws(()=>a.normalizeRedSchedule({...redSchedule,weekdays:[]}),/Invalid weekdays/);
assert.throws(()=>a.normalizeRedSchedule({...redSchedule,
 weekdays:['MONDAY','MONDAY']}),/Invalid weekdays/);
assert.throws(()=>a.normalizeRedSchedule({...redSchedule,
 slots:[{fromTime:'22:00',toTime:'06:00'}]}),/Invalid time range/);
assert.throws(()=>a.normalizeRedSchedule({...redSchedule,
 slots:[{fromTime:'09:00',toTime:'09:00'}]}),/Invalid time range/);
assert.throws(()=>a.normalizeRedSchedule({...redSchedule,
 slots:Array(13).fill({fromTime:'09:00',toTime:'10:00'})}),/SAFE12/);
assert.throws(()=>a.normalizeRedSchedule({...redSchedule,
 allDay:false,slots:[]}),/SAFE12/);
assert.deepEqual(a.normalizeMotorDraft({enabled:false,conditions:[]},true),
 {mode:'ALL_MOTORCYCLES',conditions:[],verified:false});
assert.deepEqual(a.normalizeMotorDraft({enabled:true,conditions:[
 {engineType:'FUEL',operator:'LT',capacityThreshold:125},
 {engineType:'ELECTRIC',operator:'LTE',capacityThreshold:11.5}
]},true),{
 mode:'MATCHING_ENGINES',
 conditions:[{engineType:'FUEL',operator:'LT',capacityThreshold:125},
             {engineType:'ELECTRIC',operator:'LTE',capacityThreshold:11.5}],
 verified:false
});
assert.deepEqual(a.normalizeMotorDraft({enabled:true,conditions:[
 {engineType:'FUEL',operator:'ALL',capacityThreshold:null}
]},true).conditions[0],{
 engineType:'FUEL',operator:'ALL',capacityThreshold:null
});
assert.throws(()=>a.normalizeMotorDraft({enabled:true,conditions:[]},true),
 /Select at least one motorcycle engine/);
assert.throws(()=>a.normalizeMotorDraft({enabled:true,conditions:[
 {engineType:'ELECTRIC',operator:'LT',capacityThreshold:null}
]},true),/Invalid motorcycle engine threshold/);
assert.throws(()=>a.normalizeMotorDraft({enabled:true,conditions:[
 {engineType:'FUEL',operator:'LTE',capacityThreshold:1.3}
]},true),/Invalid motorcycle engine threshold/);
assert.throws(()=>a.normalizeMotorDraft({enabled:true,conditions:[
 {engineType:'FUEL',operator:'ALL',capacityThreshold:125}
]},true),/ALL engine condition cannot have threshold/);
assert.throws(()=>a.normalizeMotorDraft({enabled:true,conditions:[
 {engineType:'FUEL',operator:'ALL',capacityThreshold:null},
 {engineType:'FUEL',operator:'LT',capacityThreshold:125}
]},true),/Invalid motorcycle engine condition/);
assert.throws(()=>a.normalizeMotorDraft({enabled:true,conditions:[
 {engineType:'FAKE',operator:'ALL',capacityThreshold:null}
]},true),/Invalid motorcycle engine condition/);
assert.throws(()=>a.normalizeMotorDraft({enabled:true,conditions:[
 {engineType:'FUEL',operator:'FAKE',capacityThreshold:null}
]},true),/Invalid motorcycle engine condition/);
assert.throws(()=>a.normalizeMotorDraft({enabled:true,conditions:[
 {engineType:'FUEL',operator:'ALL',capacityThreshold:null}
]},false),/Motorcycle type not selected/);
const sampleRaw={W:{model:{segments:{getObjectById:()=>({
 attributes:{restrictions:[{getDriveProfileList:()=>({
  getDriveProfiles:()=>[{getEngineCapacities:()=>[
    {attributes:{vehicleType:'MOTORCYCLE',engineType:'NATIVE-X'}},
    {attributes:{vehicleType:'PRIVATE',engineType:'NOT-MOTOR'}}
  ]}]
 })}]}
})}}}};
assert.deepEqual(a.observedMotorTypes(sampleRaw,1),['NATIVE-X']);
assert.deepEqual(a.observedMotorTypes({},1),[]);
assert.ok(src.includes('if(step===7&&draft.restrictionType==="BLOCKED")'),
 'Date and time screen must be red-only');
assert.ok(src.includes('const destination=nextWizardStep(step,draft.restrictionType,draft.vehicleTypes);'),
 'Next navigation must use intent-aware flow');
assert.ok(src.includes('const previous=previousWizardStep(step,draft.restrictionType,draft.vehicleTypes);'),
 'Back navigation must mirror the correct flow');
assert.ok(src.includes('(step===7&&!isScheduleValid())'),
 'Invalid red schedule must block Next');
assert.ok(src.includes('normalizeMotorDraft(motorDraft,draft.vehicleTypes.includes("MOTORCYCLE"));'),
 'Optional motor guard must be checked before advancing');
assert.ok(src.includes('if(draft.restrictionType==="BLOCKED"){') &&
 src.includes('node("h3",tr("motorcycle_step"))'),
 'Red motorcycle path must not show permit/occupancy controls');
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
