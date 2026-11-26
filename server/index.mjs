import http from 'node:http'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { BANNED_CARD_COPY, CARD_PLANNER_SYSTEM_PROMPT, CONTEXT_ANALYST_SYSTEM_PROMPT, FULL_CHAT_CHUNK_SYSTEM_PROMPT, FULL_CHAT_SYNTHESIS_SYSTEM_PROMPT } from './aiPrompt.mjs'
import { createOpenAICardPlannerService } from './services/openaiCardPlanner.mjs'
import { createBachsService, isPaid } from './services/bachs.mjs'

const port = Number(process.env.PORT || 8787)
// Refuse to start on a typo: falling back to mock would hand out paid features for nothing.
if (process.env.VITE_PAYMENT_MODE && !['free','mock','bachs'].includes(process.env.VITE_PAYMENT_MODE)) throw new Error(`VITE_PAYMENT_MODE must be free, mock or bachs (got "${process.env.VITE_PAYMENT_MODE}")`)
const paymentMode = process.env.VITE_PAYMENT_MODE || 'mock'
const bachs = createBachsService()
const returnUrl = process.env.PAYMENT_RETURN_URL || 'https://chat-wrapped.kodedlabs.com/'
const dbPath = resolve(process.env.DATABASE_PATH || './data/chat-wrapped.sqlite')
mkdirSync(dirname(dbPath), { recursive: true })
const db = new DatabaseSync(dbPath)
const openAIPlanner = createOpenAICardPlannerService()
db.exec(`
  PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, ts TEXT, session_id TEXT, name TEXT, props TEXT, app_version TEXT, device TEXT, os TEXT, browser TEXT);
  CREATE TABLE IF NOT EXISTS errors(id INTEGER PRIMARY KEY, ts TEXT, session_id TEXT, code TEXT, message_short TEXT, stack_hash TEXT, step TEXT, app_version TEXT, count INTEGER DEFAULT 1);
  CREATE TABLE IF NOT EXISTS parse_runs(id INTEGER PRIMARY KEY, ts TEXT, session_id TEXT, format TEXT, clock TEXT, date_order TEXT, message_count INTEGER, member_count INTEGER, parse_ms INTEGER, file_kb INTEGER, skipped_pct REAL, unknown_pct REAL, language_hint TEXT, error_code TEXT);
  CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY, ts TEXT, reference TEXT UNIQUE, provider TEXT, channel TEXT, amount INTEGER, currency TEXT, status TEXT, email_hash TEXT, session_id TEXT);
  CREATE TABLE IF NOT EXISTS payment_log(id INTEGER PRIMARY KEY, ts TEXT, reference TEXT, step TEXT, ok INTEGER, detail TEXT);
  CREATE TABLE IF NOT EXISTS unlocks(id INTEGER PRIMARY KEY, ts TEXT, reference TEXT UNIQUE, session_id TEXT, granted_via TEXT);
  CREATE TABLE IF NOT EXISTS cards_generated(id INTEGER PRIMARY KEY, ts TEXT, session_id TEXT, layouts TEXT, fact_kinds TEXT, ai_tokens_in INTEGER, ai_tokens_out INTEGER, ai_cost_usd REAL);
  CREATE TABLE IF NOT EXISTS alerts(id INTEGER PRIMARY KEY, ts TEXT, type TEXT, detail TEXT, resolved INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS outreach(id INTEGER PRIMARY KEY, ts TEXT, posts INTEGER, dms INTEGER, replies INTEGER);
  CREATE TABLE IF NOT EXISTS payout_checklist(id INTEGER PRIMARY KEY, provider TEXT UNIQUE, payout_method TEXT, tested INTEGER DEFAULT 0, test_date TEXT);
`)
if(!db.prepare('PRAGMA table_info(payments)').all().some(column=>column.name==='product'))db.exec('ALTER TABLE payments ADD COLUMN product TEXT')
if(!db.prepare('PRAGMA table_info(payments)').all().some(column=>column.name==='provider_id'))db.exec('ALTER TABLE payments ADD COLUMN provider_id TEXT')

const insertEvent = db.prepare('INSERT INTO events(ts,session_id,name,props,app_version,device,os,browser) VALUES(?,?,?,?,?,?,?,?)')
const insertLog = db.prepare('INSERT INTO payment_log(ts,reference,step,ok,detail) VALUES(?,?,?,?,?)')
const rate = new Map()
const forbidden = /(?:\+?\d[\d\s().-]{7,}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/
const allowedEvents = new Set(['landing_view','chat_type_selected','export_guide_viewed','export_tab_switched','upload_started','upload_failed','parse_completed','parse_failed','story_viewed','card_viewed','paywall_viewed','checkout_opened','checkout_abandoned','payment_succeeded','payment_failed','unlock_confirmed','unlock_failed','recovery_started','recovery_succeeded','theme_changed','upgrade_clicked','card_shared','card_downloaded','hide_names_toggled','savage_toggled','referral_landing','support_clicked','error','timing'])
const prices = { everything: { NGN: 320000, USD: 399 }, theme: { NGN: 80000, USD: 99 }, font: { NGN: 80000, USD: 99 }, savage: { NGN: 80000, USD: 99 }, watermark: { NGN: 80000, USD: 99 }, awards: { NGN: 80000, USD: 99 } }

class HttpError extends Error { constructor(status,message){super(message);this.status=status} }
function json(res, status, value) { const body=JSON.stringify(value); res.writeHead(status, {'content-type':'application/json','content-length':Buffer.byteLength(body)}); res.end(body) }
function html(res, status, body) { res.writeHead(status, {'content-type':'text/html; charset=utf-8','content-length':Buffer.byteLength(body)}); res.end(body) }
function isFile(path) { return existsSync(path)&&statSync(path).isFile() }
const mimeTypes={'.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.svg':'image/svg+xml'}
function now() { return new Date().toISOString() }
function hash(value) { return createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex') }
// X-Forwarded-For is only meaningful when our own proxy appends it, and then only the last entry.
function clientIp(req) { const forwarded=process.env.TRUST_PROXY==='true'?String(req.headers['x-forwarded-for']||'').split(',').at(-1).trim():'';return forwarded||String(req.socket.remoteAddress||'') }
const aiLimits={requests:Number(process.env.AI_DAILY_PLAN_LIMIT||200),costUsd:Number(process.env.AI_DAILY_COST_CAP_USD||20),chatChars:Number(process.env.AI_MAX_CHAT_CHARS||4000000),concurrent:Number(process.env.AI_MAX_CONCURRENT||4)}
const aiUsage={day:'',requests:0,active:0}
// Free mode has no accounts, so a global ceiling is what bounds the bill.
async function withAiBudget(work) {
  const day=now().slice(0,10);if(aiUsage.day!==day){aiUsage.day=day;aiUsage.requests=0}
  const spent=Number(db.prepare('SELECT COALESCE(SUM(ai_cost_usd),0) total FROM cards_generated WHERE ts>=?').get(day)?.total||0)
  if(aiUsage.requests>=aiLimits.requests||spent>=aiLimits.costUsd){if(!db.prepare('SELECT id FROM alerts WHERE type=?').get(`ai_daily_cap_${day}`))alert(`ai_daily_cap_${day}`,`${aiUsage.requests} requests, $${spent.toFixed(2)}`);throw new HttpError(429,'A-429: AI planning has reached today\u2019s limit.')}
  if(aiUsage.active>=aiLimits.concurrent)throw new HttpError(429,'A-429: AI planning is busy. Try again shortly.')
  aiUsage.requests++;aiUsage.active++
  try{return await work()}finally{aiUsage.active--}
}
function allowed(req, bucket='default', limit=120) { if(rate.size>10000)for(const [key,value] of rate)if(Date.now()>value.until)rate.delete(key);const key=`${clientIp(req)}:${bucket}`; const current=rate.get(key) || {count:0,until:Date.now()+60000}; if(Date.now()>current.until){current.count=0;current.until=Date.now()+60000} current.count++;rate.set(key,current);return current.count<=limit }
function safeObject(input) { const output={}; if(!input||typeof input!=='object'||Array.isArray(input))return output; for(const [key,value] of Object.entries(input)){ if(!['string','number','boolean'].includes(typeof value)&&value!==null)continue; if(typeof value==='string'&&(value.length>40||forbidden.test(value)))continue; output[key.slice(0,40)]=value } return output }
function logPayment(reference,step,ok,detail='') { insertLog.run(now(),reference,step,ok?1:0,String(detail).slice(0,120)) }

async function body(req, raw=false, maxBytes=512000) { const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>maxBytes)throw new Error('body too large');chunks.push(chunk)}const buffer=Buffer.concat(chunks);return raw?buffer:JSON.parse(buffer.toString('utf8')||'{}') }
function adminOk(req,url) { const secret=process.env.ADMIN_SECRET,supplied=String(req.headers['x-admin-secret']||url.searchParams.get('key')||'');return Boolean(secret)&&timingSafeEqual(Buffer.from(hashExact(supplied)),Buffer.from(hashExact(secret))) }
function hashExact(value) { return createHash('sha256').update(value).digest('hex') }

