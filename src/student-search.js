// Shared, configurable search engine for student pickers and future app modules.
// Searchable fields are declared in one place so each screen uses the same rules.
export function normalizeSearchText(value=''){
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLocaleLowerCase('vi').replace(/[^a-z0-9]+/g,' ').trim();
}

function distanceAtMostOne(a,b){
  if(Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,edits=0;
  while(i<a.length&&j<b.length){
    if(a[i]===b[j]){i++;j++;continue;}
    if(++edits>1)return false;
    if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++;}
  }
  return edits+(i<a.length||j<b.length?1:0)<=1;
}

function valuesFrom(record,fieldConfig){
  const configured=typeof fieldConfig==='function'?fieldConfig(record):fieldConfig;
  return (Array.isArray(configured)?configured:[]).map(field=>typeof field==='string'?{value:record?.[field]}:field).map(field=>({value:normalizeSearchText(field?.value),weight:Number(field?.weight)||1})).filter(field=>field.value);
}

/**
 * Search any record type by supplying field values (and optional weights).
 * Example: searchRecords(students, query, {fields: s => [{value:s.name},{value:s.school}]})
 */
export function searchRecords(records,query,{fields=()=>[],excludeIds=[],getId=record=>record?.id}={}){
  const normalized=normalizeSearchText(query);
  if(!normalized)return [];
  const terms=normalized.split(/\s+/),excluded=new Set(excludeIds);
  return records.map((record,index)=>{
    if(excluded.has(getId(record)))return null;
    const recordFields=valuesFrom(record,fields),allText=recordFields.map(field=>field.value).join(' '),words=allText.split(/\s+/);
    let score=0;
    for(const term of terms){
      let best=0;
      for(const field of recordFields){
        const fieldWords=field.value.split(/\s+/);
        let quality=0;
        if(field.value===term||fieldWords.includes(term))quality=100;
        else if(field.value.startsWith(term)||fieldWords.some(word=>word.startsWith(term)))quality=75;
        else if(field.value.includes(term)||fieldWords.some(word=>word.includes(term)))quality=50;
        else if(term.length>=4&&fieldWords.some(word=>distanceAtMostOne(word,term)))quality=20;
        best=Math.max(best,quality*field.weight);
      }
      if(!best)return null;
      score+=best;
    }
    if(allText.startsWith(normalized))score+=25;
    return {record,index,score};
  }).filter(Boolean).sort((a,b)=>b.score-a.score||String(a.record.name||'').localeCompare(String(b.record.name||''),'vi')||a.index-b.index).map(result=>result.record);
}

export const studentSearchFields=student=>[
  {value:student?.name,weight:1.25}
];

export function createSearchProvider(defaultFields){
  return (records,query,options={})=>searchRecords(records,query,{fields:defaultFields,...options});
}

const studentTagSearchFields=student=>(student?.tags||[]).map(value=>({value,weight:1}));
const searchNames=createSearchProvider(studentSearchFields);
const searchTags=createSearchProvider(studentTagSearchFields);

// Reused by the class roster, attendance, and late-arrival pickers.
// Plain text searches names; a leading # switches the same engine to tags only.
export function searchStudents(profiles,query,options={}){
  const text=String(query||'').trim();
  if(text.startsWith('#'))return searchTags(profiles,text.replace(/^#+/,'').trim(),options);
  return searchNames(profiles,text,options);
}
