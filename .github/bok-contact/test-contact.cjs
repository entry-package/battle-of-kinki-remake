const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../../contact.js','utf8');
function page(endpoint='https://script.google.com/macros/s/TEST_DEPLOYMENT/exec',valid=true){
 const events={},timers=[],posts=[],els={};
 function element(id){return els[id]||=( {id,value:'',hidden:false,disabled:false,textContent:'',dataset:{},children:[],attrs:{},listeners:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,f){this.listeners[k]=f},append(x){this.children.push(x)},remove(){},focus(){this.focused=true},submit(){posts.push(this.children.map(x=>({name:x.name,value:x.value})))},reportValidity(){return valid},querySelectorAll(){return[]}})}
 const form=element('bok-contact-form');form.dataset.endpoint=endpoint;
 const frame=element('frame');frame.name='bok-contact-result-frame';
 const doc={getElementById:element,querySelector:()=>frame,createElement:type=>({type,children:[],append(x){this.children.push(x)},remove(){},submit(){posts.push(this.children.map(x=>({name:x.name,value:x.value})))}}),body:{append(){}}};
 class FormData{constructor(){this.data=[['requestId',element('contact-request-id').value],['name','テスト'],['message','テスト内容']]}entries(){return this.data.values()}}
 const context={document:doc,window:{addEventListener(k,f){events[k]=f}},crypto:{getRandomValues(a){a.fill(1);return a}},Uint8Array,Date,location:{origin:'https://www.bok-esports.jp'},FormData,setTimeout(f){timers.push(f);return timers.length},clearTimeout(){}};
 vm.createContext(context);vm.runInContext(source,context);
 return{els,posts,timers,form,submit(){form.listeners.submit({preventDefault(){}})},message(overrides={},origin='https://test-script.googleusercontent.com'){events.message({origin,data:{type:'bok-contact-result',requestId:element('contact-request-id').value,status:'success',receipt:'BOK-TEST',copySent:true,...overrides}})}};
}
let count=0;function test(n,f){f();count++;console.log('PASS '+n)}
test('missing deployment fails closed',()=>{const p=page('');p.submit();assert.equal(p.posts.length,0);assert.equal(p.els['contact-status'].dataset.state,'error')});
test('invalid form is not posted',()=>{const p=page(undefined,false);p.submit();assert.equal(p.posts.length,0)});
test('double click creates one submission',()=>{const p=page();p.submit();p.submit();assert.equal(p.posts.length,1);assert.equal(p.els['contact-fields'].disabled,true)});
test('untrusted origin cannot claim success',()=>{const p=page();p.submit();p.message({},'https://attacker.example');assert.equal(p.form.hidden,false)});
test('wrong request id cannot claim success',()=>{const p=page();p.submit();p.message({requestId:'wrong'});assert.equal(p.form.hidden,false)});
test('known server success displays receipt',()=>{const p=page();p.submit();p.message();assert.equal(p.form.hidden,true);assert.ok(p.els['contact-status'].textContent.includes('BOK-TEST'))});
test('server rejection preserves inputs and permits correction',()=>{const p=page();p.submit();p.message({status:'error',message:'入力をご確認ください'});assert.equal(p.form.hidden,false);assert.equal(p.els['contact-fields'].disabled,false);assert.equal(p.els['contact-submit'].disabled,false)});
test('ambiguous send does not offer a fresh duplicate submission',()=>{const p=page();p.submit();p.message({status:'uncertain',message:'受付確認が必要です'});assert.equal(p.els['contact-submit'].hidden,true);p.submit();assert.equal(p.posts.length,1)});
test('timeout retry uses same request identifier',()=>{const p=page();p.submit();p.timers[0]();p.submit();assert.equal(p.posts.length,2);assert.deepEqual(p.posts[0],p.posts[1])});
test('receipt failure is distinct from notification failure',()=>{const p=page();p.submit();p.message({copySent:false});assert.equal(p.form.hidden,true);assert.ok(p.els['contact-status'].textContent.includes('お問い合わせは受け付けています'))});
console.log(JSON.stringify({passed:count,failed:0,realNetworkRequests:0}));