async function notify(text) {
  if(!process.env.TELEGRAM_BOT_TOKEN||!process.env.TELEGRAM_CHAT_ID)return false
  const response=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,text:String(text).slice(0,4000)})})
  return response.ok
}
function alert(type,detail) { db.prepare('INSERT INTO alerts(ts,type,detail,resolved) VALUES(?,?,?,0)').run(now(),type,String(detail).slice(0,240));void notify(`Chat Wrapped alert\n${type}\n${String(detail).slice(0,500)}`) }
function checkCollectionCap() {
  const cap=Number(process.env.CAP_NGN||0);if(!cap)return
  const collected=Number(db.prepare("SELECT COALESCE(SUM(amount),0) total FROM payments WHERE status='success' AND currency='NGN'").get()?.total||0)/100
  for(const threshold of [70,85,95])if(collected>=cap*threshold/100&&!db.prepare("SELECT id FROM alerts WHERE type=?").get(`collection_cap_${threshold}`))alert(`collection_cap_${threshold}`,`₦${collected.toLocaleString()} of ₦${cap.toLocaleString()}`)
}

const aiLayouts=['bigNumber','leaderboard','versus','quote','timeline','award','wordCloud','heatmap','verdict']
const safeFactLabels={member_messages:'messages sent',message_share:'share of the chat',fast_reply:'average reply time in minutes',slow_reply:'average reply time in minutes',longest_silence:'longest silence in hours',conversation_starts:'conversations started',laugh_count:'laughs',hard_to_impress:'laughs',sorry_count:'apologies',night_activity:'messages after midnight',night_share:'share sent after midnight',media_dropper:'media messages marked omitted in the export',media_count:'total media messages marked omitted in the export',daily_presence:'messages per active day',starter_share:'share of conversations started',laugh_rate:'laughs per hundred messages',media_rate:'media placeholders per hundred messages',repeated_phrase:'times used',busiest_day:'messages on busiest day',total_words:'words',emoji_count:'emojis',verdict:'computed chat identity'}
function safeFactContext(context){if(!context||typeof context!=='object')return undefined;const numeric=['rank','outOf','gap','average','ratioToAverage','sharePct','activitySharePct','confidence','humourScore','visualScore'],safe={};for(const key of numeric){const value=Number(context[key]);if(Number.isFinite(value))safe[key]=Math.round(value*100)/100}if(['close','clear','wild'].includes(context.magnitude))safe.magnitude=context.magnitude;return safe}
const unsafeAiContext=/(?:https?:\/\/|www\.|\+?\d[\d\s().-]{7,}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:nude|nudes|sex|porn|suicide|kill yourself|rape)\b)/i
function shortSafeText(value,max=80){const text=String(value??'').replace(/\s+/g,' ').trim();return text&&!unsafeAiContext.test(text)?text.slice(0,max):undefined}
function safeFactsForAi(input,aiMode='facts-only') {
  if(!Array.isArray(input))throw new Error('A-501: Facts must be an array.')
  const memberAliases=new Map();let nextMember=1
  const quotesAllowed=aiMode==='with-quotes'
  return input.slice(0,60).map(fact=>{const id=String(fact?.id||'').slice(0,40),kind=String(fact?.kind||'').slice(0,40),memberIds=Array.isArray(fact?.memberIds)?fact.memberIds.slice(0,8).map(rawId=>{const key=String(rawId);if(!memberAliases.has(key))memberAliases.set(key,`member_${nextMember++}`);return memberAliases.get(key)}):[],numericValue=typeof fact?.value==='number'&&Number.isFinite(fact.value)?fact.value:undefined,isQuote=quotesAllowed&&kind==='topic_context',computedText=['repeated_phrase','top_emoji'].includes(kind)?shortSafeText(fact?.detail,40):kind==='verdict'?shortSafeText(`${fact?.value||''}. ${fact?.detail||''}`,160):isQuote?shortSafeText(fact?.detail,80):undefined,quote=isQuote?shortSafeText(fact?.sourceExcerpt,1600):undefined,availableTokens=[...(memberIds.length?['member']:[]),...(fact?.value!==undefined?['value']:[]),...(fact?.detail!==undefined?['detail']:[])];return {id,kind,memberIds,value:numericValue,label:safeFactLabels[kind]||kind.replaceAll('_',' '),computedText,quote,context:safeFactContext(fact?.context),availableTokens,surpriseScore:Math.max(0,Math.min(100,Number(fact?.surpriseScore||0))),safeQuote:Boolean(quote)}}).filter(fact=>fact.id&&fact.kind&&(quotesAllowed||fact.kind!=='topic_context')&&!['chat_label','explicit','harassment','health','religion','sexuality','ethnicity','finances','romance_group','quiet_member'].includes(fact.kind))
}
const comparableKinds=new Set(['member_messages','message_share','fast_reply','slow_reply','laugh_count','media_dropper','laugh_rate','media_rate'])
function layoutFitsFacts(layout,refs,factsById){const referenced=[...refs].map(id=>factsById.get(id)).filter(Boolean),kinds=new Set(referenced.map(fact=>fact.kind)),labels=new Set(referenced.map(fact=>fact.label));if(layout==='verdict')return referenced.some(fact=>fact.kind==='verdict');if(layout==='quote')return referenced.some(fact=>fact.safeQuote);if(layout==='wordCloud')return referenced.length>=2&&[...kinds].every(kind=>kind==='repeated_phrase');if(layout==='heatmap')return referenced.length===1&&['night_activity','night_share'].includes(referenced[0].kind);if(layout==='timeline')return referenced.length===1&&['slow_reply','longest_silence','busiest_day'].includes(referenced[0].kind);if(layout==='leaderboard'||layout==='versus')return referenced.length>=2&&(kinds.size===1||labels.size===1)&&referenced.every(fact=>comparableKinds.has(fact.kind)&&fact.memberIds.length);if(layout==='award')return referenced.length===1&&referenced[0].memberIds.length>0;if(layout==='bigNumber')return referenced.length>=1&&referenced.length<=4&&referenced.every(fact=>typeof fact.value==='number');return false}
function normalizeAiCardLayouts(cards,facts){const factsById=new Map(facts.map(fact=>[fact.id,fact]));return Array.isArray(cards)?cards.map(card=>{const refs=new Set(Array.isArray(card?.factIds)?card.factIds:[]);if(layoutFitsFacts(card?.layout,refs,factsById))return card;const referenced=[...refs].map(id=>factsById.get(id)).filter(Boolean),kinds=new Set(referenced.map(fact=>fact.kind)),labels=new Set(referenced.map(fact=>fact.label));let layout;if(referenced.some(fact=>fact.kind==='verdict'))layout='verdict';else if(referenced.some(fact=>fact.safeQuote))layout='quote';else if(referenced.length>=2&&[...kinds].every(kind=>kind==='repeated_phrase'))layout='wordCloud';else if(referenced.length>=2&&(kinds.size===1||labels.size===1)&&referenced.every(fact=>comparableKinds.has(fact.kind)&&fact.memberIds.length))layout=referenced.length===2?'versus':'leaderboard';else if(referenced.length===1&&['night_activity','night_share'].includes(referenced[0].kind))layout='heatmap';else if(referenced.length===1&&['slow_reply','longest_silence','busiest_day'].includes(referenced[0].kind))layout='timeline';else if(referenced.length===1&&referenced[0].memberIds.length)layout='award';else if(referenced.length>=1&&referenced.length<=4&&referenced.every(fact=>typeof fact.value==='number'))layout='bigNumber';return layout?{...card,layout}:card}):cards}
function validateAiCards(cards,facts) {
  const ids=new Set(facts.map(f=>f.id)),factsById=new Map(facts.map(f=>[f.id,f]));if(!Array.isArray(cards)||cards.length!==19)return false
  const verdictRequired=facts.some(fact=>fact.kind==='verdict');if(verdictRequired&&cards.at(-1)?.layout!=='verdict')return false
  return cards.every(card=>{const refs=new Set(Array.isArray(card.factIds)?card.factIds:[]),copy=`${card?.headline||''} ${card?.roast||''} ${card?.savageRoast||''}`,tokenMatches=[...copy.matchAll(/\{\{(member|value|detail):([^}]+)\}\}/g)],tokens=tokenMatches.map(match=>match[2]),tokensAllowed=tokenMatches.every(match=>factsById.get(match[2])?.availableTokens?.includes(match[1])),literalCopy=copy.replace(/\{\{[^}]+\}\}/g,'');return card&&typeof card.id==='string'&&aiLayouts.includes(card.layout)&&refs.size>0&&[...refs].every(id=>ids.has(id))&&tokens.length>0&&tokens.every(id=>refs.has(id))&&tokensAllowed&&layoutFitsFacts(card.layout,refs,factsById)&&!BANNED_CARD_COPY.test(copy)&&typeof card.headline==='string'&&typeof card.roast==='string'&&!/\d/.test(literalCopy)})
}
function aiValidationIssues(cards,facts){const ids=new Set(facts.map(f=>f.id)),factsById=new Map(facts.map(f=>[f.id,f])),issues=[];if(!Array.isArray(cards))return ['not_array'];if(cards.length!==19)issues.push(`card_count_${cards.length}`);cards.forEach((card,index)=>{const copy=`${card?.headline||''} ${card?.roast||''} ${card?.savageRoast||''}`,refs=new Set(Array.isArray(card?.factIds)?card.factIds:[]);if(!aiLayouts.includes(card?.layout))issues.push(`layout_${index}`);if(!Array.isArray(card?.factIds)||!card.factIds.length||card.factIds.some(id=>!ids.has(id)))issues.push(`fact_ids_${index}`);else if(!layoutFitsFacts(card.layout,refs,factsById))issues.push(`layout_grounding_${index}`);if(!/\{\{(?:member|value|detail):[^}]+\}\}/.test(copy))issues.push(`missing_token_${index}`);if(BANNED_CARD_COPY.test(copy))issues.push(`banned_copy_${index}`);if(typeof card?.headline!=='string'||/\d/.test(String(card?.headline||'').replace(/\{\{[^}]+\}\}/g,'')))issues.push(`headline_${index}`);if(typeof card?.roast!=='string'||/\d/.test(String(card?.roast||'').replace(/\{\{[^}]+\}\}/g,'')))issues.push(`roast_${index}`)});return issues.slice(0,12)}
async function enrichContextFacts(facts) {
  const contexts=facts.filter(fact=>fact.safeQuote&&fact.quote).slice(0,15)
  if(!contexts.length)return {facts,updates:[],semanticFacts:[],tokensIn:0,tokensOut:0,latencyMs:0}
  const findingKinds=['recurring_theme','running_joke','shared_habit','group_dynamic','memorable_moment']
  const schema={type:'object',additionalProperties:false,properties:{contexts:{type:'array',minItems:1,maxItems:15,items:{type:'object',additionalProperties:false,properties:{factId:{type:'string'},summary:{type:'string'}},required:['factId','summary']}},findings:{type:'array',minItems:0,maxItems:8,items:{type:'object',additionalProperties:false,properties:{sourceFactIds:{type:'array',minItems:1,maxItems:6,items:{type:'string'}},kind:{type:'string',enum:findingKinds},summary:{type:'string'},cardAngle:{type:'string'},surpriseScore:{type:'number'}},required:['sourceFactIds','kind','summary','cardAngle','surpriseScore']}}},required:['contexts','findings']}
  const prompt=`Analyse these conversation windows together. Explain each window, then identify the strongest specific patterns that recur across them.\n\nConversation windows: ${JSON.stringify(contexts.map(fact=>({factId:fact.id,period:fact.computedText,excerpt:fact.quote})))}`
  const generated=await openAIPlanner.generate({systemPrompt:CONTEXT_ANALYST_SYSTEM_PROMPT,prompt,schema})
  const allowedIds=new Set(contexts.map(fact=>fact.id)),updates=[]
  for(const item of generated.data?.contexts??[]){const id=String(item?.factId||''),summary=String(item?.summary||'').replace(/\s+/g,' ').trim();if(allowedIds.has(id)&&summary.length>=20&&summary.length<=220&&!/\d|\bPerson\b/i.test(summary)&&!unsafeAiContext.test(summary))updates.push({id,value:summary})}
  const byId=new Map(updates.map(item=>[item.id,item.value]))
  const semanticFacts=[]
  for(const item of generated.data?.findings??[]){const sources=[...new Set(Array.isArray(item?.sourceFactIds)?item.sourceFactIds.map(String).filter(id=>allowedIds.has(id)):[])].slice(0,6),kind=String(item?.kind||''),summary=String(item?.summary||'').replace(/\s+/g,' ').trim(),cardAngle=String(item?.cardAngle||'').replace(/\s+/g,' ').trim(),surpriseScore=Math.round(Math.max(0,Math.min(100,Number(item?.surpriseScore||0))));if(sources.length&&findingKinds.includes(kind)&&summary.length>=20&&summary.length<=220&&cardAngle.length>=8&&cardAngle.length<=140&&!/\d|\bPerson\b/i.test(`${summary} ${cardAngle}`)&&!unsafeAiContext.test(`${summary} ${cardAngle}`)){const id=`semantic_${semanticFacts.length}`;semanticFacts.push({id,kind,memberIds:[],value:summary,detail:cardAngle,surpriseScore,sourceFactIds:sources,label:kind.replaceAll('_',' '),computedText:summary,contextSummary:cardAngle,availableTokens:['value','detail'],safeQuote:true})}}
  const cleanFacts=facts.map(fact=>{const {quote,...rest}=fact;return byId.has(fact.id)?{...rest,contextSummary:byId.get(fact.id)}:rest})
  return {facts:[...cleanFacts,...semanticFacts],updates,semanticFacts,tokensIn:generated.tokensIn,tokensOut:generated.tokensOut,latencyMs:generated.latencyMs}
}
function safeChatChunks(input){if(!Array.isArray(input))return[];let total=0;const chunks=[];for(const item of input.slice(0,60)){const id=String(item?.id||'');const text=String(item?.text||'');if(!/^chunk_\d+$/.test(id)||!text||text.length>180000)continue;total+=text.length;if(total>aiLimits.chatChars)throw new Error('A-506: Full chat input exceeded the safety cap.');chunks.push({id,text})}return chunks}
async function analyseFullChat(chunks){
  if(!chunks.length)return {semanticFacts:[],tokensIn:0,tokensOut:0,latencyMs:0}
  const findingKinds=['recurring_theme','running_joke','shared_habit','group_dynamic','memorable_moment']
  const itemSchema={type:'object',additionalProperties:false,properties:{kind:{type:'string',enum:findingKinds},summary:{type:'string'},cardAngle:{type:'string'},surpriseScore:{type:'number'}},required:['kind','summary','cardAngle','surpriseScore']}
  const chunkSchema={type:'object',additionalProperties:false,properties:{findings:{type:'array',minItems:0,maxItems:8,items:itemSchema}},required:['findings']}
  const rawFindings=[];let tokensIn=0,tokensOut=0,latencyMs=0,failedChunks=0
  for(let start=0;start<chunks.length;start+=3){const batch=chunks.slice(start,start+3);const results=await Promise.allSettled(batch.map(chunk=>openAIPlanner.generate({systemPrompt:FULL_CHAT_CHUNK_SYSTEM_PROMPT,prompt:`Read this chronological chat part and return only grounded findings.\n\n${chunk.text}`,schema:chunkSchema})));results.forEach((result,index)=>{if(result.status==='rejected'){failedChunks++;console.error(result.reason);return}const generated=result.value;tokensIn+=generated.tokensIn;tokensOut+=generated.tokensOut;latencyMs=Math.max(latencyMs,generated.latencyMs);for(const finding of generated.data?.findings??[]){const summary=String(finding?.summary||'').replace(/\s+/g,' ').trim(),cardAngle=String(finding?.cardAngle||'').replace(/\s+/g,' ').trim(),kind=String(finding?.kind||'');if(findingKinds.includes(kind)&&summary.length>=20&&summary.length<=220&&cardAngle.length>=8&&cardAngle.length<=140&&!/\d|\bPerson\b/i.test(`${summary} ${cardAngle}`)&&!unsafeAiContext.test(`${summary} ${cardAngle}`))rawFindings.push({chunkId:batch[index].id,kind,summary,cardAngle,surpriseScore:Math.round(Math.max(0,Math.min(100,Number(finding?.surpriseScore||0))))})}})}
  // One bad part should not throw away the rest, but a total failure is a failure.
  if(failedChunks===chunks.length)throw new Error('A-507: AI could not read any part of the chat.')
  if(failedChunks)alert('ai_partial_chat',`${failedChunks} of ${chunks.length} parts failed`)
  if(!rawFindings.length)return {semanticFacts:[],tokensIn,tokensOut,latencyMs}
  const synthesisItem={type:'object',additionalProperties:false,properties:{sourceChunkIds:{type:'array',minItems:1,maxItems:12,items:{type:'string'}},kind:{type:'string',enum:findingKinds},summary:{type:'string'},cardAngle:{type:'string'},surpriseScore:{type:'number'}},required:['sourceChunkIds','kind','summary','cardAngle','surpriseScore']}
  const synthesisSchema={type:'object',additionalProperties:false,properties:{findings:{type:'array',minItems:8,maxItems:18,items:synthesisItem}},required:['findings']}
  const synthesis=await openAIPlanner.generate({systemPrompt:FULL_CHAT_SYNTHESIS_SYSTEM_PROMPT,prompt:`Synthesize these findings from the full export.\n\n${JSON.stringify(rawFindings)}`,schema:synthesisSchema});tokensIn+=synthesis.tokensIn;tokensOut+=synthesis.tokensOut;latencyMs+=synthesis.latencyMs
  const allowedChunks=new Set(chunks.map(chunk=>chunk.id)),semanticFacts=[]
  for(const item of synthesis.data?.findings??[]){const sources=[...new Set(Array.isArray(item?.sourceChunkIds)?item.sourceChunkIds.map(String).filter(id=>allowedChunks.has(id)):[])],kind=String(item?.kind||''),summary=String(item?.summary||'').replace(/\s+/g,' ').trim(),cardAngle=String(item?.cardAngle||'').replace(/\s+/g,' ').trim(),surpriseScore=Math.round(Math.max(0,Math.min(100,Number(item?.surpriseScore||0))));if(sources.length&&findingKinds.includes(kind)&&summary.length>=20&&summary.length<=220&&cardAngle.length>=8&&cardAngle.length<=140&&!/\d|\bPerson\b/i.test(`${summary} ${cardAngle}`)&&!unsafeAiContext.test(`${summary} ${cardAngle}`)){const id=`semantic_${semanticFacts.length}`;semanticFacts.push({id,kind,memberIds:[],value:summary,detail:cardAngle,surpriseScore,sourceChunkIds:sources,label:kind.replaceAll('_',' '),computedText:summary,contextSummary:cardAngle,availableTokens:['value','detail'],safeQuote:true})}}
  return {semanticFacts,tokensIn,tokensOut,latencyMs}
}
async function planWithOpenAI(payload) {
  const sessionId=String(payload.sessionId||'').slice(0,60)
  const aiMode=payload.aiMode==='with-quotes'?'with-quotes':'facts-only',safeFacts=safeFactsForAi(payload.facts,aiMode),chatChunks=aiMode==='with-quotes'?safeChatChunks(payload.chatChunks):[]
  let enriched
  if(chatChunks.length){
    const [full,timeline]=await Promise.all([analyseFullChat(chatChunks),enrichContextFacts(safeFacts)])
    const timelineById=new Map(timeline.updates.map(item=>[item.id,item.value]))
    const groundedFacts=safeFacts.map(fact=>{const{quote,...rest}=fact;return timelineById.has(fact.id)?{...rest,contextSummary:timelineById.get(fact.id)}:rest})
    enriched={facts:[...groundedFacts,...full.semanticFacts],updates:timeline.updates,semanticFacts:full.semanticFacts,tokensIn:full.tokensIn+timeline.tokensIn,tokensOut:full.tokensOut+timeline.tokensOut,latencyMs:Math.max(full.latencyMs,timeline.latencyMs)}
  }else enriched=await enrichContextFacts(safeFacts)
  const facts=enriched.facts
  const cardSchema={type:'object',additionalProperties:false,properties:{id:{type:'string'},layout:{type:'string',enum:aiLayouts},factIds:{type:'array',minItems:1,items:{type:'string'}},headline:{type:'string'},roast:{type:'string'},savageRoast:{type:['string','null']}},required:['id','layout','factIds','headline','roast','savageRoast']}
  const schema={type:'object',additionalProperties:false,properties:{cards:{type:'array',minItems:19,maxItems:19,items:cardSchema}},required:['cards']}
  const prompt=`Build the story from these computed facts. Return only the cards.\n\nFacts: ${JSON.stringify(facts)}`
  const plannerInputCap=Math.max(24000,Number(process.env.OPENAI_PLANNER_INPUT_CHAR_CAP||120000))
  if(prompt.length>plannerInputCap)throw new Error('A-502: AI input exceeded the safety cap.')
  const generated=await openAIPlanner.generate({systemPrompt:CARD_PLANNER_SYSTEM_PROMPT,prompt,schema})
  const cards=normalizeAiCardLayouts(generated.cards,facts),tokensIn=generated.tokensIn+enriched.tokensIn,tokensOut=generated.tokensOut+enriched.tokensOut,latencyMs=generated.latencyMs+enriched.latencyMs,valid=validateAiCards(cards,facts)
  const cost=tokensIn/1e6*Number(process.env.OPENAI_INPUT_USD_PER_MILLION||4)+tokensOut/1e6*Number(process.env.OPENAI_OUTPUT_USD_PER_MILLION||20)
  db.prepare('INSERT INTO cards_generated(ts,session_id,layouts,fact_kinds,ai_tokens_in,ai_tokens_out,ai_cost_usd) VALUES(?,?,?,?,?,?,?)').run(now(),sessionId,JSON.stringify(valid?cards.map(c=>c.layout):[]),JSON.stringify([...new Set(facts.map(f=>f.kind))]),tokensIn,tokensOut,cost)
  const clientSemanticFacts=enriched.semanticFacts.map(({sourceFactIds,sourceChunkIds,label,computedText,contextSummary,availableTokens,safeQuote,...fact})=>fact)
  if(!valid){const validationIssues=aiValidationIssues(cards,facts);alert('ai_validation_failure',`session ${hash(sessionId).slice(0,12)} ${validationIssues.join(',')}`);return {cards:[],contextUpdates:enriched.updates,semanticFacts:clientSemanticFacts,fallback:true,validationIssues,tokensIn,tokensOut,latencyMs,model:generated.model}}
  return {cards:cards.map((card,index)=>({...card,savageRoast:card.savageRoast||undefined,id:`ai_${index}_${String(card.id).replace(/[^a-z0-9_-]/gi,'').slice(0,24)}`,locked:false})),contextUpdates:enriched.updates,semanticFacts:clientSemanticFacts,fallback:false,tokensIn,tokensOut,latencyMs,model:generated.model}
}

