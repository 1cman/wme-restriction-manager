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
assert.ok(src.includes('normalizeVehicleRules(draft.vehicleTypes,vehicleRules,current.permits);') &&
          src.includes('normalizeDraft(draft,current.segment);'),
  'Next handler must validate per-vehicle advanced conditions before reaching summary');
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
assert.deepEqual(a.VEHICLE_TYPES,['PRIVATE','EV','MOTORCYCLE','TAXI']);
assert.equal(new Set(a.VEHICLE_TYPES).size,4);
const excludedSdkTypes=[
 'BUS','CAV','CLEAN_FUEL','HAZARDOUS_MATERIALS','HOV_2','HOV_3',
 'HYBRID','PUBLIC_TRANSPORTATION','RV','TOWING_VEHICLE','TRUCK'
];
for(const excluded of excludedSdkTypes){
 assert.throws(()=>a.selectedVehicleTypes([excluded]),/Invalid vehicle selection/);
 for(const restrictionType of a.RESTRICTION_TYPES){
  assert.throws(()=>a.normalizeDraft({
   direction:'FWD',scope:'segment',lane:'lane_none',
   restrictionType,vehicleTypes:[excluded]
  },{isAtoB:true}),/Invalid vehicle selection/);
 }
 assert.throws(()=>a.normalizeVehicleRules([excluded],{},null),/Invalid vehicle selection/);
}
assert.deepEqual(a.selectedVehicleTypes(['TAXI','PRIVATE','EV','MOTORCYCLE']),
 ['PRIVATE','EV','MOTORCYCLE','TAXI']);
assert.equal(a.OVERRIDE_TYPES.BLOCKED,'FREE');
assert.equal(a.OVERRIDE_TYPES.ALLOWED,'FREE');
assert.equal(a.OVERRIDE_TYPES.TOLL,'FREE');
assert.deepEqual(a.selectedVehicleTypes(['TAXI','PRIVATE','TAXI']),['PRIVATE','TAXI']);
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
assert.deepEqual(redTwo.vehicleTypes,['PRIVATE','MOTORCYCLE']);
assert.ok(src.includes('tr("blocked_everyone")+" (SDK BLOCKED)"'), 'All forbidden summary must be explicit');
assert.ok(src.includes('tr("blocked_only_selected")'), 'Selective red prohibition must preserve other vehicle access');
assert.ok(src.includes('"FREE":DEFAULT_TYPES[draft.restrictionType]'), 'Selective red default must switch to FREE');
assert.ok(src.includes('"BLOCKED":OVERRIDE_TYPES[draft.restrictionType]'), 'Selective red vehicle rules must be BLOCKED');
assert.ok(src.includes('"BLOCKED"?"blocked_vehicle_step"'), 'Red vehicle question must refer to prohibited, not exempt types');
assert.ok(src.includes('motorDraft.conditions'), 'Motor conditions must be tracked separately');
assert.ok(src.includes('motor_select_fuel') && src.includes('motor_select_electric'), 'Native-style fuel/electric UI missing');
assert.ok(src.includes('motor_limit_cc') && src.includes('motor_limit_kw'), 'Native-style cc/kW thresholds missing');

