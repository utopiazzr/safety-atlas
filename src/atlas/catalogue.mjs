import records from '../../data/signals.json';
import presentation from './presentation.json';
const images=import.meta.glob('../assets/*',{eager:true,query:'?url',import:'default'});
const imageUrl=name=>images['../assets/'+name];
export const catalogue=records.map(e=>{
 const d=presentation[e.id]||{};
 return {...e,...d,title:e.title,summary:e.summary,sources:e.sources,resources:e.resources,
  image:imageUrl(d.image||'01-case-observatory.png'),
  theme:d.theme||e.title,contexts:d.contexts||[],aliases:d.aliases||'',relevance:d.relevance||'',
  related:d.related||(e.relationships||[]).map(r=>r.target),environment:e.environment||{},
  evidence:d.evidence||'社区记录',date:d.date||e.checkedAt||'',category:d.category||e.kind};
});
