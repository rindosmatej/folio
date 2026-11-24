import test from 'node:test';
import assert from 'node:assert/strict';
import {identity,currentIdentity} from '../api/auth.mjs';
process.env.FOLIO_ADMIN_AUTH_ID='admin-uuid';
process.env.SUPABASE_URL='https://example.test';
process.env.SUPABASE_ANON_KEY='sb_publishable_test';
const base={id:'teacher-uuid',email:'teacher@example.test',email_confirmed_at:'2026-01-01'};
test('role is derived only from confirmed UUID and server metadata',()=>{
 assert.equal(identity({...base,user_metadata:{folio_role:'admin'}}),null);
 assert.equal(identity({...base,app_metadata:{folio_role:'admin'}}),null);
 assert.equal(identity({...base,id:'admin-uuid'}).role,'admin');
 assert.equal(identity({...base,id:'admin-uuid',email_confirmed_at:null}),null);
 assert.deepEqual(identity({...base,app_metadata:{folio_role:'teacher',folio_subjects:['one']}}).subjects,['one']);
});
test('cookie is verified remotely; spoofed headers and invalid sessions do not authenticate',async()=>{
 assert.equal(await currentIdentity({headers:{'oai-authenticated-user-id':'admin-uuid'}}),null);
 const old=globalThis.fetch;
 try{globalThis.fetch=async(url,opts)=>{assert.equal(opts.headers.Authorization,'Bearer fake');return new Response('{}',{status:401})};assert.equal(await currentIdentity({headers:{cookie:'folio_session=fake'}}),null)}finally{globalThis.fetch=old}
});
