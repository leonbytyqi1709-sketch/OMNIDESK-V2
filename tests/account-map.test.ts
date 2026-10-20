import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import { postgresStorage } from './support/postgres'
import { analyzeAccountMap, relationReviewDue } from '../src/lib/account-map'
import { accountRelationSchema } from '../server/account-map-policy'
import { SecurityAccountError } from '../server/account-security-policy'
import { createSecurityAccount, deleteSecurityAccount, initializeSecurityStorage } from '../server/account-security-store'
import { createAccountRelation, deleteAccountRelation, initializeAccountMap, readAccountMap, updateAccountRelation } from '../server/account-map-store'
import { createAccountMapRoute } from '../server/routes/account-map'
import { createApp } from '../server/app'
import type { AccountRelation, AccountRelationInput } from '../src/types/account-map'
import type { SecurityAccountInput } from '../src/types/account-security'
const ids = ['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005']
function relation(id: string, from: string, to: string, type: AccountRelation['type'] = 'login', mode: AccountRelation['loginDependency'] = 'only_known'): AccountRelation {
  return { id, fromAccountId: from, toAccountId: to, type, loginDependency: type === 'login' ? mode : null, version: 1, manualReviewedAt: null, createdAt: '2026-10-20T10:00:00Z', updatedAt: '2026-10-20T10:00:00Z' }
}
const account: SecurityAccountInput = { name:'Own account',provider:'Example',login:'',securityUrl:'',importance:'normal',passkey:'unknown',twoFactor:'unknown',recovery:'unknown',recoveryCodes:'unknown',recoveryMethods:[],reviewIntervalDays:90,connectedAccountId:null,reviewed:false }

test('map schema rejects self-references, inconsistent semantics and forged properties', () => {
  const input: AccountRelationInput = { fromAccountId:ids[0],toAccountId:ids[1],type:'login',loginDependency:'unknown',reviewed:false }
  assert.equal(accountRelationSchema.safeParse(input).success,true)
  for (const changes of [{toAccountId:ids[0]},{type:'login',loginDependency:null},{type:'recovery_email',loginDependency:'only_known'},{password:'secret'},{manualReviewedAt:'2099-01-01'},{userId:'foreign'}]) assert.equal(accountRelationSchema.safeParse({...input,...changes}).success,false)
})

test('analysis follows arrow direction and separates direct/indirect required login paths', () => {
  const edges=[relation('one','google','service'),relation('two','service','dashboard')]
  const result=analyzeAccountMap('google',edges)
  assert.equal(result.dependencies.find(x=>x.accountId==='service')?.distance,1)
  assert.equal(result.dependencies.find(x=>x.accountId==='dashboard')?.distance,2)
  assert.deepEqual(result.dependencies.find(x=>x.accountId==='dashboard')?.path,['one','two'])
  assert.equal(result.dependencies.find(x=>x.accountId==='dashboard')?.kind,'login_chain')
  assert.deepEqual(analyzeAccountMap('dashboard',edges).dependencies,[])
  assert.deepEqual(analyzeAccountMap('dashboard',edges).upstreamIds,['service','google'])
})

test('recovery-only and alternative paths never become a forced downstream login failure', () => {
  for (const edge of [relation('one','google','service','recovery_email'),relation('one','google','service','recovery_other'),relation('one','google','service','login','alternative_known')]) {
    const result=analyzeAccountMap('google',[edge,relation('two','service','dashboard')])
    assert.equal(result.dependencies.find(x=>x.accountId==='dashboard')?.kind,'connection_only')
    assert.equal(result.dependencies.find(x=>x.accountId==='service')?.kind,edge.type==='login'?'alternative':'recovery')
  }
})