function collector(events) {
  if(!Array.isArray(events)||events.length>100)throw new Error('invalid batch')
  db.exec('BEGIN')
  try { for(const event of events){if(!event||!allowedEvents.has(event.name)||typeof event.sessionId!=='string'||event.sessionId.length>40)continue;const props=safeObject(event.props),ctx=safeObject(event.context);insertEvent.run(String(event.ts).slice(0,32),event.sessionId,event.name,JSON.stringify(props),String(ctx.appVersion||''),String(ctx.device||''),String(ctx.os||''),String(ctx.browser||''));if(event.name==='error'){const code=String(props.code||'U-500');const existing=db.prepare('SELECT id,count FROM errors WHERE code=? AND step=? AND app_version=?').get(code,String(props.step||ctx.step||''),String(ctx.appVersion||''));if(existing)db.prepare('UPDATE errors SET count=count+1,ts=? WHERE id=?').run(now(),existing.id);else db.prepare('INSERT INTO errors(ts,session_id,code,message_short,stack_hash,step,app_version,count) VALUES(?,?,?,?,?,?,?,1)').run(now(),event.sessionId,code,String(props.message||'').slice(0,40),String(props.stackHash||''),String(props.step||ctx.step||''),String(ctx.appVersion||''))}if(event.name==='parse_completed')db.prepare('INSERT INTO parse_runs(ts,session_id,format,clock,date_order,message_count,member_count,parse_ms,file_kb,unknown_pct,language_hint) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(now(),event.sessionId,String(props.format||''),String(props.clock||''),String(props.dateOrder||''),Number(props.messageCount||0),Number(props.memberCount||0),Number(props.parseMs||0),Number(props.fileKb||0),Number(props.unknownPct||0),String(props.languageHint||''))} db.exec('COMMIT') } catch(error) { db.exec('ROLLBACK'); throw error }
}

async function initPayment(payload) {
  if(paymentMode==='free')throw new Error('C-300: Payments are disabled during free launch.')
  if(paymentMode==='bachs'&&!bachs.configured)throw new Error('C-307: Bachs is enabled but BACHS_SECRET_KEY is missing.')
  const product=String(payload.product||''),currency=String(payload.currency||'NGN').toUpperCase()
  if(!Object.hasOwn(prices,product)||!prices[product][currency])throw new Error('unsupported price')
  if(currency==='USD'){const check=db.prepare("SELECT tested FROM payout_checklist WHERE provider='international'").get();if(process.env.USD_CHECKOUT_ENABLED!=='true'||!check?.tested)throw new Error('C-306: USD checkout is disabled until a Nigeria payout test is recorded.')}
  const amount=prices[product][currency],reference=`cw_${Date.now()}_${randomUUID().replaceAll('-','').slice(0,20)}`,email=String(payload.email||'')
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('C-302: Enter a valid payment email.')
  const provider=paymentMode==='bachs'?'bachs':'mock'
  db.prepare('INSERT INTO payments(ts,reference,provider,channel,amount,currency,status,email_hash,session_id,product) VALUES(?,?,?,?,?,?,?,?,?,?)').run(now(),reference,provider,'hosted',amount,currency,'initialized',hash(email),String(payload.sessionId||'').slice(0,60),product);logPayment(reference,'checkout_init',true,product)
  if(provider==='mock')return {reference,mock:true}
  try{
    const checkout=await bachs.createCheckout({reference,product,amountSubunits:amount,currency,email,successUrl:returnUrl,cancelUrl:returnUrl})
    db.prepare('UPDATE payments SET provider_id=? WHERE reference=?').run(checkout.checkoutId,reference);logPayment(reference,'provider_init',true)
    return {reference,mock:false,checkoutUrl:checkout.checkoutUrl}
  }catch(error){logPayment(reference,'provider_init',false,error.message);throw new Error('C-303: Payment provider could not start checkout.')}
}

function grantUnlock(reference,sessionId,via) { const existing=db.prepare('SELECT reference FROM unlocks WHERE reference=?').get(reference);if(existing){logPayment(reference,'duplicate_ignored',true);return false}db.prepare('INSERT INTO unlocks(ts,reference,session_id,granted_via) VALUES(?,?,?,?)').run(now(),reference,sessionId,via);logPayment(reference,'unlock_granted',true,via);return true }
// The checkout as Bachs reports it is the only thing that marks a payment successful.
function settle(payment,session) {
  if(!isPaid(session))return 'pending'
  const matches=session.reference===payment.reference&&Math.round(Number(session.amount)*100)===payment.amount&&session.currency===payment.currency
  logPayment(payment.reference,matches?'amount_matched':'amount_mismatch',matches)
  if(!matches){alert('payment_amount_mismatch',payment.reference);return 'mismatch'}
  if(payment.status!=='success'){db.prepare("UPDATE payments SET status='success' WHERE reference=?").run(payment.reference);checkCollectionCap()}
  grantUnlock(payment.reference,payment.session_id,'webhook')
  return 'paid'
}
const findPayment=(id)=>db.prepare('SELECT * FROM payments WHERE reference=? OR provider_id=?').get(id,id)
async function handleWebhook(req) {
  const raw=await body(req,true)
  if(!bachs.verifyWebhook(raw,req.headers)){const type=`webhook_invalid_signature_${now().slice(0,10)}`;if(!db.prepare('SELECT id FROM alerts WHERE type=?').get(type))alert(type,'rejected a delivery');throw new HttpError(400,'invalid_signature')}
  const event=JSON.parse(raw.toString('utf8')||'{}')
  if(!['checkout.completed','collection.succeeded'].includes(event.type))return
  const checkoutId=String(event.data?.checkout_id||''),payment=findPayment(checkoutId)||findPayment(String(event.data?.reference||''))
  if(!payment){logPayment(checkoutId,'webhook_unknown_payment',false);return}
  logPayment(payment.reference,'webhook_received',true,event.type)
  // Anything but a clean answer from Bachs returns 5xx, so the delivery is retried.
  let outcome
  try{outcome=settle(payment,await bachs.getCheckout(payment.provider_id||checkoutId))}catch(error){console.error(error);throw new HttpError(502,'lookup_failed')}
  if(outcome==='pending')throw new HttpError(503,'not_completed_yet')
}

const maxRecoveries=Number(process.env.MAX_RECOVERIES_PER_REFERENCE||5)
// "core" was the old full-story unlock. The story is free now, so those buyers get everything.
function productFor(payment) { if(payment.product==='core')return 'everything';return Object.hasOwn(prices,payment.product||'')?payment.product:undefined }
async function recoverPayment(payload) {
  const id=String(payload.reference||'').trim().slice(0,80),sessionId=String(payload.sessionId||'').slice(0,60)
  let payment=id?findPayment(id):undefined
  // The browser can get back before the webhook lands, so ask Bachs directly.
  if(paymentMode==='bachs'&&bachs.configured&&payment?.status!=='success'){
    const checkoutId=payment?.provider_id||(id.startsWith('chk_')?id:'')
    const session=checkoutId?await bachs.getCheckout(checkoutId):null
    if(session){
      // Restores a paid checkout even if this database was lost.
      const product=String(session.metadata?.product||'')
      if(!payment&&isPaid(session)&&Object.hasOwn(prices,product)&&prices[product][session.currency])db.prepare('INSERT INTO payments(ts,reference,provider,channel,amount,currency,status,email_hash,session_id,product,provider_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(now(),String(session.reference),'bachs','hosted',prices[product][session.currency],session.currency,'initialized',hash(session.customer?.email||''),sessionId,product,checkoutId)
      payment=findPayment(checkoutId)||payment
      if(payment){settle(payment,session);payment=findPayment(payment.reference)}
    }
  }
  const product=payment?.status==='success'?productFor(payment):undefined
  if(!product)throw new HttpError(404,'K-401: No successful payment matched that reference.')
  const reference=payment.reference
  const unlock=db.prepare('SELECT session_id FROM unlocks WHERE reference=?').get(reference)
  if(!unlock)grantUnlock(reference,sessionId||payment.session_id,'recovery')
  else if(sessionId&&unlock.session_id!==sessionId){
    const used=Number(db.prepare("SELECT COUNT(*) n FROM payment_log WHERE reference=? AND step='moved'").get(reference).n)
    if(used>=maxRecoveries)throw new HttpError(403,'K-403: This reference has been restored too many times. Contact support.')
    db.prepare('UPDATE unlocks SET session_id=? WHERE reference=?').run(sessionId,reference);logPayment(reference,'moved',true)
  }
  return {ok:true,reference,product}
}

function summary() {
  const count=(name)=>Number(db.prepare('SELECT COUNT(DISTINCT session_id) n FROM events WHERE name=?').get(name)?.n||0)
  const payments=db.prepare("SELECT currency,SUM(amount) amount,COUNT(*) buyers FROM payments WHERE status='success' GROUP BY currency").all()
  return {funnel:['landing_view','upload_started','parse_completed','paywall_viewed','checkout_opened','payment_succeeded','card_shared'].map(name=>({name,count:count(name)})),payments,channels:db.prepare("SELECT channel,COUNT(*) attempts,SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) successes FROM payments GROUP BY channel").all(),errors:db.prepare('SELECT code,SUM(count) count FROM errors GROUP BY code ORDER BY count DESC LIMIT 10').all(),alerts:db.prepare('SELECT * FROM alerts WHERE resolved=0 ORDER BY id DESC LIMIT 10').all(),parsing:db.prepare('SELECT format,clock,date_order,COUNT(*) runs,ROUND(AVG(parse_ms)) avg_ms,ROUND(AVG(unknown_pct),1) unknown_pct FROM parse_runs GROUP BY format,clock,date_order ORDER BY runs DESC').all(),cards:db.prepare('SELECT layouts,fact_kinds,COUNT(*) runs,ROUND(AVG(ai_cost_usd),4) avg_cost,SUM(ai_tokens_in+ai_tokens_out) tokens FROM cards_generated GROUP BY layouts,fact_kinds ORDER BY runs DESC LIMIT 20').all(),outreach:db.prepare('SELECT COALESCE(SUM(posts),0) posts,COALESCE(SUM(dms),0) dms,COALESCE(SUM(replies),0) replies FROM outreach').get(),paidLocked:Number(db.prepare("SELECT COUNT(*) n FROM payments p LEFT JOIN unlocks u ON p.reference=u.reference WHERE p.status='success' AND u.reference IS NULL").get()?.n||0)}
}

function adminPage(key,page='overview') {
  const data=summary(),nav=['overview','funnel','errors','parsing','payments','cards','alerts']
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));const table=(rows)=>`<table>${rows.map((row,i)=>`<tr>${Object.values(row).map(value=>`<${i?'td':'th'}>${esc(value)}</${i?'td':'th'}>`).join('')}</tr>`).join('')}</table>`
  let content=''
  const buyers=data.payments.reduce((n,p)=>n+Number(p.buyers),0),revenueNgn=data.payments.filter(p=>p.currency==='NGN').reduce((n,p)=>n+Number(p.amount)/100,0),midLaunch=process.env.MID_LAUNCH_DATE?new Date(process.env.MID_LAUNCH_DATE):null,freeze=Boolean(midLaunch&&Date.now()>=midLaunch.getTime()&&buyers<20)
  if(page==='overview')content=`${freeze?'<div class="banner">Feature freeze: fix preview and outreach</div>':''}<h1>Launch room</h1><p>Private operational data only—no chat text or names.</p><div class="numbers"><b>${data.funnel[0].count}<small>visits</small></b><b>${buyers}<small>buyers</small></b><b>${data.paidLocked}<small>paid but locked</small></b><b>₦${revenueNgn.toLocaleString()}<small>collected</small></b></div>${table([['Step','Sessions'],...data.funnel.map(x=>[x.name,x.count])])}<h2>Outreach</h2><p>${data.outreach.posts} posts · ${data.outreach.dms} DMs · ${data.outreach.replies} replies</p><form method="post" action="/admin/outreach?key=${encodeURIComponent(key)}"><input name="posts" type="number" min="0" placeholder="Posts"><input name="dms" type="number" min="0" placeholder="DMs"><input name="replies" type="number" min="0" placeholder="Replies"><button>Record today</button></form>`
  else if(page==='funnel')content=`<h1>Funnel</h1>${table([['Step','Sessions'],...data.funnel.map(x=>[x.name,x.count])])}`
  else if(page==='errors')content=`<h1>Errors</h1>${table([['Code','Count'],...data.errors.map(x=>[x.code,x.count])])}`
  else if(page==='parsing')content=`<h1>Parsing</h1>${table([['Format','Clock','Date order','Runs','Average ms','Unknown %'],...data.parsing.map(x=>Object.values(x))])}`
  else if(page==='payments'){const cap=Number(process.env.CAP_NGN||0),collected=data.payments.filter(p=>p.currency==='NGN').reduce((n,p)=>n+Number(p.amount)/100,0);content=`<h1>Payments</h1><p>Configured cap: ₦${cap.toLocaleString()} · remaining: ₦${Math.max(0,cap-collected).toLocaleString()}</p>${table([['Currency','Subunits','Buyers'],...data.payments.map(x=>[x.currency,x.amount,x.buyers])])}<h2>Channels</h2>${table([['Channel','Attempts','Successes'],...data.channels.map(x=>Object.values(x))])}<h2>International payout checklist</h2><form method="post" action="/admin/payout?key=${encodeURIComponent(key)}"><input name="method" placeholder="Payout method"><input name="date" type="date"><label><input name="tested" type="checkbox" value="1"> Tested to Nigeria</label><button>Save checklist</button></form>`}
  else if(page==='cards')content=`<h1>Cards</h1><p>AI generations, layout sequences, fact kinds, tokens and estimated cost.</p>${table([['Layouts','Fact kinds','Runs','Average cost','Tokens'],...data.cards.map(x=>Object.values(x))])}`
  else if(page==='alerts')content=`<h1>Alerts</h1>${table([['Type','Detail','Time'],...data.alerts.map(x=>[x.type,x.detail,x.ts])])}`
  else content=`<h1>${page[0].toUpperCase()+page.slice(1)}</h1><p>Data appears after full test runs.</p>`
  return `<!doctype html><meta name="viewport" content="width=device-width"><title>Chat Wrapped Admin</title><style>body{margin:0;font:15px system-ui;background:#17100e;color:#f8eee0;display:grid;grid-template-columns:220px 1fr;min-height:100vh}nav{padding:28px;background:#241915}nav b{display:block;font-size:20px;margin-bottom:25px}nav a{display:block;color:#cdbab1;padding:9px 0;text-decoration:none}main{padding:40px;max-width:1000px}h1{font-size:48px;margin:0 0 12px}.banner{padding:14px;background:#ffe45c;color:#21130f;font-weight:800}.numbers{display:flex;gap:12px;margin:30px 0;flex-wrap:wrap}.numbers b{background:#ff6544;color:#21130f;padding:20px;border-radius:14px;font-size:34px;min-width:130px}.numbers small{display:block;font-size:12px}table{border-collapse:collapse;width:100%;background:#241915;border-radius:14px;overflow:hidden}td,th{padding:12px;text-align:left;border-bottom:1px solid #43312a}form{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 30px}input,button{min-height:40px;padding:0 12px;border:0;border-radius:8px}button{background:#ff6544;font-weight:800}@media(max-width:700px){body{grid-template-columns:1fr}nav{display:flex;overflow:auto;gap:16px}nav b{display:none}nav a{white-space:nowrap}main{padding:24px}.numbers{flex-wrap:wrap}}</style><nav><b>Chat Wrapped</b>${nav.map(item=>`<a href="/admin?key=${encodeURIComponent(key)}&page=${item}">${item}</a>`).join('')}</nav><main>${content}</main>`
}

async function dailySummary() { const data=summary(),revenue=data.payments.map(p=>`${p.currency} ${Number(p.amount)/100}`).join(', ')||'0',uploads=data.funnel[1].count,parsed=data.funnel[2].count,referrals=Number(db.prepare("SELECT COUNT(DISTINCT session_id) n FROM events WHERE name='referral_landing'").get()?.n||0),aiSpend=Number(db.prepare('SELECT COALESCE(SUM(ai_cost_usd),0) total FROM cards_generated').get()?.total||0),topErrors=data.errors.slice(0,3).map(row=>`${row.code}:${row.count}`).join(', ')||'none',midLaunch=process.env.MID_LAUNCH_DATE?new Date(process.env.MID_LAUNCH_DATE):null,buyers=data.payments.reduce((n,p)=>n+Number(p.buyers),0),freeze=Boolean(midLaunch&&Date.now()>=midLaunch.getTime()&&buyers<20);const text=`Daily summary\nVisits ${data.funnel[0].count}\nUploads ${uploads}\nParse success ${uploads?Math.round(parsed/uploads*100):0}%\nPaywall views ${data.funnel[3].count}\nPurchases ${data.funnel[5].count}\nRevenue ${revenue}\nErrors ${topErrors}\nShares ${data.funnel[6].count}\nReferral landings ${referrals}\nPaid but locked ${data.paidLocked}\nAI spend $${aiSpend.toFixed(4)}${freeze?'\nFeature freeze: fix preview and outreach':''}`;await notify(text);return text }
setInterval(()=>{const date=new Date();if(date.getHours()===8&&date.getMinutes()<5)void dailySummary()},5*60*1000).unref()

const server=http.createServer(async(req,res)=>{
  try {
    // The Host header is attacker-controlled, so never build the URL from it.
    const url=new URL(req.url||'/','http://localhost')
    if((url.pathname.startsWith('/admin')||url.pathname.startsWith('/api/jobs/')||url.pathname==='/api/outreach')&&!allowed(req,'admin',60))return json(res,429,{error:'rate_limited'})
    if((url.pathname==='/api/report'||url.pathname==='/api/privacy/delete')&&!allowed(req,'support',10))return json(res,429,{error:'rate_limited'})
    if(url.pathname==='/api/health')return json(res,200,{ok:true,db:true,paymentMode,bachs:paymentMode==='bachs'&&bachs.configured,openai:Boolean(process.env.OPENAI_API_KEY),bachsWebhook:bachs.webhookConfigured,telegram:Boolean(process.env.TELEGRAM_BOT_TOKEN)})
    if(url.pathname==='/api/collect'&&req.method==='POST'){if(!allowed(req,'collect',240))return json(res,429,{error:'rate_limited'});collector((await body(req)).events);return json(res,202,{accepted:true})}
    if(url.pathname==='/api/payments/init'&&req.method==='POST'){if(!allowed(req,'pay',20))return json(res,429,{error:'rate_limited'});return json(res,200,await initPayment(await body(req)))}
    if(url.pathname==='/api/payments/mock-complete'&&req.method==='POST'){if(paymentMode!=='mock')return json(res,404,{error:'not_found'});const payload=await body(req),payment=db.prepare("SELECT * FROM payments WHERE reference=? AND provider='mock'").get(String(payload.reference));if(!payment)return json(res,404,{error:'C-304'});if(payment.status!=='success'){db.prepare("UPDATE payments SET status='success' WHERE reference=?").run(payment.reference);logPayment(payment.reference,'mock_payment_succeeded',true);checkCollectionCap()}grantUnlock(payment.reference,payment.session_id,'webhook');return json(res,200,{ok:true,reference:payment.reference})}
    if(url.pathname==='/api/payments/webhook'&&req.method==='POST'){if(paymentMode!=='bachs')return json(res,404,{error:'not_found'});await handleWebhook(req);return json(res,200,{ok:true})}
    if(url.pathname==='/api/payments/recover'&&req.method==='POST'){if(paymentMode==='free')return json(res,404,{error:'not_found'});if(!allowed(req,'recover',10))return json(res,429,{error:'rate_limited'});return json(res,200,await recoverPayment(await body(req)))}
    if(url.pathname==='/api/cards/plan'&&req.method==='POST'){if(!allowed(req,'ai',8))return json(res,429,{error:'rate_limited'});const payload=await body(req,false,8000000);return json(res,200,await withAiBudget(()=>planWithOpenAI(payload)))}
    if(url.pathname==='/api/report'&&req.method==='POST'){const payload=await body(req),code=String(payload.code||'U-500').slice(0,10),sessionId=String(payload.sessionId||'').slice(0,40);if(!/^[A-Z]-\d{3}$/.test(code)||!sessionId)return json(res,400,{error:'invalid_report'});db.prepare('INSERT INTO errors(ts,session_id,code,message_short,stack_hash,step,app_version,count) VALUES(?,?,?,?,?,?,?,1)').run(now(),sessionId,code,'user_report','','support','');return json(res,201,{ok:true})}
    if(url.pathname==='/api/privacy/delete'&&req.method==='POST'){const payload=await body(req),reference=String(payload.reference||''),email=String(payload.email||''),payment=db.prepare('SELECT email_hash FROM payments WHERE reference=?').get(reference);if(!payment||payment.email_hash!==hash(email))return json(res,404,{error:'D-404'});db.exec('BEGIN');try{db.prepare('DELETE FROM payment_log WHERE reference=?').run(reference);db.prepare('DELETE FROM unlocks WHERE reference=?').run(reference);db.prepare('DELETE FROM payments WHERE reference=?').run(reference);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}return json(res,200,{ok:true})}
    if(url.pathname==='/api/jobs/reconcile'&&req.method==='POST'){if(!adminOk(req,url))return json(res,401,{error:'unauthorized'});const paidLocked=db.prepare("SELECT p.reference FROM payments p LEFT JOIN unlocks u ON p.reference=u.reference WHERE p.status='success' AND u.reference IS NULL").all();const unlockedUnpaid=db.prepare("SELECT u.reference FROM unlocks u LEFT JOIN payments p ON p.reference=u.reference WHERE p.status!='success' OR p.reference IS NULL").all();return json(res,200,{paidLocked,unlockedUnpaid})}
    if(url.pathname==='/api/jobs/daily-summary'&&req.method==='POST'){if(!adminOk(req,url))return json(res,401,{error:'unauthorized'});return json(res,200,{sent:await dailySummary()})}
    if(url.pathname==='/api/outreach'&&req.method==='POST'){if(!adminOk(req,url))return json(res,401,{error:'unauthorized'});const p=await body(req);db.prepare('INSERT INTO outreach(ts,posts,dms,replies) VALUES(?,?,?,?)').run(now(),Number(p.posts||0),Number(p.dms||0),Number(p.replies||0));return json(res,201,{ok:true})}
    if(url.pathname==='/admin/outreach'&&req.method==='POST'){if(!adminOk(req,url))return html(res,401,'<h1>Admin access required</h1>');const form=new URLSearchParams((await body(req,true)).toString());db.prepare('INSERT INTO outreach(ts,posts,dms,replies) VALUES(?,?,?,?)').run(now(),Number(form.get('posts')||0),Number(form.get('dms')||0),Number(form.get('replies')||0));res.writeHead(303,{location:`/admin?key=${encodeURIComponent(String(url.searchParams.get('key')))}&page=overview`});return res.end()}
    if(url.pathname==='/admin/payout'&&req.method==='POST'){if(!adminOk(req,url))return html(res,401,'<h1>Admin access required</h1>');const form=new URLSearchParams((await body(req,true)).toString());db.prepare("INSERT INTO payout_checklist(provider,payout_method,tested,test_date) VALUES('international',?,?,?) ON CONFLICT(provider) DO UPDATE SET payout_method=excluded.payout_method,tested=excluded.tested,test_date=excluded.test_date").run(String(form.get('method')||'').slice(0,40),form.get('tested')==='1'?1:0,String(form.get('date')||'').slice(0,10));res.writeHead(303,{location:`/admin?key=${encodeURIComponent(String(url.searchParams.get('key')))}&page=payments`});return res.end()}
    if(url.pathname==='/admin'){if(!adminOk(req,url))return html(res,401,'<h1>Admin access required</h1>');return html(res,200,adminPage(String(url.searchParams.get('key')),String(url.searchParams.get('page')||'overview')))}
    const dist=resolve('./dist'),file=url.pathname==='/'?join(dist,'index.html'):resolve(dist,`.${url.pathname}`)
    if(file.startsWith(`${dist}/`)&&isFile(file)){const content=readFileSync(file);res.writeHead(200,{'content-type':mimeTypes[extname(file)]||'application/octet-stream'});return res.end(content)}
    if(isFile(join(dist,'index.html'))){const content=readFileSync(join(dist,'index.html'));res.writeHead(200,{'content-type':'text/html'});return res.end(content)}
    json(res,404,{error:'not_found'})
  } catch(error){console.error(error);if(res.headersSent)return res.end();json(res,error instanceof HttpError?error.status:400,{error:error instanceof Error?error.message:'bad_request'})}
})
server.listen(port,'127.0.0.1',()=>console.log(`Chat Wrapped server listening on http://127.0.0.1:${port}`))
