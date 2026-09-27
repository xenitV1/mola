// Local service entrypoint. Put behind HTTPS only after explicit deployment authorization.
import http from 'node:http';
import fs from 'node:fs/promises';
import {sign} from 'node:crypto';
import {createVerifier,PACKAGE,PRODUCT,NO_ADS_PRODUCT} from './verify.mjs';
import {createDiamondVerifier} from './diamonds.mjs';
import {createFileLedger} from './ledger.mjs';
import {billingListenOptions} from './listen.mjs';
const listenOptions=billingListenOptions();
const required=name=>{if(!process.env[name])throw Error(`${name} is required`);return process.env[name];};
const credentials=JSON.parse(await fs.readFile(required('CAFE_GOOGLE_SERVICE_ACCOUNT'),'utf8'));
const privateKey=await fs.readFile(required('CAFE_RECEIPT_PRIVATE_KEY'),'utf8');
const ledgerDir=required('CAFE_BILLING_LEDGER');await fs.mkdir(ledgerDir,{recursive:true,mode:0o700});
let authorization,expires=0;
async function auth(){
 if(authorization&&Date.now()<expires)return authorization;
 const at=Math.floor(Date.now()/1000),base64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const unsigned=base64({alg:'RS256',typ:'JWT'})+'.'+base64({iss:credentials.client_email,scope:'https://www.googleapis.com/auth/androidpublisher',aud:'https://oauth2.googleapis.com/token',iat:at,exp:at+3600});
 const assertion=unsigned+'.'+sign('RSA-SHA256',Buffer.from(unsigned),credentials.private_key).toString('base64url');
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(8000),redirect:'error'});
 if(!response.ok)throw Error('google_auth_unavailable');
 const result=await response.json();if(typeof result.access_token!=='string')throw Error('google_auth_unavailable');
 authorization=`Bearer ${result.access_token}`;expires=Date.now()+Math.max(0,Math.min(3300,result.expires_in-60))*1000;return authorization;
}
async function googleRequest(token,productId,operation=''){
 const endpoint=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/purchases/products/${productId}/tokens/${encodeURIComponent(token)}${operation?':'+operation:''}`;
 const response=await fetch(endpoint,{method:operation?'POST':'GET',headers:{Authorization:await auth(),'Content-Type':'application/json'},...(operation?{body:'{}'}:{}),signal:AbortSignal.timeout(8000),redirect:'error'});
 if(!operation&&(response.status===404||response.status===410))return {notFound:true};
 if(!response.ok){if(response.status===401)expires=0;throw Error('google_unavailable');}
 return operation?{}:response.json();
}
const ledger=createFileLedger(ledgerDir);
const verifierFor=productId=>createVerifier({productId,google:{get:(token,id)=>googleRequest(token,id),acknowledge:(token,id)=>googleRequest(token,id,'acknowledge')},ledger,privateKey});
const verifiers=new Map([['/v1/offline/verify',verifierFor(PRODUCT)],['/v1/no-ads/verify',verifierFor(NO_ADS_PRODUCT)]]);
verifiers.set('/v1/diamonds/verify',createDiamondVerifier({google:{get:(token,id)=>googleRequest(token,id),consume:(token,id)=>googleRequest(token,id,'consume')},ledger,privateKey}));
// Single-instance file ledger. A shared transactional database is required before running multiple replicas.
let active=0;
const server=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 if(req.method==='GET'&&req.url==='/health'){res.end('{"ok":true}');return;}
 if(req.method!=='POST'||!verifiers.has(req.url)){res.writeHead(404);res.end('{}');return;}
 if(active>=16){res.writeHead(503);res.end('{"error":"busy"}');return;}
 active++;
 try{
  let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>8192)throw Error('invalid_request');chunks.push(chunk);}
  const receipt=await verifiers.get(req.url)(JSON.parse(Buffer.concat(chunks).toString('utf8')));res.end(JSON.stringify(receipt));
 }catch(error){const code=error.message==='pending'?409:error.message==='invalid_request'||error instanceof SyntaxError?400:error.message==='invalid_purchase'?422:503;res.writeHead(code);res.end(JSON.stringify({error:code===409?'pending':code===400?'invalid_request':code===422?'invalid_purchase':'verification_unavailable'}));}
 finally{active--;}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(listenOptions,()=>console.log(`Billing verifier listening on ${listenOptions.host}:${listenOptions.port}; no purchase tokens are logged.`));