test('unknown paths remain unknown; cycles terminate and include the selected cycle group', () => {
  const result=analyzeAccountMap('google',[relation('one','google','service','login','unknown'),relation('two','service','dashboard'),relation('three','dashboard','google','recovery_email')])
  assert.equal(result.dependencies.find(x=>x.accountId==='dashboard')?.kind,'login_unknown')
  assert.deepEqual(new Set(result.cycleIds),new Set(['google','service','dashboard']))
  assert.ok(result.dependencies.every(x=>x.accountId!=='google'))
  const withAlternative=analyzeAccountMap('google',[relation('one','google','service','login','alternative_known'),relation('two','google','service','recovery_email')])
  assert.equal(withAlternative.dependencies[0].kind,'alternative')
  assert.equal(relationReviewDue(relation('one','google','service'),90),true)
  assert.equal(relationReviewDue({...relation('one','google','service'),manualReviewedAt:'2026-10-20T10:00:00Z'},90,Date.parse('2026-10-20T12:00:00Z')),false)
})

test('PostgreSQL map storage: additive setup, ownership, uniqueness, version protection and cascades', async(t)=>{
  const storage=await postgresStorage();const{pg}=storage
  let first:string,second:string,foreign:string,edgeId:string
  try{
    await pg.exec('CREATE TABLE connected_accounts(id uuid PRIMARY KEY,user_id text,provider text,email text,label text,created_at timestamptz DEFAULT now())')
    assert.equal((await readAccountMap('owner')).setupRequired,true)
    await initializeSecurityStorage()
    first=(await createSecurityAccount('owner',account)).id
    second=(await createSecurityAccount('owner',{...account,name:'Second account'})).id
    foreign=(await createSecurityAccount('foreign',account)).id
    await t.test('setup preserves existing accounts and is repeatable',async()=>{
      await initializeAccountMap();await initializeAccountMap()
      const result=await readAccountMap('owner');assert.equal(result.setupRequired,false);assert.equal(result.accounts.length,2);assert.equal(result.relations.length,0)
    })
    await t.test('only own distinct endpoints can be linked; duplicates of same directed type are refused',async()=>{
      const input:AccountRelationInput={fromAccountId:first,toAccountId:second,type:'login',loginDependency:'unknown',reviewed:false}
      await assert.rejects(createAccountRelation('owner',{...input,toAccountId:foreign}),(error:SecurityAccountError)=>error.status===409)
      await assert.rejects(createAccountRelation('foreign',input),(error:SecurityAccountError)=>error.status===409)
      edgeId=(await createAccountRelation('owner',input)).id
      await assert.rejects(createAccountRelation('owner',input),(error:SecurityAccountError)=>error.status===409)
      assert.equal((await readAccountMap('foreign')).relations.length,0)
      assert.equal((await readAccountMap('owner')).relations[0].manualReviewedAt,null)
      await createAccountRelation('owner',{...input,type:'recovery_email',loginDependency:null})
      assert.equal((await readAccountMap('owner')).relations.length,2)
    })
    await t.test('foreign updates/deletes and stale versions fail; editing invalidates previous review',async()=>{
      const input:AccountRelationInput={fromAccountId:first,toAccountId:second,type:'login',loginDependency:'only_known',reviewed:true}
      await assert.rejects(updateAccountRelation('foreign',edgeId,1,input),(error:SecurityAccountError)=>error.status===409)
      await assert.rejects(deleteAccountRelation('foreign',edgeId,1),(error:SecurityAccountError)=>error.status===409)
      await updateAccountRelation('owner',edgeId,1,input)
      let edge=(await readAccountMap('owner')).relations.find(x=>x.id===edgeId)!
      assert.equal(edge.version,2);assert.ok(edge.manualReviewedAt)
      await assert.rejects(updateAccountRelation('owner',edgeId,1,input),(error:SecurityAccountError)=>error.status===409)
      await assert.rejects(deleteAccountRelation('owner',edgeId,1),(error:SecurityAccountError)=>error.status===409)
      await assert.rejects(updateAccountRelation('owner',edgeId,2,{...input,toAccountId:foreign}),(error:SecurityAccountError)=>error.status===409)
      await updateAccountRelation('owner',edgeId,2,{...input,reviewed:false})
      edge=(await readAccountMap('owner')).relations.find(x=>x.id===edgeId)!
      assert.equal(edge.version,3);assert.equal(edge.manualReviewedAt,null)
    })
    await t.test('database constraints reject self edges and incorrect login semantics independently of API validation',async()=>{
      await assert.rejects(pg.query('INSERT INTO v2_account_relations(user_id,from_account_id,to_account_id,type,login_dependency) VALUES ($1,$2,$2,$3,$4)',['owner',first,'login','unknown']))
      await assert.rejects(pg.query('INSERT INTO v2_account_relations(user_id,from_account_id,to_account_id,type,login_dependency) VALUES ($1,$2,$3,$4,$5)',['owner',second,first,'recovery_email','only_known']))
    })
    await t.test('removing an edge preserves accounts; removing an account removes its relation records',async()=>{
      await deleteAccountRelation('owner',edgeId,3)
      assert.equal((await readAccountMap('owner')).accounts.length,2)
      assert.equal((await readAccountMap('owner')).relations.length,1)
      await deleteSecurityAccount('owner',first,1)
      const result=await readAccountMap('owner');assert.equal(result.accounts.length,1);assert.equal(result.relations.length,0)
      assert.equal((await readAccountMap('foreign')).accounts.length,1)
    })
    await t.test('capacity guard preserves 1000 existing relations and refuses an additional unique edge',async()=>{
      const {reviewed:_reviewed,connectedAccountId:_connection,...details}=account
      await pg.query('INSERT INTO v2_account_security(user_id,details) SELECT $1,$2::jsonb FROM generate_series(1,33)',['capacity-owner',JSON.stringify(details)])
      await pg.exec(`INSERT INTO v2_account_relations(user_id,from_account_id,to_account_id,type,login_dependency)
        SELECT 'capacity-owner',a.id,b.id,'login','unknown' FROM v2_account_security a,v2_account_security b
        WHERE a.user_id='capacity-owner' AND b.user_id='capacity-owner' AND a.id<>b.id LIMIT 1000`)
      const nodes=(await readAccountMap('capacity-owner')).accounts
      await assert.rejects(createAccountRelation('capacity-owner',{fromAccountId:nodes[0].id,toAccountId:nodes[1].id,type:'recovery_other',loginDependency:null,reviewed:false}),(error:SecurityAccountError)=>error.status===409)
      assert.equal((await readAccountMap('capacity-owner')).relations.length,1000)
    })
  }finally{await storage.close()}
})

