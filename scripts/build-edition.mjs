import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const schedule = JSON.parse(await readFile(path.join(root, 'config/season-2026.json'), 'utf8'));
const forced = process.env.GAME_DATE;
const today = forced || new Intl.DateTimeFormat('en-CA', { timeZone:'America/Chicago', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
const game = schedule.find((item) => item.date === today);

if (!game) {
  console.log(`No Klein Cain game scheduled for ${today}; leaving the current edition untouched.`);
  if (process.env.GITHUB_ENV) await writeFile(process.env.GITHUB_ENV, 'RUN_EDITION=false\n', { flag:'a' });
  process.exit(0);
}
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for a game-day edition.');

const existing = JSON.parse(await readFile(path.join(root, 'content/current-edition.json'), 'utf8'));
const schema = {
  type:'object', additionalProperties:false,
  required:['slug','issue','date','dateShort','opponent','venue','kickoff','updated','event','home','away','prediction','headline','dek','readHeadline','readBody','weatherLabel','weatherDetail','players'],
  properties:{
    slug:{type:'string'}, issue:{type:'string'}, date:{type:'string'}, dateShort:{type:'string'}, opponent:{type:'string'}, venue:{type:'string'}, kickoff:{type:'string'}, updated:{type:'string'}, event:{type:'string'},
    home:{type:'object',additionalProperties:false,required:['name','record','rank'],properties:{name:{type:'string'},record:{type:'string'},rank:{type:'integer'}}},
    away:{type:'object',additionalProperties:false,required:['name','record','rank'],properties:{name:{type:'string'},record:{type:'string'},rank:{type:'integer'}}},
    prediction:{type:'object',additionalProperties:false,required:['home','away','winProbability','source'],properties:{home:{type:'integer'},away:{type:'integer'},winProbability:{type:'integer'},source:{type:'string'}}},
    headline:{type:'string'}, dek:{type:'string'}, readHeadline:{type:'string'}, readBody:{type:'string'}, weatherLabel:{type:'string'}, weatherDetail:{type:'string'},
    players:{type:'array',minItems:6,maxItems:6,items:{type:'object',additionalProperties:false,required:['team','number','name','role','tag','rating','copy'],properties:{team:{type:'string'},number:{type:'string'},name:{type:'string'},role:{type:'string'},tag:{type:'string'},rating:{type:'string'},copy:{type:'string'}}}}
  }
};

const prompt = `Research and write the Klein Cain varsity football game-day edition for ${JSON.stringify(game)}. Today is ${today}. Use web search and prefer official team schedules, MaxPreps, Rivals/On3, 247Sports, Hudl profiles and a current weather source. Verify records, rankings, player class/position, college interest, commitments, star ratings and prediction. Never infer a star rating or offer. If a service has no listing, say that plainly. Select exactly three players per team, with the strongest verified recruiting and returning-production stories. Keep every capsule concrete and under 55 words. Write like a restrained local sports editor: no hype filler, no rhetorical questions, no binary contrasts, no em dashes, no stacked fragments, no words such as leverage, robust, elevate, pivotal or game-changer. Use CAIN and OAK RIDGE as team labels. Issue number should increment from ${existing.issue}. Headline must be 2 to 4 words. The page already carries source links, so do not put URLs in the JSON.`;

const response = await fetch('https://api.openai.com/v1/responses', {
  method:'POST',
  headers:{ 'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type':'application/json' },
  body:JSON.stringify({ model:process.env.OPENAI_MODEL || 'gpt-5.4-mini', tools:[{type:'web_search_preview'}], max_tool_calls:12, input:prompt, text:{format:{type:'json_schema',name:'game_day_edition',strict:true,schema}}, store:false })
});
if (!response.ok) throw new Error(`OpenAI research failed (${response.status}): ${await response.text()}`);
const result = await response.json();
const outputText = result.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
if (!outputText) throw new Error('The research run returned no edition JSON.');
const edition = JSON.parse(outputText);
edition.issue = String(Number(existing.issue) + (existing.slug === edition.slug ? 0 : 1)).padStart(2, '0');

await mkdir(path.join(root, 'content/archive'), { recursive:true });
const json = `${JSON.stringify(edition, null, 2)}\n`;
await writeFile(path.join(root, 'content/current-edition.json'), json);
await writeFile(path.join(root, `content/archive/${edition.slug}.json`), json);
if (process.env.GITHUB_ENV) await writeFile(process.env.GITHUB_ENV, `RUN_EDITION=true\nEDITION_SLUG=${edition.slug}\n`, { flag:'a' });
console.log(`Built issue ${edition.issue}: Klein Cain vs ${edition.opponent}.`);
