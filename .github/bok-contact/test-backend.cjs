const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const code = readFileSync(__dirname+'/backend/Code.gs','utf8');
function receiver(failAt=0,quota=1000) {
 const mail=[];const cache=new Map();const props=new Map();let tries=0;
 const html={text:'',setTitle(){return this},setXFrameOptionsMode(){return this}};
 const context={Date,JSON,Number,String,Object,Math,
  LockService:{getScriptLock(){return{tryLock(){return true},releaseLock(){}}}},
  CacheService:{getScriptCache(){return{get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v)}}},
  PropertiesService:{getScriptProperties(){return{getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)}}},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(a,s)=>[...createHash(a).update(s).digest()],formatDate:()=> '20260914'},
  MailApp:{getRemainingDailyQuota:()=>quota,sendEmail(m){tries++;if(tries===failAt)throw Error('simulated transport failure');mail.push(m)}},
  HtmlService:{XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},createHtmlOutput(s){html.text=s;return html}},
  ContentService:{MimeType:{JSON:'json'},createTextOutput(){return{setMimeType(){return this}}}}
 };
 vm.createContext(context);vm.runInContext(code,context);
 return{send:(p,len=1000)=>JSON.parse(JSON.stringify(context.receiveBokContact_(p,len))),post:p=>context.doPost({parameter:p,contentLength:1000}),mail,cache,html};
}
const input=()=>({requestId:'1'.repeat(32),pageOrigin:'https://www.bok-esports.jp',ts:String(Date.now()-5000),website:'',name:'フォーム動作テスト',organization:'テスト用',email:'qa@example.com',phone:'',category:'その他',message:'これは自動テスト用の入力です。実送信は行いません。',privacy:'yes'});
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name)}
test('admin notification and receipt are addressed separately',()=>{const r=receiver();const v=r.send(input());assert.equal(v.status,'success');assert.equal(v.copySent,true);assert.equal(r.mail.length,2);assert.equal(r.mail[0].to,'info@package-inc.com');assert.equal(r.mail[0].replyTo,'qa@example.com');assert.equal(r.mail[1].to,'qa@example.com');assert.equal(r.mail[1].replyTo,'info@package-inc.com')});
test('duplicate request sends nothing twice',()=>{const r=receiver();const p=input();r.send(p);assert.equal(r.send(p).status,'success');assert.equal(r.mail.length,2)});
test('failed administrator notification is not reported as success',()=>{const r=receiver(1);const p=input();assert.equal(r.send(p).status,'uncertain');assert.equal(r.send(p).status,'uncertain');assert.equal(r.mail.length,0)});
test('receipt failure preserves accepted notification and does not resend',()=>{const r=receiver(2);const p=input();const v=r.send(p);assert.equal(v.status,'success');assert.equal(v.copySent,false);r.send(p);assert.equal(r.mail.length,1)});
for(const [name,change] of [
 ['missing name',p=>p.name='  '], ['invalid email',p=>p.email='not-an-email'],
 ['email header injection',p=>p.email='qa@example.com\r\nBcc: somebody@example.com'],
 ['empty message',p=>p.message='\n '], ['missing privacy choice',p=>p.privacy=''],
 ['unknown category',p=>p.category='unknown'], ['honeypot filled',p=>p.website='bot'],
 ['timestamp missing',p=>p.ts=''], ['submission too fast',p=>p.ts=String(Date.now())],
 ['unknown parent origin',p=>p.pageOrigin='https://example.com'],
 ['oversized text',p=>p.message='x'.repeat(5001)], ['invalid request id',p=>p.requestId='"</script>']
 ])test(name,()=>{const r=receiver();const p=input();change(p);assert.equal(r.send(p).status,'error');assert.equal(r.mail.length,0)});
test('oversized request is rejected',()=>{const r=receiver();assert.equal(r.send(input(),50000).status,'error');assert.equal(r.mail.length,0)});
test('quota shortage does not send only part of the planned messages',()=>{const r=receiver(0,1);assert.equal(r.send(input()).status,'error');assert.equal(r.mail.length,0)});
test('sender throttling',()=>{const r=receiver();r.send(input());const p=input();p.requestId='2'.repeat(32);assert.equal(r.send(p).status,'error');assert.equal(r.mail.length,2)});
test('response contains no submitted personal fields',()=>{const r=receiver();const p=input();r.post(p);assert.ok(!r.html.text.includes(p.email));assert.ok(!r.html.text.includes(p.message));assert.ok(r.html.text.includes('bok-contact-result'));assert.ok(r.html.text.includes('https://www.bok-esports.jp'))});
console.log(JSON.stringify({passed:count,failed:0,realEmailsSent:0}));