for (const restrictionType of a.RESTRICTION_TYPES) {
  const draft={direction:'FWD',scope:'segment',lane:'lane_none',restrictionType,vehicleTypes:['MOTORCYCLE','TAXI']};
  const result=a.normalizeDraft(draft,{isAtoB:true});
  assert.equal(result.restrictionIntent,restrictionType);
  assert.equal(result.defaultType,restrictionType==='BLOCKED'?'FREE':a.DEFAULT_TYPES[restrictionType]);
  assert.equal(result.overrideType,restrictionType==='BLOCKED'?'BLOCKED':a.OVERRIDE_TYPES[restrictionType]);
  assert.deepEqual(result.vehicleTypes,['MOTORCYCLE','TAXI']);
  assert.equal(result.verified,false);
  assert.deepEqual(draft.vehicleTypes,['MOTORCYCLE','TAXI'],'Input must not be modified');
}
for (const restrictionType of ['ALLOWED','TOLL']) {
  const expected=restrictionType==='ALLOWED'?/ALLOWED requires at least one authorized vehicle type/:/TOLL requires explicit vehicle exemption rules/;
  assert.throws(()=>a.normalizeDraft({direction:'FWD',scope:'segment',lane:'lane_none',restrictionType,vehicleTypes:[]},{isAtoB:true}),expected);
}
// White-list mode must NOT produce an SDK FREE default (which allows all vehicles).
const whitelist={direction:'FWD',scope:'segment',lane:'lane_none',restrictionType:'ALLOWED',vehicleTypes:['PRIVATE','EV']};
assert.deepEqual(a.normalizeDraft(whitelist,{isAtoB:true}),{
 direction:'FWD',scope:'segment',lane:'lane_none',restrictionIntent:'ALLOWED',
 defaultType:'BLOCKED',overrideType:'FREE',vehicleTypes:['PRIVATE','EV'],verified:false
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
assert.ok(src.includes('normalizeDraft(draft,current.segment);') &&
          src.includes('normalizeVehicleRules(draft.vehicleTypes,vehicleRules,current.permits);'),
  'Advanced vehicle draft must be validated before proceeding and in the summary');
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
// Alpha 15: only the four editor-requested categories are valid in a new draft.
assert.ok(src.includes('const VEHICLE_TYPES = Object.freeze(["PRIVATE", "EV", "MOTORCYCLE", "TAXI"]);'));
assert.ok(src.includes('for (const type of VEHICLE_TYPES)'),
 'The wizard must render exclusively the validated shortlist');
assert.ok(src.includes('selectedVehicleTypes(draft.vehicleTypes)'),
 'Next validation must reject types outside the shortlist');
assert.ok(!src.includes('for (const type of ["BUS"'),
 'The wizard must not hardcode previously exposed SDK categories');
// Alpha 9: conditions are attached to INDIVIDUAL authorized vehicle types.
const selectedVehicles=['PRIVATE','MOTORCYCLE','EV','TAXI'];
const vehicleRules={
  PRIVATE:{requiresPass:true,requiresOccupancy:false,permitIds:['zone'],minPassengers:null},
  MOTORCYCLE:{requiresPass:true,requiresOccupancy:false,permitIds:['zone'],minPassengers:null},
  EV:{requiresPass:false,requiresOccupancy:false,permitIds:[],minPassengers:null},
  TAXI:{requiresPass:false,requiresOccupancy:false,permitIds:[],minPassengers:null}
};
const knownPermits=[{id:'zone',name:'ZTL zone'}];
const mixed=a.normalizeVehicleRules(selectedVehicles,vehicleRules,knownPermits);
assert.equal(mixed.verified,false);
assert.deepEqual(mixed.vehicles.map(v=>[v.vehicleType,v.access]),[
  ['PRIVATE','CONDITIONAL'],['EV','DIRECT'],['MOTORCYCLE','CONDITIONAL'],['TAXI','DIRECT']
]);
for(const direct of ['EV','TAXI']){
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
assert.equal(a.normalizeVehicleRules(['PRIVATE','EV'],minOnly,null).vehicles.find(v=>v.vehicleType==='EV').access,'DIRECT');
assert.equal(a.normalizeVehicleRules(['PRIVATE','EV'],minOnly,null).vehicles.find(v=>v.vehicleType==='PRIVATE').minPassengers,3);
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
for(const types of [[],['PRIVATE'],['TAXI']]){
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
assert.equal(a.nextWizardStep(4,'ALLOWED',['MOTORCYCLE']),5);
assert.equal(a.nextWizardStep(5,'ALLOWED',['MOTORCYCLE']),7);
assert.equal(a.nextWizardStep(7,'ALLOWED',['MOTORCYCLE']),6);
assert.equal(a.previousWizardStep(6,'ALLOWED',['MOTORCYCLE']),7);
assert.equal(a.previousWizardStep(7,'ALLOWED',['MOTORCYCLE']),5);
// The blue exemption skips advanced pass/occupancy/plate conditions entirely.
for(const types of [['PRIVATE'],['PRIVATE','TAXI'],['MOTORCYCLE','EV']]){
 assert.equal(a.nextWizardStep(4,'TOLL',types),7);
 assert.equal(a.nextWizardStep(7,'TOLL',types),6);
 assert.equal(a.previousWizardStep(6,'TOLL',types),7);
 assert.equal(a.previousWizardStep(7,'TOLL',types),4);
}
const tollDraft=a.normalizeDraft({
 direction:'FWD',scope:'segment',lane:'lane_none',
 restrictionType:'TOLL',vehicleTypes:['PRIVATE','TAXI']
},{isAtoB:true});
assert.equal(tollDraft.defaultType,'TOLL');
assert.equal(tollDraft.overrideType,'FREE');
assert.deepEqual(tollDraft.vehicleTypes,['PRIVATE','TAXI']);
assert.deepEqual(a.normalizeTollActivationDraft(tollDraft,[101]),{
 segmentIds:[101],hasToll:true,directions:'BOTH',
 required:true,applied:false,verified:false
});
const multiToll=a.normalizeTollActivationDraft(tollDraft,[101,202]);
assert.deepEqual(multiToll.segmentIds,[101,202]);
assert.throws(()=>a.normalizeTollActivationDraft(
 {...tollDraft,restrictionIntent:'BLOCKED'},[101]),/Toll intent required/);
for(const bad of [[],[0],[-3],['101'],[1,1],[1.5]]){
 assert.throws(()=>a.normalizeTollActivationDraft(tollDraft,bad),/Invalid toll target segments/);
}
assert.ok(src.includes('if(step===4&&intent==="TOLL")return 7;'),
 'Toll must bypass advanced pass and occupancy screens');
assert.ok(src.includes('if(step===7&&intent==="TOLL")return 4;'),
 'Toll back navigation goes directly to selected vehicle types');
assert.ok(src.includes('normalizeTollActivationDraft(checked,[current.segment.id])'),
 'The automatic toll flag draft must target the selected segment');
assert.ok(src.includes('node("h4",tr("toll_auto_flag"))'),
 'Toll summary must preview the automatic flag');
assert.ok(src.includes('const scheduleTitle=draft.restrictionType==="ALLOWED"?"green_schedule"') &&
 src.includes('draft.restrictionType==="TOLL"?"toll_schedule":"red_schedule"'),
 'Scheduling must display green, blue or red localized headings');
assert.ok(!/\bupdateSegment\s*\(/.test(src),
 'No segment write is allowed in the read-only Alpha');
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
const overnightDraft={
 startDate:'2026-12-06',endDate:'2026-12-06',weekdays:['SUNDAY'],allDay:false,
 slots:[{fromTime:'22:00',toTime:'06:00'}]
};
const overnightFrames=a.normalizeRedSchedule(overnightDraft).timeFrames;
assert.deepEqual(overnightFrames,[{
 startDate:'2026-12-06',endDate:'2026-12-06',weekdays:['SUNDAY'],
 fromTime:'22:00',toTime:'06:00',timeZone:null,verified:false
}],'A night range keeps its start weekday and date in one read-only frame');
assert.equal(a.normalizeRedSchedule({...overnightDraft,slots:[{fromTime:'22:00',toTime:'00:00'}]})
 .timeFrames[0].toTime,'00:00');
assert.equal(a.normalizeRedSchedule({...overnightDraft,slots:[
 ...overnightDraft.slots,{fromTime:'08:00',toTime:'09:00'}
]}).timeFrames.length,2);
const nightBudget=a.estimateSafe12Budget([],overnightFrames);
assert.equal(nightBudget.projectedRestrictions,1);
assert.equal(nightBudget.projectedFrames,1);
assert.equal(a.normalizeRedSchedule({...overnightDraft,slots:Array(12).fill(overnightDraft.slots[0])})
 .timeFrames.length,12);
for(const slot of [null,{}, {fromTime:'24:00',toTime:'06:00'},
 {fromTime:'22:00',toTime:'06:60'}, {fromTime:'22:00',toTime:['06:00']}]){
 assert.throws(()=>a.normalizeRedSchedule({...overnightDraft,slots:[slot]}),/Invalid time range/);
}
assert.throws(()=>a.normalizeRedSchedule({...overnightDraft,slots:Array(1)}),/Invalid time range/);
assert.throws(()=>a.normalizeRedSchedule({...redSchedule,
 slots:[{fromTime:'09:00',toTime:'09:00'}]}),/Invalid time range/);
assert.throws(()=>a.normalizeRedSchedule({...redSchedule,
 slots:Array(13).fill(overnightDraft.slots[0])}),/SAFE12/);
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
assert.equal(a.countInternalEngineConditions(sampleRaw,1),2);
const rawSegmentWith=restrictions=>({W:{model:{segments:{
 getObjectById:()=>({attributes:{restrictions}})
}}}});
const profileWith=conditions=>({getDriveProfileList:group=>{
 assert.equal(group,'BLOCKED');
 return {getDriveProfiles:()=>[{getEngineCapacities:()=>conditions}]};
}});
assert.equal(a.countInternalEngineConditions(rawSegmentWith([
 profileWith([{attributes:{engineType:'PRIVATE-MOTOR-VALUE'}}]),profileWith([{}])
]),1),2,'Only the segment-wide count is returned');
assert.equal(a.countInternalEngineConditions(rawSegmentWith([profileWith([])]),1),0);
for(const page of [{},rawSegmentWith([{}]),rawSegmentWith([profileWith(Array(2))]),
 rawSegmentWith([profileWith(null)]),rawSegmentWith([{getDriveProfileList(){throw Error('Unavailable');}}])]){
 assert.equal(a.countInternalEngineConditions(page,1),null,'Unavailable data must not look like zero conditions');
}
const sdkEngineRow={direction:'FWD',defaultType:'FREE',laneScope:'WHOLE_SEGMENT',laneType:null};
const fuelRule=Object.freeze({vehicleType:'MOTORCYCLE',engineType:'PRIVATE_FUEL_VALUE',
 operator:'PRIVATE_OPERATOR',capacityThreshold:110});
const electricRule=Object.freeze({...fuelRule,engineType:'PRIVATE_ELECTRIC_VALUE',capacityThreshold:5});
const nativeEngineRow=(identity,direct,stored)=>({
 getDriveProfileList:group=>{
  assert.equal(group,'BLOCKED');
  return {getDriveProfiles:()=>direct.map(conditions=>({
   getEngineCapacities:()=>Object.freeze(conditions.map(attributes=>({attributes})))
  }))};
 },
 toJSON:()=>({...identity,driveProfiles:{BLOCKED:stored.map(engineCapacities=>({engineCapacities}))}})
});
const engineSegment={id:1,restrictions:[sdkEngineRow]};
const sameEngines=nativeEngineRow(sdkEngineRow,[[fuelRule,electricRule]],
 [[electricRule,{...fuelRule,capacityThreshold:'110'}]]);
const matched=a.inspectInternalEnginePreservation(rawSegmentWith([sameEngines]),engineSegment);
assert.deepEqual(matched,{count:2,rows:[{index:1,count:2,status:'MATCH'}],internalRows:[]});
assert.doesNotMatch(JSON.stringify(matched),/PRIVATE_|capacityThreshold|110/);
const compareNativeLane=(privateFields,publicFields={})=>a.inspectInternalEnginePreservation(rawSegmentWith([
 nativeEngineRow({direction:'FWD',defaultType:'FREE',...privateFields},[[fuelRule,electricRule]],
  [[electricRule,fuelRule]])
]),{id:1,restrictions:[{...sdkEngineRow,...publicFields}]});
for(const [disposition,laneScope] of ['NONE','WHOLE_SEGMENT','LEFT_LANE','MIDDLE_LANE','RIGHT_LANE'].entries()){
 assert.deepEqual(compareNativeLane({disposition,laneType:null},{laneScope}),matched);
}
for(const [index,laneType] of ['HOV','HOT','EXPRESS','BUS','FAST'].entries()){
 assert.deepEqual(compareNativeLane({disposition:2,laneType:index+1},{laneScope:'LEFT_LANE',laneType}),matched);
}
assert.deepEqual(compareNativeLane({laneScope:'WHOLE_SEGMENT',disposition:1}),matched,
 'A decoded legacy field may agree with the current field');
for(const [privateFields,fields] of [
 [{disposition:0},['laneScope']],
 [{disposition:99},['laneScope']],
 [{disposition:'1'},['laneScope']],
 [{laneScope:'WHOLE_SEGMENT',disposition:4},['laneScope']],
 [{disposition:1,laneType:0},['laneType']],
 [{disposition:1,laneType:99},['laneType']]
]){
 const report=compareNativeLane(privateFields);
 assert.equal(report.rows[0].status,'UNPAIRED');
 assert.deepEqual(report.rows[0].fields,fields);
 assert.deepEqual(report.internalRows,matched.rows);
}
assert.equal(compareNativeLane({disposition:1},{laneScope:1}).rows[0].status,'UNPAIRED',
 'The private bridge must not change the public SDK contract');
for(const [direct,stored] of [
 [[[fuelRule,electricRule]],[[fuelRule]]],
 [[[fuelRule]],[[{...fuelRule,capacityThreshold:120}]]],
 [[[fuelRule],[electricRule]],[[electricRule],[fuelRule]]],
 [[[fuelRule],[electricRule]],[[fuelRule,electricRule]]]
]){
 const report=a.inspectInternalEnginePreservation(rawSegmentWith([
  nativeEngineRow(sdkEngineRow,direct,stored)
 ]),engineSegment);
 assert.equal(report.rows[0].status,'DIFFERENT');
}
const badStored=nativeEngineRow(sdkEngineRow,[[fuelRule]],[[{...fuelRule,capacityThreshold:'UNKNOWN'}]]);
assert.deepEqual(a.inspectInternalEnginePreservation(rawSegmentWith([badStored]),engineSegment),
 {count:1,rows:[{index:1,count:1,status:'UNAVAILABLE'}],internalRows:[]});
const unpairedEngine=(index,reason,fields=[])=>({index,count:null,status:'UNPAIRED',reason,fields});
const internalMatch={index:1,count:2,status:'MATCH'};
const unknownJson={...sameEngines,toJSON(){throw Error('PRIVATE_JSON_ERROR');}};
assert.deepEqual(a.inspectInternalEnginePreservation(rawSegmentWith([unknownJson]),engineSegment),
 {count:2,rows:[unpairedEngine(1,'native_engine_pair_json')],
  internalRows:[{index:1,count:2,status:'UNAVAILABLE'}]});
assert.deepEqual(a.inspectInternalEnginePreservation(rawSegmentWith([sameEngines,sameEngines]),engineSegment),
 {count:4,rows:[unpairedEngine(1,'native_engine_pair_count')],
  internalRows:[internalMatch,{...internalMatch,index:2}]});
assert.deepEqual(a.inspectInternalEnginePreservation({},engineSegment),
 {count:null,rows:[unpairedEngine(1,'native_engine_pair_model')],internalRows:[]});
const missingDirection=nativeEngineRow({},[[fuelRule,electricRule]],[[electricRule,fuelRule]]);
assert.deepEqual(a.inspectInternalEnginePreservation(rawSegmentWith([missingDirection]),engineSegment),
 {count:2,rows:[unpairedEngine(1,'native_engine_pair_direction_missing')],internalRows:[internalMatch]},
 'The internal comparison remains available without an SDK association');
const opaqueDirection=nativeEngineRow({direction:99},[[fuelRule,electricRule]],[[electricRule,fuelRule]]);
assert.deepEqual(a.inspectInternalEnginePreservation(rawSegmentWith([opaqueDirection]),engineSegment),
 {count:2,rows:[unpairedEngine(1,'native_engine_pair_direction')],internalRows:[internalMatch]});
const sensitiveScope=nativeEngineRow({...sdkEngineRow,laneScope:'PRIVATE_SCOPE'},
 [[fuelRule,electricRule]],[[fuelRule]]);
const scopeMismatch=a.inspectInternalEnginePreservation(rawSegmentWith([sensitiveScope]),engineSegment);
assert.deepEqual(scopeMismatch,{count:2,rows:[unpairedEngine(1,'native_engine_pair_fields',['laneScope'])],
 internalRows:[{index:1,count:2,status:'DIFFERENT'}]});
assert.doesNotMatch(JSON.stringify(scopeMismatch),/PRIVATE_|capacityThreshold/);
const reverseEngineRow={...sdkEngineRow,direction:'REV'};
assert.deepEqual(a.inspectInternalEnginePreservation(rawSegmentWith([sameEngines]),{
 ...engineSegment,restrictions:[reverseEngineRow]
}),{count:2,rows:[unpairedEngine(1,'native_engine_pair_fields',['direction'])],internalRows:[internalMatch]});
const secondNativeEngineRow=nativeEngineRow(reverseEngineRow,[[fuelRule]],[[fuelRule]]);
assert.deepEqual(a.inspectInternalEnginePreservation(rawSegmentWith([secondNativeEngineRow,sameEngines]),{
 ...engineSegment,restrictions:[sdkEngineRow,reverseEngineRow]
}),{count:3,rows:[{index:1,count:2,status:'MATCH'},{index:2,count:1,status:'MATCH'}],internalRows:[]},
 'Association uses SDK-visible evidence, independent of internal list order');
assert.deepEqual(a.inspectInternalEnginePreservation(rawSegmentWith([sameEngines,sameEngines]),{
 ...engineSegment,restrictions:[sdkEngineRow,{...sdkEngineRow}]
}),{count:4,rows:[unpairedEngine(1,'native_engine_pair_ambiguous'),unpairedEngine(2,'native_engine_pair_ambiguous')],
 internalRows:[internalMatch,{...internalMatch,index:2}]},
 'Equal row counts and same direction do not resolve ambiguous association');

const sdkCalendar=Object.freeze({startDate:'2026-11-25',endDate:'2026-12-25',
 fromTime:'22:00',toTime:'06:00',repeatYearly:false,dayAlternation:'EVEN_DAYS',
 weekdays:Object.freeze(['SUNDAY','MONDAY']),timeZone:'Europe/Rome'});
const nativeCalendar=Object.freeze({startDate:sdkCalendar.startDate,endDate:sdkCalendar.endDate,
 fromTime:sdkCalendar.fromTime,toTime:sdkCalendar.toTime,repeatYearly:false,
 daysOfMonth:715827882,weekdays:65,timeZone:sdkCalendar.timeZone});
const nativeCalendarRow=timeFrames=>({toJSON:()=>({direction:'FWD',defaultType:'FREE',
 disposition:1,timeFrames})});
const compareCalendar=(sdkFrames,internalFrames)=>a.inspectInternalCalendarPreservation(
 rawSegmentWith([nativeCalendarRow(internalFrames)]),
 {id:1,restrictions:[{...sdkEngineRow,timeFrames:sdkFrames}]})[0];
const calendarMatch={index:1,status:'MATCH',frameCount:1,fields:[],timeZones:['Europe/Rome']};
assert.deepEqual(compareCalendar([sdkCalendar],[nativeCalendar]),calendarMatch,
 'Native weekday bits start with Monday, regardless of SDK array order');
assert.deepEqual(compareCalendar([{...sdkCalendar,timeZone:null,dayAlternation:'ODD_DAYS',
 weekdays:a.WEEKDAYS}], [{...nativeCalendar,timeZone:null,daysOfMonth:1431655765,weekdays:null}]),
 {...calendarMatch,timeZones:[null]},'Native null weekdays mean all days, and a null zone is left unset');
assert.deepEqual(compareCalendar([{...sdkCalendar,weekdays:[]}],[{...nativeCalendar,weekdays:0}]),
 calendarMatch,'Zero weekday bits mean an empty SDK list');
assert.deepEqual(compareCalendar([{...sdkCalendar,weekdays:[]}],[{...nativeCalendar,weekdays:127}]),
 {...calendarMatch,status:'DIFFERENT',fields:['timeFrames[0].weekdays']});
assert.deepEqual(compareCalendar([sdkCalendar],[{...nativeCalendar,weekdays:128,daysOfMonth:1}]),
 {...calendarMatch,status:'UNKNOWN',fields:['timeFrames[0].weekdays','timeFrames[0].dayAlternation']});
assert.deepEqual(compareCalendar([{...sdkCalendar,weekdays:['MONDAY','MONDAY']}],[nativeCalendar]),
 {...calendarMatch,status:'UNKNOWN',fields:['timeFrames[0].weekdays']});
assert.deepEqual(compareCalendar([sdkCalendar],[{...nativeCalendar,timeZone:'America/Los_Angeles'}]),
 {...calendarMatch,status:'DIFFERENT',fields:['timeFrames[0].timeZone'],timeZones:[]});
assert.deepEqual(compareCalendar([sdkCalendar],
 [{...nativeCalendar,startDate:'2026-11-24',toTime:'05:00',repeatYearly:true}]),
 {...calendarMatch,status:'DIFFERENT',fields:['timeFrames[0].startDate','timeFrames[0].toTime',
  'timeFrames[0].repeatYearly']});
assert.deepEqual(compareCalendar([sdkCalendar],
 [{...nativeCalendar,endDate:'2026-11-31',weekdays:undefined}]),
 {...calendarMatch,status:'UNKNOWN',fields:['timeFrames[0].endDate','timeFrames[0].weekdays']});
const opaqueZone='PRIVATE-UNVERIFIED-ZONE';
const redactedCalendar=compareCalendar([{...sdkCalendar,timeZone:opaqueZone}],
 [{...nativeCalendar,timeZone:opaqueZone}]);
assert.deepEqual(redactedCalendar,
 {...calendarMatch,status:'UNKNOWN',fields:['timeFrames[0].timeZone'],timeZones:[]});
assert.doesNotMatch(JSON.stringify(redactedCalendar),/PRIVATE/);
assert.deepEqual(compareCalendar([sdkCalendar],null),
 {...calendarMatch,status:'UNKNOWN',frameCount:null,fields:['timeFrames'],timeZones:[]});
assert.deepEqual(compareCalendar([sdkCalendar],[]),
 {...calendarMatch,status:'DIFFERENT',frameCount:null,fields:['timeFrames'],timeZones:[]});
assert.deepEqual(compareCalendar([],[]),{...calendarMatch,frameCount:0,timeZones:[]});
const noCalendarPair=a.inspectInternalCalendarPreservation(
 rawSegmentWith([nativeCalendarRow([nativeCalendar]),nativeCalendarRow([nativeCalendar])]),
 {id:1,restrictions:Array.from({length:2},()=>({...sdkEngineRow,timeFrames:[sdkCalendar]}))});
assert.deepEqual(noCalendarPair.map(({status,reason,timeZones})=>({status,reason,timeZones})),
 Array.from({length:2},()=>({status:'UNPAIRED',reason:'native_engine_pair_ambiguous',timeZones:[]})));

assert.ok(src.includes('if(step===7&&RESTRICTION_TYPES.includes(draft.restrictionType))'),
 'Date and time screen must include red, green and blue');
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
// Alpha 12: read-only SDK inspection must never be mistaken for geographic eligibility.
const observedSegment={
 id:204,isAtoB:true,isBtoA:true,isTwoWay:true,
 restrictions:[
  {direction:'FWD',defaultType:'BLOCKED',laneScope:'ALL',laneType:'HOV',
   timeFrames:[{startDate:'2026-11-23',timeZone:'Europe/Rome'}],vehicleRules:{FREE:[]},
   editable:true,description:'Test local restriction'},
  {direction:'REV',defaultType:'FREE',laneScope:'RIGHT',laneType:'BUS',
   timeFrames:[{timeZone:'Europe/Rome'},{timeZone:null}],vehicleRules:{BLOCKED:[]},
   editable:false},
  {direction:'REV',defaultType:'FREE',laneScope:'RIGHT',laneType:'BUS',
   timeFrames:[],vehicleRules:{BLOCKED:[]},editable:null}
 ]
};
const observedReport=a.inspectRestrictionCapabilities(observedSegment);
assert.deepEqual(observedReport,{
 available:true,count:3,laneScopes:['ALL','RIGHT'],
 laneTypes:['BUS','HOV'],defaultTypes:['BLOCKED','FREE'],
 timeZones:['Europe/Rome'],editable:{yes:1,no:1,unknown:1},verified:false
});
assert.deepEqual(a.inspectRestrictionCapabilities({id:5,restrictions:[]}),{
 available:true,count:0,laneScopes:[],laneTypes:[],defaultTypes:[],
 timeZones:[],editable:{yes:0,no:0,unknown:0},verified:false
});
assert.equal(a.inspectRestrictionCapabilities({id:5}).available,false);
assert.equal(a.restrictionSnapshot({id:5}),null);
const baseline=a.restrictionSnapshot(observedSegment);
assert.ok(typeof baseline==='string');
assert.equal(a.restrictionSnapshot(observedSegment),baseline,'Same SDK data must preserve fingerprint');
assert.notEqual(a.restrictionSnapshot({...observedSegment,isBtoA:false}),baseline,
 'Direction change must invalidate draft');
assert.notEqual(a.restrictionSnapshot({...observedSegment,restrictions:[
 ...observedSegment.restrictions.slice(0,1),{...observedSegment.restrictions[1],
  timeFrames:[{timeZone:'Europe/Rome',fromTime:'18:00'}]},observedSegment.restrictions[2]
]}),baseline,'Time-range modification must invalidate draft');
assert.notEqual(a.restrictionSnapshot({...observedSegment,restrictions:[
 {...observedSegment.restrictions[0],vehicleRules:{FREE:[{vehicleTypes:['BUS']}]}},
 ...observedSegment.restrictions.slice(1)
]}),baseline,'Vehicle-rule modification must invalidate draft');
assert.notEqual(a.restrictionSnapshot({...observedSegment,restrictions:[
 {...observedSegment.restrictions[0],laneScope:'LEFT'},
 ...observedSegment.restrictions.slice(1)
]}),baseline,'Lane-scope modification must invalidate draft');
assert.notEqual(a.restrictionSnapshot({...observedSegment,restrictions:[
 {...observedSegment.restrictions[0],editable:false},
 ...observedSegment.restrictions.slice(1)
]}),baseline,'Edit permission change must invalidate draft');
const [firstObserved,...otherObserved]=observedSegment.restrictions;
const snapshotWith=fields=>a.restrictionSnapshot({...observedSegment,restrictions:[
 {...firstObserved,...fields},...otherObserved
]});
assert.notEqual(snapshotWith({isExpired:true}),snapshotWith({isExpired:false}));
assert.notEqual(snapshotWith({opaque:{category:1}}),snapshotWith({opaque:{category:2}}));
assert.equal(snapshotWith({opaque:{a:1,b:2}}),snapshotWith({opaque:{b:2,a:1}}));
for(const opaque of [undefined,NaN,Infinity,new Date(),Array(1),Symbol(),()=>{}]){
 assert.equal(snapshotWith({opaque}),null,'Values JSON could discard or coerce must not become equal');
}
let accessorEvaluated=false;
const opaqueAccessor={get unexpected(){accessorEvaluated=true;return 1;}};
assert.equal(snapshotWith({opaque:opaqueAccessor}),null);
assert.equal(accessorEvaluated,false,'Snapshot must not evaluate native accessors');
const cyclic={id:20,isAtoB:true,restrictions:[{direction:'FWD'}]};
cyclic.restrictions[0].timeFrames=cyclic.restrictions;
assert.equal(a.restrictionSnapshot(cyclic),null,'Unserializable SDK state must be unknown, not guessed');
assert.ok(src.includes('const baselineSnapshot=restrictionSnapshot(current.segment);'),
 'The wizard must capture initial SDK restrictions');
assert.ok(src.includes('if(baselineSnapshot!==latestSnapshot)'),
 'Next must abort if observed SDK restrictions or direction changed');
assert.ok(src.includes('node("p",tr("inspection_changed"))'),
 'Stale drafts must show a clear message');
assert.ok(src.includes('const inspection=inspectRestrictionCapabilities(context.segment);'),
 'SDK observation belongs in the sidebar, not a write path');
assert.ok(src.includes('details.append(note);root.append(details);'),
 'Inspection must communicate its read-only, observed-only limitations');
// Alpha 14: a green whitelist must have dates and hours AFTER vehicle-specific conditions.
assert.ok(src.includes('if(step===5&&(intent==="BLOCKED"||intent==="ALLOWED"))return 7;'),
 'Green advanced conditions must continue to the shared calendar');
assert.ok(src.includes('if(step===7&&RESTRICTION_TYPES.includes(intent))return 6;'),
 'Every restriction type must go from calendar to summary');
assert.ok(src.includes('if(step===7&&intent==="ALLOWED")return 5;'),
 'Back from green schedule must return to per-vehicle rules');
for(const intent of ['red','green','toll']){
 assert.ok(src.includes(`renderScheduleSummary(schedule,"${intent}_schedule_intro");`),
  'All summaries must display the same overnight semantics');
}
assert.ok(src.includes('tr("schedule_overnight")')&&src.includes('tr("schedule_next_day")'),
 'The calendar editor and summary must identify the next-day ending');
const proposedFrames=[
 {weekdays:['MONDAY'],fromTime:'08:00',toTime:'11:00'},
 {weekdays:['MONDAY'],fromTime:'16:00',toTime:'19:00'}
];
const emptyBudget=a.estimateSafe12Budget([],proposedFrames);
assert.deepEqual(emptyBudget,{
 status:'WITHIN_ESTIMATE',existingRestrictions:0,existingFrames:0,
 proposedRestrictions:2,proposedFrames:2,projectedRestrictions:2,projectedFrames:2,
 limit:12,verified:false
});
const existingRestrictions=[
 {timeFrames:[{fromTime:'09:00',toTime:'10:00'}]},
 {timeFrames:[{fromTime:'10:00',toTime:'11:00'},{fromTime:'14:00',toTime:'15:00'}]}
];
const within=a.estimateSafe12Budget(existingRestrictions,proposedFrames);
assert.equal(within.status,'WITHIN_ESTIMATE');
assert.equal(within.existingRestrictions,2);
assert.equal(within.existingFrames,3);
assert.equal(within.projectedRestrictions,4);
assert.equal(within.projectedFrames,5);
assert.equal(within.verified,false,'An estimate must never be marked verified');
assert.equal(existingRestrictions[0].timeFrames.length,1,'Inspector must never mutate SDK restrictions');
const overByRules=a.estimateSafe12Budget(
 Array.from({length:11},()=>({timeFrames:[]})),proposedFrames);
assert.equal(overByRules.status,'OVER');
assert.equal(overByRules.projectedRestrictions,13);
const overByFrames=a.estimateSafe12Budget(
 [{timeFrames:Array.from({length:11},()=>({weekdays:['TUESDAY']}))}],
 proposedFrames);
assert.equal(overByFrames.status,'OVER');
assert.equal(overByFrames.projectedRestrictions,3);
assert.equal(overByFrames.projectedFrames,13);
const exactLimit=a.estimateSafe12Budget(
 Array.from({length:10},()=>({timeFrames:[{}]})),proposedFrames);
assert.equal(exactLimit.status,'WITHIN_ESTIMATE');
assert.equal(exactLimit.projectedRestrictions,12);
assert.equal(exactLimit.projectedFrames,12);
for(const unknown of [
 a.estimateSafe12Budget(null,proposedFrames),
 a.estimateSafe12Budget([{description:'no-frames'}],proposedFrames),
 a.estimateSafe12Budget([null],proposedFrames),
 a.estimateSafe12Budget(Array(1),proposedFrames),
 a.estimateSafe12Budget([{timeFrames:Array(1)}],proposedFrames),
 a.estimateSafe12Budget([],[]),
 a.estimateSafe12Budget([],null),
 a.estimateSafe12Budget([],Array(1)),
 a.estimateSafe12Budget([],['invalid'])
]){
 assert.equal(unknown.status,'UNKNOWN','Incomplete SDK data cannot be guessed');
 assert.equal(unknown.projectedFrames,null);
 assert.equal(unknown.verified,false);
}
const allDayRule={timeFrames:[{}]};
assert.deepEqual(a.countSafe12Operation([[allDayRule],[]]),{
 restrictions:1,timeFrames:1,overLimit:false
});
assert.deepEqual(a.countSafe12Operation([
 Array(7).fill(allDayRule),Array(5).fill(allDayRule)
]),{restrictions:12,timeFrames:12,overLimit:false});
assert.deepEqual(a.countSafe12Operation([
 Array(7).fill({timeFrames:[]}),Array(6).fill(allDayRule)
]),{restrictions:13,timeFrames:6,overLimit:true},'Restriction cap applies across all segments');
assert.deepEqual(a.countSafe12Operation([
 [{timeFrames:Array(7).fill({})}],[{timeFrames:Array(6).fill({})}]
]),{restrictions:2,timeFrames:13,overLimit:true},'Frame cap applies across all segments');
assert.equal(a.countSafe12Operation([Array(13).fill(allDayRule),[{timeFrames:[null]}]]),null,
 'A malformed segment cannot produce an authoritative aggregate even when another exceeds the cap');
assert.ok(src.includes('estimateSafe12Budget(') &&
 src.includes('const estimate=estimateSafe12Budget(') &&
 src.includes('tr("budget_assumption")'),
 'Read-only summary must show conservative SAFE12 estimate and assumptions');
assert.ok(src.includes('tr("budget_unknown")') &&
 src.includes('tr(estimate.status==="OVER"?"budget_over":"budget_within")'),
 'Budget must be transparent about over-limit and unknown cases');
const previewSchedule=a.normalizeRedSchedule({...overnightDraft,slots:[
 ...overnightDraft.slots,{fromTime:'08:00',toTime:'09:00'}
]});
const previewInput=Object.freeze({restrictions:Object.freeze([
 Object.freeze({editable:false,licensePlateRule:'PRIVATE-PLATE'}),
 Object.freeze({vehicleRules:{BLOCKED:[{vehicleTypes:['MOTORCYCLE'],engineType:'PRIVATE-ENGINE'}]}})
])});
const projectedDraft=a.previewDraftBeforeAfter(previewInput,previewSchedule);
assert.deepEqual(projectedDraft.before,[1,2]);
assert.deepEqual(projectedDraft.after.retained,[1,2]);
assert.notEqual(projectedDraft.before,projectedDraft.after.retained);
assert.equal(projectedDraft.after.additions.length,2);
assert.deepEqual(projectedDraft.after.additions[0],{
 startDate:'2026-12-06',endDate:'2026-12-06',weekdays:['SUNDAY'],fromTime:'22:00',toTime:'06:00'
});
assert.notEqual(projectedDraft.after.additions[0].weekdays,previewSchedule.timeFrames[0].weekdays);
assert.doesNotMatch(JSON.stringify(projectedDraft),/PRIVATE-|sdkWritePayload/);
assert.equal(projectedDraft.saveAllowed,false);
assert.equal(projectedDraft.verified,false);
const unknownDraftPreview=a.previewDraftBeforeAfter({restrictions:null},previewSchedule);
assert.equal(unknownDraftPreview.before,null);
assert.equal(unknownDraftPreview.after.retained,null,'An unavailable list must not look empty');
assert.deepEqual(unknownDraftPreview.after.additions,projectedDraft.after.additions);
assert.deepEqual(a.previewDraftBeforeAfter({restrictions:[]},previewSchedule).after.retained,[]);
assert.deepEqual(a.previewDraftBeforeAfter({restrictions:Array(1)},previewSchedule).after.retained,[1]);
assert.equal(a.listExistingRestrictions({restrictions:Array(1)}).entries[0].index,1,
 'An unreadable list slot is still shown as an existing row');
// Alpha 16: proposed laneScope values are NOT a verified SDK write contract.
assert.deepEqual(a.LANE_SCOPE_CANDIDATES,{
 segment:'WHOLE_SEGMENT',left:'LEFT_LANE',
 center:'MIDDLE_LANE',right:'RIGHT_LANE'
});
for(const scope of a.SCOPES){
 const report=a.inspectLaneDraft({scope,lane:'lane_none'},[]);
 assert.deepEqual(report,{
  designScope:scope,laneScopeCandidate:a.LANE_SCOPE_CANDIDATES[scope],
  observedScope:false,readAvailable:true,
  designLaneType:'lane_none',sdkLaneType:null,
  laneTypeStatus:'NONE_REQUESTED',observedLaneTypes:[],
  verified:false
 });
}
const existingLaneRows=[
 {laneScope:'LEFT_LANE',laneType:'HOV'},
 {disposition:'RIGHT_LANE',laneType:'BUS'},
 {laneScope:'LEFT_LANE',laneType:'HOV'},
 {laneScope:null,laneType:null},
 {laneScope:'WHOLE_SEGMENT',laneType:'EXPRESS'}
];
const leftReport=a.inspectLaneDraft({scope:'left',lane:'hov'},existingLaneRows);
assert.equal(leftReport.laneScopeCandidate,'LEFT_LANE');
assert.equal(leftReport.observedScope,true);
assert.equal(leftReport.laneTypeStatus,'UNMAPPED');
assert.equal(leftReport.sdkLaneType,null,'Do not invent SDK values for special lane types');
assert.deepEqual(leftReport.observedLaneTypes,['BUS','EXPRESS','HOV']);
assert.equal(leftReport.verified,false,'Existing values are not proof of new restriction eligibility');
assert.equal(a.inspectLaneDraft({scope:'right',lane:'lane_none'},existingLaneRows).observedScope,true,
 'Read deprecated disposition as evidence, but do not write that deprecated field');
assert.equal(a.inspectLaneDraft({scope:'center',lane:'fast'},existingLaneRows).observedScope,false);
const unavailableLane=a.inspectLaneDraft({scope:'segment',lane:'express'},null);
assert.equal(unavailableLane.readAvailable,false);
assert.equal(unavailableLane.observedScope,false);
assert.deepEqual(unavailableLane.observedLaneTypes,[]);
for(const badScope of [null,'unknown','LEFT_LANE']){
 assert.throws(()=>a.inspectLaneDraft({scope:badScope,lane:'lane_none'},[]),/Invalid lane scope/);
}
for(const badType of [null,'HOV','bus','invented']){
 assert.throws(()=>a.inspectLaneDraft({scope:'segment',lane:badType},[]),/Invalid special lane type/);
}
assert.ok(src.includes('const laneCheck=inspectLaneDraft(draft,current.segment.restrictions);'),
 'Show lane evidence in guided lane step');
assert.ok(src.includes('const laneReport=inspectLaneDraft(draft,current.segment.restrictions);'),
 'Show lane scope candidate in all final summaries');
assert.ok(src.includes('tr("lane_special_pending")') && src.includes('tr("lane_caution")'),
 'Warning must distinguish unverified special lane mappings from observed values');
assert.ok(!/\bupdateSegment\s*\(/.test(src),
 'Proposed scope values must not be submitted to SDK');
// Alpha 17: WME changes the native panel action when restrictions exist.
const nativeActions={
  add:['Aggiungi restrizioni','Aggiungi restrizione','Add restrictions','Add restriction',
       'Ajouter des restrictions','Añadir restricciones','Beschränkungen hinzufügen',
       'Adicionar restrições'],
  edit:['Modifica restrizioni','Modifica restrizione','Edit restrictions','Edit restriction',
        'Modifier les restrictions','Editar restricciones','Beschränkungen bearbeiten',
        'Editar restrições']
};
for(const [action,names] of Object.entries(nativeActions)){
 for(const name of names){
  assert.equal(a.nativeRestrictionAction(name),action,name+' should be recognized');
  assert.equal(a.nativeRestrictionAction('  + '+name.toUpperCase()+'  '),action,
    'Native restriction action must support normalized visual labels');
 }
}
for(const unrelated of [
 'Modifica segmento','Modifica dettagli','Modifica velocità','Aggiungi passaggio',
 '1 Restrizioni di Guida','Modifica restrizioni strada','Edit turn restrictions',''
]){
 assert.equal(a.nativeRestrictionAction(unrelated),null,
  'Do not inject guided button next to unrelated native control: '+unrelated);
}
assert.ok(src.includes('const nativeEditLabels = new Set('),
 'The script must support native edit labels, not just add labels');
assert.ok(src.includes("button,[role=\"button\"],wz-button,a,[role=\"link\"]"),
 'The native anchor must search accessible buttons AND links');
assert.ok(src.includes("document.querySelectorAll('span,strong,div,p')"),
 'Provide a guarded fallback when native edit restrictions has no button semantics');
assert.ok(src.includes('if(outer.length>1)return null;') &&
  src.includes('return textLeaves.length===1?textLeaves[0]:null;'),
 'Ambiguous matching native actions must fall back to the script sidebar');
assert.ok(src.includes('nativeButton.addEventListener("pointerdown",event=>event.stopPropagation());') &&
 src.includes('nativeButton.addEventListener("mousedown",event=>event.stopPropagation());'),
 'A nested guided button must not trigger the WME native edit handler');
assert.ok(src.includes('root.append(launch,node("p",tr("anchor")'),
 'The independent sidebar wizard launch must always remain available');
// Alpha 18: SDK write-contract review must be pure, deterministic and fail closed.
const conversionSegment={id:901,isAtoB:true,restrictions:[]};
const conversionSchedule={startDate:'2026-12-01',endDate:'2026-12-31',
 weekdays:['MONDAY','FRIDAY'],allDay:false,
 slots:[{fromTime:'08:00',toTime:'10:00'},{fromTime:'17:00',toTime:'19:00'}]};
const baseConversion={direction:'FWD',scope:'segment',lane:'lane_none'};
const noMotor={enabled:false,conditions:[]};
const localeCountry={id:1,name:'Italy'};
const redNoVehicles=a.reviewSdkConversion({...baseConversion,
 restrictionType:'BLOCKED',vehicleTypes:[]},conversionSegment,
 conversionSchedule,{},[],noMotor,localeCountry);
assert.equal(redNoVehicles.defaultType,'BLOCKED');
assert.equal(redNoVehicles.overrideType,null);
assert.deepEqual(redNoVehicles.vehicleConditionRows,[]);
assert.equal(redNoVehicles.proposedFrameCount,2);
assert.equal(redNoVehicles.plannedHasToll,null);
assert.equal(redNoVehicles.status,'BLOCKED');
assert.equal(redNoVehicles.saveAllowed,false);
assert.equal(redNoVehicles.verified,false);
assert.equal(redNoVehicles.sdkWritePayload,null);
assert.ok(redNoVehicles.blockers.includes('conversion_sdk_contract'));
assert.ok(redNoVehicles.blockers.includes('conversion_schedule'));
assert.ok(redNoVehicles.blockers.includes('conversion_safe12'));
assert.ok(redNoVehicles.blockers.includes('conversion_country'));
assert.ok(!redNoVehicles.blockers.includes('conversion_preserve'));
const redSelected=a.reviewSdkConversion({...baseConversion,
 restrictionType:'BLOCKED',vehicleTypes:['PRIVATE','MOTORCYCLE']},
 conversionSegment,conversionSchedule,{},[],noMotor,localeCountry);
assert.equal(redSelected.defaultType,'FREE');
assert.equal(redSelected.overrideType,'BLOCKED');
assert.deepEqual(redSelected.vehicleConditionRows.map(r=>r.vehicleType),['PRIVATE','MOTORCYCLE']);
assert.ok(redSelected.vehicleConditionRows.every(row=>row.ruleType==='BLOCKED'));
assert.equal(redSelected.vehicleConditionRows.find(r=>r.vehicleType==='MOTORCYCLE').engineFilter,'ALL_MOTORCYCLES');
const motorFilter={enabled:true,conditions:[
 {engineType:'FUEL',operator:'LT',capacityThreshold:125}]};
const redMotor=a.reviewSdkConversion({...baseConversion,
 restrictionType:'BLOCKED',vehicleTypes:['MOTORCYCLE']},
 conversionSegment,conversionSchedule,{},[],motorFilter,localeCountry);
assert.ok(redMotor.blockers.includes('conversion_engine'));
assert.equal(redMotor.vehicleConditionRows[0].engineFilter,'MATCHING_ENGINES');
assert.equal(redMotor.sdkWritePayload,null);
const greenPerVehicle={
 PRIVATE:{requiresPass:true,requiresOccupancy:true,permitIds:['resident'],minPassengers:3},
 EV:{requiresPass:false,requiresOccupancy:false,permitIds:[],minPassengers:null}
};
const greenInput={...baseConversion,restrictionType:'ALLOWED',vehicleTypes:['PRIVATE','EV']};
const green=a.reviewSdkConversion(greenInput,conversionSegment,conversionSchedule,
 greenPerVehicle,[{id:'resident',name:'Local permit'}],noMotor,localeCountry);
assert.equal(green.defaultType,'BLOCKED');
assert.equal(green.overrideType,'FREE');
assert.equal(green.vehicleConditionRows[0].vehicleType,'PRIVATE');
assert.equal(green.vehicleConditionRows[0].access,'CONDITIONAL');
assert.equal(green.vehicleConditionRows[0].permitCount,1);
assert.equal(green.vehicleConditionRows[0].minPassengers,3);
assert.equal(green.vehicleConditionRows[1].vehicleType,'EV');
assert.equal(green.vehicleConditionRows[1].access,'DIRECT');
assert.equal(green.vehicleConditionRows[1].permitCount,0);
assert.equal(green.vehicleConditionRows[1].minPassengers,null);
assert.ok(green.blockers.includes('conversion_conditions'));
assert.equal(green.sdkWritePayload,null);
const greenDirect=a.reviewSdkConversion(greenInput,conversionSegment,conversionSchedule,
 {},[],noMotor,localeCountry);
assert.ok(!greenDirect.blockers.includes('conversion_conditions'));
const toll=a.reviewSdkConversion({...baseConversion,
 restrictionType:'TOLL',vehicleTypes:['TAXI']},
 conversionSegment,conversionSchedule,{},[],noMotor,localeCountry);
assert.equal(toll.defaultType,'TOLL');
assert.equal(toll.overrideType,'FREE');
assert.deepEqual(toll.vehicleConditionRows,[{
 vehicleType:'TAXI',ruleType:'FREE',access:'TOLL_EXEMPT'
}]);
assert.equal(toll.plannedHasToll,true);
assert.ok(toll.blockers.includes('conversion_toll_atomic'));
assert.equal(toll.sdkWritePayload,null);
const existingSegment={...conversionSegment,restrictions:[{
 defaultType:'FREE',editable:false,timeFrames:[{weekdays:1,fromTime:'07:00',toTime:'08:00'}],
 vehicleRules:{BLOCKED:[{vehicleTypes:['BUS']}]}
}]};
const withExisting=a.reviewSdkConversion(greenInput,existingSegment,conversionSchedule,
 greenPerVehicle,[{id:'resident',name:'Local permit'}],noMotor,localeCountry);
assert.ok(withExisting.blockers.includes('conversion_preserve'));
assert.equal(withExisting.existingRestrictionCount,1);
assert.deepEqual(existingSegment.restrictions[0].vehicleRules,
 {BLOCKED:[{vehicleTypes:['BUS']}]},'Existing native rules must remain untouched');
const unknownExisting=a.reviewSdkConversion({...baseConversion,
 restrictionType:'BLOCKED',vehicleTypes:[]},
 {...conversionSegment,restrictions:null},
 conversionSchedule,{},[],noMotor,localeCountry);
assert.ok(unknownExisting.blockers.includes('conversion_unknown'));
assert.equal(unknownExisting.budgetStatus,'UNKNOWN');
const overConversion=a.reviewSdkConversion({...baseConversion,
 restrictionType:'TOLL',vehicleTypes:['TAXI']},
 {...conversionSegment,restrictions:Array.from({length:12},()=>({timeFrames:[]}))},
 conversionSchedule,{},[],noMotor,localeCountry);
assert.equal(overConversion.budgetStatus,'OVER');
assert.ok(overConversion.blockers.includes('conversion_overbudget'));
assert.equal(overConversion.saveAllowed,false);
assert.throws(()=>a.reviewSdkConversion({...baseConversion,
 restrictionType:'ALLOWED',vehicleTypes:['PRIVATE']},conversionSegment,
 conversionSchedule,{PRIVATE:{requiresPass:true,requiresOccupancy:false,
 permitIds:[],minPassengers:null}},[],noMotor,localeCountry),
 /Missing vehicle permit/);
assert.throws(()=>a.reviewSdkConversion({...baseConversion,
 restrictionType:'TOLL',vehicleTypes:[]},conversionSegment,
 conversionSchedule,{},[],noMotor,localeCountry),/TOLL requires/);
assert.ok(src.includes('const conversion=reviewSdkConversion('),
 'The wizard summary must show the conversion review');
assert.ok(src.includes('conversion.sdkWritePayload===null')===false,
 'The interface must never treat a missing write payload as a positive validation');
assert.ok(src.includes('node("summary",tr("conversion_title"))'),
 'The conversion review must have a collapsible accessible heading');
assert.ok(src.includes('node("p",tr("conversion_blocked"))'),
 'The conversion review must always warn that saving is unavailable');
assert.ok(!/\.updateSegment\s*\(/.test(src),
 'The read-only SDK conversion review must not call updateSegment');
// Alpha 19: preserve ALL existing native restrictions; never serialize read model
// as SegmentRestrictionData, and never interpret unknown vehicle rules as writable.
const noRestrictionAudit=a.auditRestrictionPreservation({id:10,isAtoB:true,restrictions:[]});
assert.deepEqual(noRestrictionAudit,{
 status:'NO_EXISTING',count:0,frameCount:0,nonEditable:0,editabilityUnknown:0,
 opaqueVehicleRules:0,legacyFields:0,incomplete:0,entries:[],writeReady:false,verified:false
});
const untouchedNative={id:20,isAtoB:true,restrictions:[
 {defaultType:'BLOCKED',editable:false,timeFrames:[{fromTime:'08:00',toTime:'10:00'}],
  vehicleRules:{FREE:[{vehicleTypes:['BUS']}]},disposition:'RIGHT_LANE'},
 {defaultType:'FREE',editable:true,timeFrames:[],vehicleRules:{BLOCKED:[{
  vehicleTypes:['HAZARDOUS_MATERIALS']}]},driveProfiles:{BLOCKED:[]}},
 {defaultType:'TOLL',timeFrames:[{},{}],vehicleRules:{}}
]};
const beforeNative=JSON.stringify(untouchedNative);
const audited=a.auditRestrictionPreservation(untouchedNative);
const {entries:auditedEntries,...auditedTotals}=audited;
assert.deepEqual(auditedTotals,{
 status:'REQUIRES_ROUNDTRIP',count:3,frameCount:3,nonEditable:1,
 editabilityUnknown:1,opaqueVehicleRules:2,legacyFields:2,
 incomplete:0,writeReady:false,verified:false
});
assert.deepEqual(auditedEntries.map(entry=>entry.index),[1,2,3]);
assert.ok(auditedEntries[0].issues.some(issue=>issue.field==='editable'));
assert.ok(auditedEntries[1].issues.some(issue=>issue.field==='driveProfiles / vehicleRules'));
assert.ok(auditedEntries[2].issues.some(issue=>issue.field==='vehicleRules.FREE'));
assert.equal(JSON.stringify(untouchedNative),beforeNative,
 'The preservation audit must never alter any native restrictions');
const incompleteNative={id:22,isBtoA:true,restrictions:[
 {defaultType:'BLOCKED',editable:true,vehicleRules:{},timeFrames:[]},
 {defaultType:'INVALID',editable:true,vehicleRules:{},timeFrames:[]},
 {defaultType:'FREE',editable:true,timeFrames:[]}
]};
const missing=a.auditRestrictionPreservation(incompleteNative);
assert.equal(missing.status,'UNKNOWN');
assert.equal(missing.count,3);
assert.equal(missing.incomplete,2);
assert.equal(missing.writeReady,false);
assert.deepEqual(a.auditRestrictionPreservation({id:23,restrictions:null}),{
 status:'UNKNOWN',count:null,frameCount:null,nonEditable:null,
 editabilityUnknown:null,opaqueVehicleRules:null,legacyFields:null,
 incomplete:null,entries:[],writeReady:false,verified:false
});
const circularSegment={id:24,restrictions:[{
 defaultType:'FREE',editable:true,timeFrames:[],vehicleRules:{BLOCKED:[]}
}]};
circularSegment.restrictions[0].vehicleRules.SELF=circularSegment.restrictions;
const circularAudit=a.auditRestrictionPreservation(circularSegment);
assert.equal(circularAudit.status,'UNKNOWN',
 'Circular or unserializable native data must fail closed');
assert.deepEqual(circularAudit.entries[0].issues[0],{
 field:'vehicleRules.[…][0]',reason:'preservation_snapshot_cycle'
});
assert.ok(circularAudit.entries[0].issues.some(issue=>issue.field==='direction'),
 'An opaque field must not stop inspection of other readable fields in the same row');

const publicSoleRule={vehicleTypes:['PUBLIC_TRANSPORTATION'],minPassengers:0,
 licensePlateRule:'ENDS_WITH_7',subscriptions:['PRIVATE-SUBSCRIPTION-ID']};
const publicFrame={startDate:'2026-12-06',endDate:'2026-12-06',
 fromTime:'22:00',toTime:'06:00',weekdays:['SUNDAY'],timeZone:'Europe/Rome',
 repeatYearly:false,dayAlternation:null,daysOfMonth:null};
const publicRestriction={defaultType:'FREE',description:'PRIVATE-DESCRIPTION',direction:'FWD',
 laneScope:'LEFT_LANE',disposition:'LEFT_LANE',laneType:'BUS',timeFrames:[publicFrame],
 vehicleRules:{BLOCKED:[publicSoleRule]},driveProfiles:{BLOCKED:[{...publicSoleRule}]},
 editable:true,isExpired:false};
const preservedShape=a.auditRestrictionPreservation({restrictions:[publicRestriction]});
assert.deepEqual(preservedShape.entries,[{index:1,issues:[]}],
 'A documented SDK vehicle category can match the SDK shape outside the wizard shortlist');
assert.ok(!a.VEHICLE_TYPES.includes('PUBLIC_TRANSPORTATION'));
assert.equal(preservedShape.status,'REQUIRES_ROUNDTRIP');
assert.equal(preservedShape.writeReady,false);
const sdkReadback={
 ...publicRestriction,description:undefined,
 timeFrames:[{...publicFrame,toTime:undefined}],
 vehicleRules:{BLOCKED:[{...publicSoleRule,minPassengers:undefined}]},
 driveProfiles:{BLOCKED:[{...publicSoleRule}]}
};
const privateField='PRIVATE-ARBITRARY-KEY';
sdkReadback[privateField]={privateValue:undefined};
let preservationGetterCalls=0;
Object.defineProperty(sdkReadback,'laneScope',{
 get(){preservationGetterCalls++;throw new Error('PRIVATE-GETTER-ERROR');}
});
const partialSegment={restrictions:[sdkReadback,publicRestriction]};
assert.equal(a.restrictionSnapshot(partialSegment),null,
 'Partial diagnostics must not make an opaque snapshot comparable');
const partialAudit=a.auditRestrictionPreservation(partialSegment);
assert.equal(partialAudit.status,'UNKNOWN');
assert.equal(partialAudit.writeReady,false);
assert.equal(partialAudit.verified,false);
assert.equal(preservationGetterCalls,0);
assert.deepEqual(partialAudit.entries[0].issues.slice(0,5),[
 {field:'[…].[…]',reason:'preservation_snapshot_undefined'},
 {field:'description',reason:'preservation_snapshot_undefined'},
 {field:'laneScope',reason:'preservation_snapshot_accessor'},
 {field:'timeFrames[0].toTime',reason:'preservation_snapshot_undefined'},
 {field:'vehicleRules.BLOCKED[0].minPassengers',reason:'preservation_snapshot_undefined'}
]);
assert.ok(!partialAudit.entries[0].issues.some(issue=>issue.field==='driveProfiles / vehicleRules'),
 'A partially unreadable current rule does not establish a difference from the previous one');
assert.deepEqual(partialAudit.entries[1],{index:2,issues:[]});
assert.doesNotMatch(JSON.stringify(partialAudit),/PRIVATE-|ENDS_WITH_7/);
const withSdkAliases=(rule,aliases)=>{
 for(const key of aliases)Object.defineProperty(rule,key,{enumerable:true, get(){
  preservationGetterCalls++;throw new Error('PRIVATE-GETTER-ERROR');
 }});
 return rule;
};
const nativeAliasRule=()=>withSdkAliases({...publicSoleRule,vehicleTypes:['MOTORCYCLE']},
 ['numPassengers','licensePlateNumber']);
const dynamicAliases=withSdkAliases({
 ...publicRestriction,vehicleRules:{BLOCKED:[nativeAliasRule()]},driveProfiles:{BLOCKED:[nativeAliasRule()]},
 timeFrames:[withSdkAliases({...publicFrame},['daysOfMonth'])]
},['disposition']);
const aliasAudit=a.auditRestrictionPreservation({restrictions:[dynamicAliases]});
assert.equal(a.restrictionSnapshot({restrictions:[dynamicAliases]}),null);
assert.equal(preservationGetterCalls,0,'Deprecation recognition must not evaluate native getters');
assert.equal(aliasAudit.status,'UNKNOWN');
assert.equal(aliasAudit.writeReady,false);
assert.deepEqual(aliasAudit.entries[0].issues,[
 {field:'disposition',reason:'preservation_snapshot_alias'},
 {field:'driveProfiles.BLOCKED[0].licensePlateNumber',reason:'preservation_snapshot_alias'},
 {field:'driveProfiles.BLOCKED[0].numPassengers',reason:'preservation_snapshot_alias'},
 {field:'timeFrames[0].daysOfMonth',reason:'preservation_snapshot_alias'},
 {field:'vehicleRules.BLOCKED[0].licensePlateNumber',reason:'preservation_snapshot_alias'},
 {field:'vehicleRules.BLOCKED[0].numPassengers',reason:'preservation_snapshot_alias'},
 {field:'vehicleRules.BLOCKED[0]',reason:'native_engine_review'}
]);
const unrelatedGetterAudit=a.auditRestrictionPreservation({restrictions:[withSdkAliases({
 ...publicRestriction,disposition:'RIGHT_LANE',driveProfiles:{BLOCKED:[]}
},['description'])]});
assert.deepEqual(unrelatedGetterAudit.entries[0].issues,[
 {field:'description',reason:'preservation_snapshot_accessor'},
 {field:'disposition / laneScope',reason:'preservation_field_alias'},
 {field:'driveProfiles / vehicleRules',reason:'preservation_field_alias'}
]);

class NativeRule {
 constructor(fields){Object.assign(this,fields);}
}
const nativeWithPrototype={restrictions:[new NativeRule({...publicRestriction,editable:false})]};
assert.equal(a.restrictionSnapshot(nativeWithPrototype),null);
assert.deepEqual(a.auditRestrictionPreservation(nativeWithPrototype).entries[0].issues,[
 {field:'SegmentRestriction',reason:'preservation_snapshot_object'},
 {field:'editable',reason:'preservation_field_permission'}
]);
const sparseFrames={restrictions:[{...publicRestriction,timeFrames:Array(2)}]};
assert.equal(a.restrictionSnapshot(sparseFrames),null);
assert.deepEqual(a.auditRestrictionPreservation(sparseFrames).entries[0].issues,[
 {field:'timeFrames',reason:'preservation_snapshot_array'}
]);
const opaqueRestriction={...publicRestriction,editable:false,disposition:'RIGHT_LANE',
 'PRIVATE-KEY-PAYLOAD':true,timeFrames:[{...publicFrame,weekdays:127,daysOfMonth:'EVEN_DAYS'}],
 vehicleRules:{BLOCKED:[{...publicSoleRule,minPassengers:1,numPassengers:2,
  licensePlateNumber:'ENDS_WITH_0',vehicleTypes:['HAZARDOUS_MATERIALS'],
  engineType:'PRIVATE-ENGINE-TYPE'}]}};
const opaqueBefore=JSON.stringify(opaqueRestriction);
const opaqueAudit=a.auditRestrictionPreservation({restrictions:[publicRestriction,opaqueRestriction]});
assert.deepEqual(opaqueAudit.entries[1].issues.map(issue=>issue.field),[
 'SegmentRestriction','editable','disposition / laneScope','driveProfiles / vehicleRules',
 'vehicleRules.BLOCKED[0]','vehicleRules.BLOCKED[0].minPassengers',
 'vehicleRules.BLOCKED[0].vehicleTypes','vehicleRules.BLOCKED[0].numPassengers / minPassengers',
 'vehicleRules.BLOCKED[0].licensePlateNumber / licensePlateRule',
 'timeFrames[0].weekdays','timeFrames[0].daysOfMonth / dayAlternation'
]);
assert.equal(JSON.stringify(opaqueRestriction),opaqueBefore);
for(const secret of ['PRIVATE-KEY-PAYLOAD','PRIVATE-DESCRIPTION','PRIVATE-ENGINE-TYPE',
 'PRIVATE-SUBSCRIPTION-ID','ENDS_WITH_7','ENDS_WITH_0']){
 assert.ok(!JSON.stringify(opaqueAudit).includes(secret),'Audit results should contain field paths only');
}
const mixedAudit=a.auditRestrictionPreservation({restrictions:[
 circularSegment.restrictions[0],publicRestriction
]});
assert.equal(mixedAudit.status,'UNKNOWN');
assert.deepEqual(mixedAudit.entries,[...circularAudit.entries,{index:2,issues:[]}]);
const sampleReviewSchedule={startDate:'',endDate:'',weekdays:['MONDAY'],
 allDay:true,slots:[]};
const liveReview=a.reviewSdkConversion({direction:'FWD',scope:'segment',
 lane:'lane_none',restrictionType:'BLOCKED',vehicleTypes:[]},
 untouchedNative,sampleReviewSchedule,{},[],{enabled:false,conditions:[]},
 {id:1,name:'Italy'});
assert.equal(liveReview.preservation.status,'REQUIRES_ROUNDTRIP');
assert.ok(liveReview.blockers.includes('conversion_preservation_gate'));
assert.ok(liveReview.blockers.includes('conversion_preserve'));
assert.equal(liveReview.saveAllowed,false);
assert.equal(liveReview.sdkWritePayload,null);
const noNativeReview=a.reviewSdkConversion({direction:'FWD',scope:'segment',
 lane:'lane_none',restrictionType:'BLOCKED',vehicleTypes:[]},
 {id:25,isAtoB:true,restrictions:[]},sampleReviewSchedule,{},
 [],{enabled:false,conditions:[]},{id:1,name:'Italy'});
assert.equal(noNativeReview.preservation.status,'NO_EXISTING');
assert.ok(!noNativeReview.blockers.includes('conversion_preservation_gate'));
assert.equal(noNativeReview.saveAllowed,false,
 'No existing restrictions does NOT authorize SDK mutation');
const unknownNativeReview=a.reviewSdkConversion({direction:'FWD',scope:'segment',
 lane:'lane_none',restrictionType:'BLOCKED',vehicleTypes:[]},
 {id:26,isAtoB:true,restrictions:null},sampleReviewSchedule,{},
 [],{enabled:false,conditions:[]},{id:1,name:'Italy'});
assert.equal(unknownNativeReview.preservation.status,'UNKNOWN');
assert.ok(unknownNativeReview.blockers.includes('conversion_unknown'));
assert.ok(unknownNativeReview.blockers.includes('conversion_preservation_gate'));
assert.ok(src.includes('const audit=conversion.preservation;'),
 'Read-only summary must show the preservation audit');
assert.ok(src.includes('for(const entry of audit.entries)')&&src.includes('tr(issue.reason)'),
 'The summary must show per-restriction findings');
assert.ok(src.includes('node("h4",tr("preservation_title"))') &&
 src.includes('node("p",tr("preservation_status")'),
 'Audit heading and status must be localized');
assert.ok(src.includes('node("p",tr("preservation_warning"))'),
 'The audit must warn that it never creates a writable SDK payload');
assert.ok(!/\.updateSegment\s*\(/.test(src),
 'Preservation audit must not invoke SDK writes');
// Alpha 20: show all existing restrictions and catch only defensible overlaps.
const existingBase={id:77,isAtoB:true,isBtoA:true,isTwoWay:true,restrictions:[{
 defaultType:'FREE',direction:'FWD',laneScope:'WHOLE_SEGMENT',laneType:null,
 description:'Evening rule',editable:true,isExpired:false,
 timeFrames:[{startDate:'2026-12-01',endDate:'2026-12-31',
  weekdays:['MONDAY','FRIDAY'],fromTime:'08:00',toTime:'11:00',timeZone:'Europe/Rome'}],
 vehicleRules:{BLOCKED:[{vehicleTypes:['BUS']}]}
}]};
const beforeExisting=JSON.stringify(existingBase);
const listed=a.listExistingRestrictions(existingBase);
assert.equal(listed.available,true);
assert.equal(listed.entries.length,1);
assert.deepEqual(listed.entries[0],{
 index:1,defaultType:'FREE',direction:'FWD',laneScope:'WHOLE_SEGMENT',
 laneType:null,editable:true,expired:false,description:'Evening rule',
 frames:[{startDate:'2026-12-01',endDate:'2026-12-31',
  fromTime:'08:00',toTime:'11:00',weekdays:['MONDAY','FRIDAY'],
  timeZone:'Europe/Rome',repeatYearly:null,dayAlternation:null,reviewRequired:false}],framesKnown:true,
 ruleGroups:['BLOCKED'],verified:false
});
assert.equal(JSON.stringify(existingBase),beforeExisting,
 'Listing existing restrictions must not mutate the SDK segment');
assert.deepEqual(a.listExistingRestrictions({id:77,restrictions:null}),
 {available:false,entries:[],verified:false});
assert.deepEqual(a.listExistingRestrictions({id:77,restrictions:[]}),
 {available:true,entries:[],verified:false});
const draftOverlap={direction:'FWD',scope:'segment',lane:'lane_none',
 restrictionType:'BLOCKED',vehicleTypes:[]};
const scheduleOverlap={startDate:'2026-12-01',endDate:'2026-12-31',
 weekdays:['MONDAY'],allDay:false,
 slots:[{fromTime:'09:00',toTime:'10:00'}]};
const verify=(segment,draft,schedule,status)=>{
 const result=a.previewRestrictionConflicts(draft,segment,schedule);
 assert.equal(result.status,status);
 assert.equal(result.saveAllowed,false);
 assert.equal(result.verified,false);
 return result;
};
const overlap=verify(existingBase,draftOverlap,scheduleOverlap,'POTENTIAL_CONFLICT');
assert.equal(overlap.items[0].status,'POTENTIAL_CONFLICT');
assert.equal(overlap.items[0].reason,'conflict_reason_common');
verify({...existingBase,restrictions:[{...existingBase.restrictions[0],
 defaultType:'BLOCKED'}]},draftOverlap,scheduleOverlap,'OVERLAP_REVIEW');
const reverseOnly={...existingBase,restrictions:[{...existingBase.restrictions[0],
 direction:'REV'}]};
assert.equal(verify(reverseOnly,draftOverlap,scheduleOverlap,'SEPARATE').items[0].reason,
 'conflict_reason_direction');
const separateLane={...existingBase,restrictions:[{...existingBase.restrictions[0],
 laneScope:'LEFT_LANE'}]};
assert.equal(verify(separateLane,{...draftOverlap,scope:'right'},
 scheduleOverlap,'SEPARATE').items[0].reason,'conflict_reason_lane');
verify({...separateLane,restrictions:[{...separateLane.restrictions[0],disposition:'RIGHT_LANE'}]},
 {...draftOverlap,scope:'right'},scheduleOverlap,'UNKNOWN');
const separateDates={...existingBase,restrictions:[{...existingBase.restrictions[0],
 timeFrames:[{...existingBase.restrictions[0].timeFrames[0],
 startDate:'2026-11-01',endDate:'2026-11-30'}]}]};
assert.equal(verify(separateDates,draftOverlap,scheduleOverlap,'SEPARATE').items[0].reason,
 'conflict_reason_time');
const separateDays={...existingBase,restrictions:[{...existingBase.restrictions[0],
 timeFrames:[{...existingBase.restrictions[0].timeFrames[0],weekdays:['TUESDAY']}]}]};
verify(separateDays,draftOverlap,scheduleOverlap,'SEPARATE');
const separateHours={...existingBase,restrictions:[{...existingBase.restrictions[0],
 timeFrames:[{...existingBase.restrictions[0].timeFrames[0],
 fromTime:'11:00',toTime:'13:00'}]}]};
verify(separateHours,draftOverlap,scheduleOverlap,'SEPARATE');
const unknownWeekdays={...existingBase,restrictions:[{...existingBase.restrictions[0],
 timeFrames:[{...existingBase.restrictions[0].timeFrames[0],weekdays:127}]}]};
verify(unknownWeekdays,draftOverlap,scheduleOverlap,'UNKNOWN');
const unknownDirection={...existingBase,restrictions:[{...existingBase.restrictions[0],
 direction:null}]};
verify(unknownDirection,draftOverlap,scheduleOverlap,'UNKNOWN');
const overnightTime={...existingBase,restrictions:[{...existingBase.restrictions[0],
 timeFrames:[{...existingBase.restrictions[0].timeFrames[0],
 fromTime:'22:00',toTime:'06:00'}]}]};
verify(overnightTime,draftOverlap,scheduleOverlap,'UNKNOWN');
const reviewFrame=(fields,schedule=scheduleOverlap,status='UNKNOWN')=>{
 const native={...existingBase.restrictions[0].timeFrames[0],...fields};
 const segment={...existingBase,restrictions:[{...existingBase.restrictions[0],timeFrames:[native]}]};
 verify(segment,draftOverlap,schedule,status);
 return a.listExistingRestrictions(segment).entries[0].frames[0];
};
const recurring=reviewFrame({startDate:'2024-12-01',endDate:'2024-12-31',repeatYearly:true});
assert.equal(recurring.repeatYearly,true);
assert.equal(recurring.reviewRequired,true,'Annual recurrence cannot be excluded by comparing absolute dates');
for(const fields of [
 {dayAlternation:'EVEN_DAYS'}, {daysOfMonth:'EVEN_DAYS'},
 {dayAlternation:'EVEN_DAYS',daysOfMonth:'EVEN_DAYS'}
]){
 const alternation=reviewFrame(fields);
 assert.equal(alternation.dayAlternation,'EVEN_DAYS');
 assert.equal(alternation.reviewRequired,true);
}
assert.equal(reviewFrame({dayAlternation:'ODD_DAYS',daysOfMonth:'EVEN_DAYS'}).dayAlternation,null);
assert.equal(reviewFrame({dayAlternation:null,daysOfMonth:'EVEN_DAYS'}).dayAlternation,null);
assert.equal(reviewFrame({weekdays:127}).weekdays,'127');
assert.equal(reviewFrame({weekdays:null}).reviewRequired,true);
assert.equal(reviewFrame({fromTime:{hour:8},toTime:null}).reviewRequired,true);
assert.equal(reviewFrame({someNewCalendarAttribute:true}).reviewRequired,true);
assert.equal(reviewFrame({weekdays:['MONDAY'],fromTime:'22:00',toTime:'06:00'},
 {...scheduleOverlap,weekdays:['TUESDAY'],slots:[{fromTime:'01:00',toTime:'02:00'}]}).reviewRequired,true,
 'A next-day portion of an overnight frame cannot be excluded by comparing weekday labels');
assert.equal(reviewFrame({startDate:'2026-12-07',endDate:'2026-12-07',weekdays:['MONDAY'],
 fromTime:'05:00',toTime:'07:00'},overnightDraft).reviewRequired,false,
 'A Sunday draft can overlap an existing Monday frame after the final start date');
verify(reverseOnly,draftOverlap,overnightDraft,'SEPARATE');
const nightConversion=a.reviewSdkConversion(draftOverlap,existingBase,overnightDraft,
 {},[],{enabled:false,conditions:[]},{id:1,name:'Italy'});
assert.equal(nightConversion.proposedFrameCount,1);
assert.equal(nightConversion.status,'BLOCKED');
assert.equal(nightConversion.saveAllowed,false);
assert.equal(nightConversion.sdkWritePayload,null);
assert.equal(reviewFrame({fromTime:'10:00',toTime:'13:00'}).reviewRequired,false,
 'Touching time boundaries remain uncertain even when both windows have a supported shape');
assert.equal(reviewFrame({repeatYearly:false,dayAlternation:null,daysOfMonth:null},
 scheduleOverlap,'POTENTIAL_CONFLICT').reviewRequired,false);
verify({...existingBase,restrictions:[]},draftOverlap,scheduleOverlap,'NONE');
verify({id:77,isAtoB:true,restrictions:null},draftOverlap,scheduleOverlap,'UNKNOWN');
const mixedExisting={...existingBase,restrictions:[
 reverseOnly.restrictions[0],existingBase.restrictions[0],unknownWeekdays.restrictions[0]
]};
const mixedResult=verify(mixedExisting,draftOverlap,scheduleOverlap,'POTENTIAL_CONFLICT');
assert.deepEqual(mixedResult.items.map(x=>x.status),
 ['SEPARATE','POTENTIAL_CONFLICT','UNKNOWN']);
assert.equal(JSON.stringify(existingBase),beforeExisting,
 'Conflict analysis cannot modify existing native restrictions');
const greenOverlap=verify(existingBase,{...draftOverlap,
 restrictionType:'ALLOWED',vehicleTypes:['PRIVATE']},
 scheduleOverlap,'POTENTIAL_CONFLICT');
assert.equal(greenOverlap.saveAllowed,false);
const tollOverlap=verify(existingBase,{...draftOverlap,
 restrictionType:'TOLL',vehicleTypes:['TAXI']},
 scheduleOverlap,'POTENTIAL_CONFLICT');
assert.equal(tollOverlap.saveAllowed,false);
assert.ok(src.includes('function renderExistingRestrictionList(') &&
 src.includes('root.append(renderExistingRestrictionList(context.segment,true));'),
 'Existing restrictions must be visible immediately in the guided sidebar');
assert.ok(src.includes('dialog.append(renderExistingRestrictionList(current.segment,true));'),
 'Existing restrictions must be visible before filling in a new draft');
assert.ok(src.includes('details.append(renderExistingRestrictionList(current.segment,false));') &&
 src.includes('dialog.append(renderBeforeAfterPreview(schedule,conversion));'),
 'Existing restrictions remain accessible in the final review');
assert.ok(src.includes('dialog.append(renderConflictPreflight(draft,current.segment,redSchedule,{vehicleRules,motorDraft}));'),
 'Conflict review must be visible before and in the final summary');
assert.ok(src.includes('nativeRestrictionAction(') &&
 src.includes('anchor.click();') &&
 src.includes('if(dialog?.open)dialog.close();'),
 'Existing restrictions must be edited only in the native WME panel after a user click');
assert.ok(src.includes('restrictionSnapshot(context?.segment)'),
 'Sidebar must refresh after a restriction change even if count stays unchanged');
assert.ok(src.includes('conflict_uncertain'),
 'Collision analysis must warn about unknown SDK rules and recurring calendars');
assert.ok(!/\.updateSegment\s*\(/.test(src),
 'Conflict detection must never edit WME via SDK');
// Alpha 21: safe vehicle-by-vehicle effects, without assuming distinct SDK
// classes are exclusive and without treating nested conditions as unconditional.
const simpleMotoNative={defaultType:'FREE',vehicleRules:{
 BLOCKED:[{vehicleTypes:['MOTORCYCLE']}]}
};
const simpleMotoSnapshot=JSON.stringify(simpleMotoNative);
const draftSimple=type=>a.normalizeDraft({direction:'FWD',scope:'segment',
 lane:'lane_none',restrictionType:'BLOCKED',vehicleTypes:[type]},
 {isAtoB:true});
const sameMotor=a.reviewVehicleConflictEffects(
 simpleMotoNative,draftSimple('MOTORCYCLE'));
assert.deepEqual(sameMotor.rows.map(r=>[r.vehicleType,r.existingEffect,r.proposedEffect,r.relation]),[
 ['PRIVATE','FREE','FREE','SAME'],
 ['EV','FREE','FREE','SAME'],
 ['MOTORCYCLE','UNKNOWN','BLOCKED','UNKNOWN'],
 ['TAXI','FREE','FREE','SAME']
]);
assert.equal(sameMotor.status,'UNKNOWN','Public SDK cannot exclude an engine filter');
assert.equal(sameMotor.verified,false);
assert.equal(sameMotor.saveAllowed,false);
const differentTaxi=a.reviewVehicleConflictEffects(simpleMotoNative,draftSimple('TAXI'));
assert.equal(differentTaxi.status,'POSSIBLE_DIFFERENCE');
assert.deepEqual(differentTaxi.rows.filter(r=>r.relation==='DIFFERENT').map(r=>r.vehicleType),
 ['TAXI']);
const sameDefaultExisting={...existingBase,restrictions:[{
 ...existingBase.restrictions[0],vehicleRules:{
 BLOCKED:[{vehicleTypes:['MOTORCYCLE']}]}
}]};
const differentDraft={direction:'FWD',scope:'segment',lane:'lane_none',
 restrictionType:'BLOCKED',vehicleTypes:['TAXI']};
const differentOverlap=a.previewRestrictionConflicts(differentDraft,sameDefaultExisting,
 scheduleOverlap,{motorDraft:{enabled:false,conditions:[]}});
assert.equal(differentOverlap.status,'POTENTIAL_CONFLICT');
assert.equal(differentOverlap.items[0].reason,'conflict_reason_vehicle');
assert.equal(differentOverlap.items[0].vehicleReview.status,'POSSIBLE_DIFFERENCE');
const sameDraft={...differentDraft,vehicleTypes:['MOTORCYCLE']};
const sameOverlap=a.previewRestrictionConflicts(sameDraft,sameDefaultExisting,
 scheduleOverlap,{motorDraft:{enabled:false,conditions:[]}});
assert.equal(sameOverlap.status,'OVERLAP_REVIEW');
assert.equal(sameOverlap.items[0].vehicleReview.status,'UNKNOWN');
assert.notEqual(sameOverlap.status,'SEPARATE','An unknown motor filter cannot exclude a conflict');
const existingWithEV={defaultType:'BLOCKED',vehicleRules:{
 FREE:[{vehicleTypes:['EV']}]}
};
const greenDesign=a.normalizeDraft({direction:'FWD',scope:'segment',lane:'lane_none',
 restrictionType:'ALLOWED',vehicleTypes:['PRIVATE','EV']},{isAtoB:true});
const greenPerClass={PRIVATE:{requiresPass:true,requiresOccupancy:false,
 permitIds:['residents'],minPassengers:null},
 EV:{requiresPass:false,requiresOccupancy:false,permitIds:[],minPassengers:null}};
const greenReview=a.reviewVehicleConflictEffects(existingWithEV,greenDesign,
 {vehicleRules:greenPerClass});
assert.equal(greenReview.status,'CONDITIONAL');
assert.equal(greenReview.rows.find(x=>x.vehicleType==='EV').proposedEffect,'FREE');
assert.equal(greenReview.rows.find(x=>x.vehicleType==='EV').relation,'SAME');
assert.equal(greenReview.rows.find(x=>x.vehicleType==='PRIVATE').proposedEffect,'CONDITIONAL');
assert.equal(greenReview.rows.find(x=>x.vehicleType==='PRIVATE').relation,'CONDITIONAL');
assert.equal(a.reviewVehicleConflictEffects(existingWithEV,greenDesign).rows
 .find(x=>x.vehicleType==='PRIVATE').relation,'UNKNOWN',
 'Missing green vehicle-specific state must not become a direct authorization');
const nativeWithConditions={defaultType:'FREE',vehicleRules:{
 BLOCKED:[{vehicleTypes:['MOTORCYCLE'],licensePlateNumber:'ENDS_WITH_0'}]
}};
assert.equal(a.reviewVehicleConflictEffects(nativeWithConditions,
 draftSimple('MOTORCYCLE')).rows[2].existingEffect,'CONDITIONAL');
assert.equal(a.reviewVehicleConflictEffects(nativeWithConditions,
 draftSimple('MOTORCYCLE')).rows[2].relation,'CONDITIONAL');
const nativeRepeated={defaultType:'FREE',vehicleRules:{
 BLOCKED:[{vehicleTypes:['MOTORCYCLE']},
          {vehicleTypes:['MOTORCYCLE']}]}
};
for(const rules of [
 [{vehicleTypes:['MOTORCYCLE'],unrecognized:true},{vehicleTypes:['MOTORCYCLE']}],
 [{vehicleTypes:['MOTORCYCLE']},{vehicleTypes:['MOTORCYCLE'],unrecognized:true}]
]){
 const result=a.reviewVehicleConflictEffects({...nativeRepeated,vehicleRules:{BLOCKED:rules}},
  draftSimple('MOTORCYCLE'));
 assert.equal(result.rows.find(row=>row.vehicleType==='MOTORCYCLE').relation,'UNKNOWN');
 assert.equal(result.status,'UNKNOWN');
}
const repeated=a.reviewVehicleConflictEffects(nativeRepeated,
 draftSimple('MOTORCYCLE'));
assert.equal(repeated.rows.find(row=>row.vehicleType==='MOTORCYCLE').existingEffect,
 'UNKNOWN','Repeated motorcycle rules may have unreported motor filters');
assert.equal(repeated.status,'UNKNOWN');
const repeatedTaxi=a.reviewVehicleConflictEffects({defaultType:'FREE',vehicleRules:{
 BLOCKED:[{vehicleTypes:['TAXI']},{vehicleTypes:['TAXI']}]
}},draftSimple('TAXI'));
assert.equal(repeatedTaxi.status,'CONDITIONAL','Multiple native rules for a category need precedence verification');
const nativeUnsupported={defaultType:'FREE',vehicleRules:{
 BLOCKED:[{vehicleTypes:['BUS']}]
}};
const unknownNative=a.reviewVehicleConflictEffects(nativeUnsupported,
 draftSimple('MOTORCYCLE'));
assert.equal(unknownNative.unmodeledNativeTypes,true);
assert.equal(unknownNative.status,'UNKNOWN');
assert.ok(unknownNative.rows.every(x=>x.existingEffect==='UNKNOWN'));
const withLegacy={defaultType:'BLOCKED',vehicleRules:{},
 driveProfiles:{FREE:[{vehicleTypes:['TAXI']}]}};
assert.equal(a.reviewVehicleConflictEffects(withLegacy,
 draftSimple('MOTORCYCLE')).status,'UNKNOWN');
assert.equal(a.reviewVehicleConflictEffects({defaultType:'FREE'},
 draftSimple('MOTORCYCLE')).status,'UNKNOWN');
const blue=a.normalizeDraft({direction:'FWD',scope:'segment',lane:'lane_none',
 restrictionType:'TOLL',vehicleTypes:['TAXI']},{isAtoB:true});
const tollExisting={defaultType:'TOLL',vehicleRules:{
 FREE:[{vehicleTypes:['TAXI']}]}
};
const tollReview=a.reviewVehicleConflictEffects(tollExisting,blue);
assert.equal(tollReview.status,'SAME_EFFECT');
assert.equal(tollReview.rows.find(x=>x.vehicleType==='TAXI').existingEffect,'FREE');
assert.equal(tollReview.rows.find(x=>x.vehicleType==='PRIVATE').proposedEffect,'TOLL');
const conditionalEngine=a.reviewVehicleConflictEffects(simpleMotoNative,
 draftSimple('MOTORCYCLE'),{motorDraft:{enabled:true,conditions:[
 {engineType:'FUEL',operator:'LT',capacityThreshold:125}]}});
assert.equal(conditionalEngine.rows.find(x=>x.vehicleType==='MOTORCYCLE').proposedEffect,
 'CONDITIONAL');
assert.equal(conditionalEngine.status,'UNKNOWN');
const numericDaysVehicle=a.previewRestrictionConflicts(sameDraft,
 unknownWeekdays,scheduleOverlap);
assert.equal(numericDaysVehicle.status,'UNKNOWN',
 'Numeric SDK weekdays should still block the final conflict determination');
assert.ok(numericDaysVehicle.items[0].vehicleReview,
 'Vehicle analysis can be displayed as partial evidence even with unknown dates');
assert.equal(JSON.stringify(simpleMotoNative),simpleMotoSnapshot,
 'Vehicle inspection must not mutate the existing restriction');
assert.ok(src.includes('reviewVehicleConflictEffects(') &&
 src.includes('const vehicleReview=reviewVehicleConflictEffects('),
 'The conflict preflight must actually perform per-vehicle comparisons');
assert.ok(src.includes('node("summary",tr("vehicle_conflict_title"))'),
 'Vehicle-level details must be visible in the conflict viewer');
assert.ok(src.includes('tr("vehicle_compare_caution")'),
 'The UI must explain overlapping categories and unverified AND/OR and precedence');
assert.ok(src.includes('tr("vehicle_compare_unmodeled")'),
 'Native categories outside the four-option shortlist must not be hidden');
// Alpha 22: inspect native read-only conditions without leaking permit IDs
// or license-plate values, and recognize identical legacy representations.
const nativeSimple={vehicleTypes:['MOTORCYCLE'],subscriptions:[],
 licensePlateNumber:'',engineCapacities:[]};
assert.deepEqual(a.inspectNativeVehicleCondition(nativeSimple),{
 status:'UNKNOWN',types:['MOTORCYCLE'],passCount:0,
 minPassengers:null,occupancyFields:[],occupancyStatus:'NOT_REPORTED',
 hasPlate:false,hasEngine:false,
 unknownFields:[],conditions:[],verified:false
});
const nativeResident={vehicleTypes:['PRIVATE'],subscriptions:['SECRET-PASS-ID'],
 numPassengers:3,licensePlateNumber:'ENDS_WITH_7'};
const residentInspection=a.inspectNativeVehicleCondition(nativeResident);
assert.equal(residentInspection.status,'CONDITIONAL');
assert.equal(residentInspection.passCount,1);
assert.equal(residentInspection.minPassengers,3);
assert.deepEqual(residentInspection.occupancyFields,['numPassengers']);
assert.equal(residentInspection.occupancyStatus,'MINIMUM');
assert.equal(residentInspection.hasPlate,true);
assert.deepEqual(residentInspection.conditions,['PASS','OCCUPANCY','PLATE']);
assert.ok(!JSON.stringify(residentInspection).includes('SECRET-PASS-ID'));
assert.ok(!JSON.stringify(residentInspection).includes('ENDS_WITH_7'));
assert.equal(JSON.stringify(nativeResident).includes('SECRET-PASS-ID'),true,
 'The inspection must not modify the source data');
const nativeEngine=a.inspectNativeVehicleCondition({
 vehicleTypes:['MOTORCYCLE'],engineType:'UNKNOWN-NATIVE-ENGINE',
 operator:'LTE',capacityThreshold:125
});
assert.equal(nativeEngine.status,'CONDITIONAL');
assert.equal(nativeEngine.hasEngine,true);
assert.deepEqual(nativeEngine.conditions,['ENGINE']);
assert.ok(!JSON.stringify(nativeEngine).includes('UNKNOWN-NATIVE-ENGINE'),
 'Private engine values must not be disclosed in diagnostic output');
const opaqueCondition=a.inspectNativeVehicleCondition({
 vehicleTypes:['TAXI'],mysteryFlag:true,subscriptions:[]
});
assert.equal(opaqueCondition.status,'UNKNOWN');
assert.deepEqual(opaqueCondition.unknownFields,['mysteryFlag']);
for(const field of ['minPassengers','numPassengers']){
 const zero=a.inspectNativeVehicleCondition({...nativeSimple,[field]:0});
 assert.equal(zero.status,'UNKNOWN');
 assert.equal(zero.occupancyStatus,'ZERO');
 assert.equal(zero.minPassengers,null);
 assert.deepEqual(zero.occupancyFields,[field]);
 assert.deepEqual(zero.unknownFields,[]);
 assert.deepEqual(zero.conditions,[],'Zero is reported without asserting an occupancy requirement');
 for(const value of [2,3,4]){
  const native=a.inspectNativeVehicleCondition({...nativeSimple,[field]:value});
  assert.equal(native.status,'CONDITIONAL');
  assert.equal(native.occupancyStatus,'MINIMUM');
  assert.equal(native.minPassengers,value);
  assert.deepEqual(native.occupancyFields,[field]);
  assert.deepEqual(native.unknownFields,[]);
  assert.deepEqual(native.conditions,['OCCUPANCY']);
 }
 for(const value of [1,5,-1,2.5,NaN,Infinity,null,undefined,'2','PRIVATE-VALUE']){
  const invalid=a.inspectNativeVehicleCondition({...nativeSimple,[field]:value});
  assert.equal(invalid.status,'UNKNOWN');
  assert.equal(invalid.occupancyStatus,'UNKNOWN');
  assert.equal(invalid.minPassengers,null);
  assert.deepEqual(invalid.unknownFields,[]);
  assert.deepEqual(invalid.conditions,[]);
  assert.ok(!JSON.stringify(invalid).includes('PRIVATE-VALUE'));
 }
}
const bothPassengerFields=['minPassengers','numPassengers'];
for(const value of [0,3]){
 const matching=a.inspectNativeVehicleCondition({...nativeSimple,numPassengers:value,minPassengers:value});
 assert.deepEqual(matching.occupancyFields,bothPassengerFields);
 assert.equal(matching.occupancyStatus,value===0?'ZERO':'MINIMUM');
 assert.deepEqual(matching.conditions,value===0?[]:['OCCUPANCY']);
}
for(const [current,legacy] of [[3,4],[0,2],[2,0],[null,3],[3,undefined]]){
 const disagreement=a.inspectNativeVehicleCondition({
  ...nativeSimple,minPassengers:current,numPassengers:legacy
 });
 assert.equal(disagreement.status,'UNKNOWN');
 assert.equal(disagreement.occupancyStatus,'UNKNOWN');
 assert.equal(disagreement.minPassengers,null);
 assert.deepEqual(disagreement.occupancyFields,bothPassengerFields);
 assert.deepEqual(disagreement.conditions,[]);
}
assert.equal(a.inspectNativeVehicleCondition({vehicleTypes:['TAXI'],subscriptions:[42]}).status,
 'UNKNOWN','Invalid native subscription representation must stay unknown');
assert.equal(a.inspectNativeVehicleCondition({vehicleTypes:[1024]}).status,'UNKNOWN',
 'Numeric vehicle types cannot be silently converted without an SDK mapping');
assert.equal(a.inspectNativeVehicleCondition({vehicleTypes:[]}).status,'UNKNOWN');
assert.equal(a.inspectNativeVehicleCondition(null).status,'UNKNOWN');
const sameLegacyOriginal={FREE:[{vehicleTypes:['EV'],subscriptions:[]}]};
const sameLegacyCopy={FREE:[{subscriptions:[],vehicleTypes:['EV']}]};
assert.notEqual(sameLegacyOriginal,sameLegacyCopy);
assert.equal(a.compareLegacyVehicleRules(sameLegacyOriginal,sameLegacyCopy),'SAME',
 'Equivalent but separately allocated deprecated/current fields should compare equal');
assert.equal(a.compareLegacyVehicleRules(sameLegacyOriginal,
 {FREE:[{vehicleTypes:['TAXI']}]}),'DIFFERENT');
assert.equal(a.compareLegacyVehicleRules(sameLegacyOriginal,null),'ABSENT');
assert.equal(a.compareLegacyVehicleRules(sameLegacyOriginal,{}),'ABSENT');
const legacyCycle={FREE:[]};legacyCycle.FREE.push(legacyCycle);
assert.equal(a.compareLegacyVehicleRules(sameLegacyOriginal,legacyCycle),'UNKNOWN');
assert.equal(a.compareLegacyVehicleRules(legacyCycle,legacyCycle),'UNKNOWN');
assert.equal(a.compareLegacyVehicleRules(sameLegacyOriginal,[]),'UNKNOWN');
assert.equal(a.compareLegacyVehicleRules(sameLegacyOriginal,false),'UNKNOWN');
assert.equal(a.compareLegacyVehicleRules({FREE:[{field:null}]},{FREE:[{field:NaN}]}),'UNKNOWN');
const sharedRow={vehicleTypes:['EV']};
assert.equal(a.compareLegacyVehicleRules({FREE:[sharedRow,sharedRow]},
 {FREE:[{vehicleTypes:['EV']},{vehicleTypes:['EV']}]}),'SAME');
const legacyMatchingRestriction={defaultType:'BLOCKED',
 vehicleRules:sameLegacyOriginal,driveProfiles:sameLegacyCopy};
const legacyMatchingDraft=a.normalizeDraft({
 direction:'FWD',scope:'segment',lane:'lane_none',restrictionType:'ALLOWED',
 vehicleTypes:['EV']},{isAtoB:true});
const matchingReview=a.reviewVehicleConflictEffects(
 legacyMatchingRestriction,legacyMatchingDraft,
 {vehicleRules:{EV:{requiresPass:false,requiresOccupancy:false,permitIds:[],
  minPassengers:null}}});
assert.equal(matchingReview.rows.find(row=>row.vehicleType==='EV').existingEffect,'FREE');
assert.equal(matchingReview.rows.find(row=>row.vehicleType==='EV').relation,'SAME');
assert.equal(matchingReview.status,'SAME_EFFECT');
assert.deepEqual(a.inspectNativeVehicleRules(legacyMatchingRestriction),{
 available:true,legacyComparison:'SAME',
 rows:[{group:'FREE',index:1,status:'UNCONDITIONAL',types:['EV'],
  passCount:0,minPassengers:null,occupancyFields:[],occupancyStatus:'NOT_REPORTED',
  hasPlate:false,hasEngine:false,
  unknownFields:[],conditions:[],verified:false}],verified:false
});
const nativeMotorcycleRule=Object.freeze({
 vehicleTypes:Object.freeze(['MOTORCYCLE']),subscriptions:Object.freeze([]),minPassengers:0
});
const motorcycleGroups=Object.freeze({BLOCKED:Object.freeze([nativeMotorcycleRule])});
const existingMotorcycleRestriction=Object.freeze({defaultType:'FREE',
 vehicleRules:motorcycleGroups,driveProfiles:{BLOCKED:[{...nativeMotorcycleRule}]}});
const motorcycleBefore=JSON.stringify(existingMotorcycleRestriction);
const motorcycleInspection=a.inspectNativeVehicleRules(existingMotorcycleRestriction);
assert.equal(motorcycleInspection.legacyComparison,'SAME');
assert.equal(motorcycleInspection.rows[0].status,'UNKNOWN');
assert.equal(motorcycleInspection.rows[0].occupancyStatus,'ZERO');
assert.deepEqual(motorcycleInspection.rows[0].unknownFields,[]);
const motorcycleReview=a.reviewVehicleConflictEffects(existingMotorcycleRestriction,{
 defaultType:'FREE',restrictionIntent:'BLOCKED',vehicleTypes:['MOTORCYCLE']
});
assert.equal(motorcycleReview.rows.find(row=>row.vehicleType==='MOTORCYCLE').existingEffect,'UNKNOWN');
assert.equal(motorcycleReview.status,'UNKNOWN');
assert.equal(motorcycleReview.saveAllowed,false);
assert.equal(JSON.stringify(existingMotorcycleRestriction),motorcycleBefore);
assert.equal(a.compareLegacyVehicleRules(motorcycleGroups,{
 BLOCKED:[{vehicleTypes:['MOTORCYCLE'],subscriptions:[],numPassengers:0}]
}),'DIFFERENT','Structural comparison preserves differences between legacy and current SDK objects');
assert.equal(a.inspectNativeVehicleRules({vehicleRules:null}).available,false);
const diagnosticRules={defaultType:'BLOCKED',vehicleRules:{
 FREE:[{vehicleTypes:['EV'],subscriptions:[]},
       {vehicleTypes:['PRIVATE'],licensePlateRule:'ENDS_WITH_9'}]
}};
const conditionDetails=a.inspectNativeVehicleRules(diagnosticRules);
assert.equal(conditionDetails.rows.length,2);
assert.equal(conditionDetails.rows[1].hasPlate,true);
assert.equal(conditionDetails.rows[1].status,'CONDITIONAL');
assert.ok(!JSON.stringify(conditionDetails).includes('ENDS_WITH_9'),
 'Plate suffix must not appear in a diagnostic JSON object');
for(const fields of [
 {licensePlateRule:'ENDS_WITH_0'},
 {licensePlateNumber:'ENDS_WITH_EVEN'},
 {licensePlateRule:'ENDS_WITH_ODD',licensePlateNumber:'ENDS_WITH_ODD'}
]){
 const plate=a.inspectNativeVehicleCondition({vehicleTypes:['PRIVATE'],...fields});
 assert.equal(plate.status,'CONDITIONAL');
 assert.deepEqual(plate.conditions,['PLATE']);
 assert.equal(plate.hasPlate,true);
 assert.ok(!JSON.stringify(plate).includes('ENDS_WITH_'));
}
for(const fields of [
 {licensePlateRule:{type:'SUFFIX',value:'PRIVATE-SUFFIX'}},
 {licensePlateNumber:'7'},
 {licensePlateRule:'ENDS_WITH_10'},
 {licensePlateRule:'ENDS_WITH_ODD',licensePlateNumber:'ENDS_WITH_EVEN'},
 {licensePlateRule:null,licensePlateNumber:'ENDS_WITH_0'}
]){
 const plate=a.inspectNativeVehicleCondition({vehicleTypes:['PRIVATE'],...fields});
 assert.equal(plate.status,'UNKNOWN');
 assert.equal(plate.hasPlate,true);
 assert.ok(!JSON.stringify(plate).includes('PRIVATE-SUFFIX'));
 assert.ok(!JSON.stringify(plate).includes('ENDS_WITH_'));
}
assert.equal(a.inspectNativeVehicleCondition({...nativeSimple,vehicleTypes:['TAXI'],licensePlateRule:null}).status,
 'UNCONDITIONAL','The documented null and legacy empty value indicate no observed plate condition');
const diagExisting=a.reviewVehicleConflictEffects(
 diagnosticRules,legacyMatchingDraft,
 {vehicleRules:{EV:{requiresPass:false,requiresOccupancy:false,
 permitIds:[],minPassengers:null}}});
assert.equal(diagExisting.rows.find(row=>row.vehicleType==='EV').relation,'SAME');
assert.equal(diagExisting.rows.find(row=>row.vehicleType==='PRIVATE').existingEffect,
 'CONDITIONAL');
assert.ok(src.includes('const diagnostics=inspectNativeVehicleRules(') &&
 src.includes('item.append(nativeDetails);'),
 'Existing restrictions should display native condition diagnostics');
assert.ok(src.includes('const nativeData=inspectNativeVehicleRules(') &&
 src.includes('tr("native_conditions_title")'),
 'Conflict review must expose condition diagnostics where interpretation is incomplete');
assert.ok(src.includes('tr("native_conditions_intro")'),
 'Diagnostic UI must warn about AND/OR/precedence and conceal private values');
assert.ok(!/\.updateSegment\s*\(/.test(src),
 'No SDK mutations in the read-only diagnostics');
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
