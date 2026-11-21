'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('web/voice-search.js', 'utf8');

function button(label) {
  return { hidden:true, attrs:{'aria-label':label},
    addEventListener(name,cb){ this[name]=cb; },
    getAttribute(name){return this.attrs[name];},
    setAttribute(name,value){this.attrs[name]=value;} };
}
function input(){
  return {value:'', events:[],dispatchEvent(e){this.events.push(e.type)},focus(){}};
}
const partnerInput=input(),deliveryInput=input();
const partnerButton=button('Search partners by voice'),deliveryButton=button('Search deliveries by voice');
const controls={partnerSearch:partnerInput,partnerVoiceSearch:partnerButton,deliverySearch:deliveryInput,deliveryVoiceSearch:deliveryButton};
let last;
class Recognizer {
  constructor(){last=this}
  start(){this.started=true}
  stop(){this.stopped=true;this.onend?.()}
}
const context={
 document:{readyState:'complete',documentElement:{lang:'en'},getElementById:id=>controls[id]},
 navigator:{language:'hi-IN'},
 window:{SpeechRecognition:Recognizer},
 Event:class{constructor(type){this.type=type}}
};
vm.runInNewContext(source,context);
assert.equal(partnerButton.hidden,false);
assert.equal(deliveryButton.hidden,false);
partnerButton.click();
assert.equal(last.lang,'hi-IN');
last.onresult({results:[[{transcript:' Amit Kumar '}]]});
assert.equal(partnerInput.value,'Amit Kumar');
assert.deepEqual(partnerInput.events,['input']);
last.onend();
assert.equal(partnerButton.attrs['aria-pressed'],'false');
deliveryButton.click();
assert.equal(last.started,true);
last.onresult({results:[[{transcript:' Order 101 '}]]});
assert.equal(deliveryInput.value,'Order 101');
assert.deepEqual(deliveryInput.events,['input']);
console.log('Delivery administration voice-search tests passed.');