test('map API derives ownership from authenticated session and rejects malformed payloads',async()=>{
  const calls:string[]=[];const app=new Hono()
  app.use('*',async(c,next)=>{c.set('userId','session-user');await next()})
  app.route('/',createAccountMapRoute({initializeAccountMap:async()=>{},readAccountMap:async(user)=>{calls.push(user);return{accounts:[],relations:[],setupRequired:false,accountsSetupRequired:false,checkedAt:new Date().toISOString()}},
    createAccountRelation:async(user)=>{calls.push(user);return{id:ids[2]}},updateAccountRelation:async(user,id)=>{calls.push(user);return{id}},deleteAccountRelation:async(user,id)=>{calls.push(user);return{id}}}))
  assert.equal((await app.request('/')).status,200)
  const body={fromAccountId:ids[0],toAccountId:ids[1],type:'login',loginDependency:'unknown',reviewed:false}
  assert.equal((await app.request('/',{method:'POST',body:JSON.stringify(body)})).status,201)
  assert.equal((await app.request('/',{method:'POST',body:JSON.stringify({...body,userId:'foreign'})})).status,400)
  assert.equal((await app.request('/',{method:'POST',body:JSON.stringify({...body,toAccountId:ids[0]})})).status,400)
  assert.equal((await app.request('/not-id',{method:'PUT',body:'{}'})).status,400)
  assert.ok(calls.every(x=>x==='session-user'))
  for(const[path,method]of[['/api/account-map','GET'],['/api/account-map/setup','POST'],[`/api/account-map/${ids[0]}`,'DELETE']])assert.equal((await createApp().request(path,{method})).status,401)
})
