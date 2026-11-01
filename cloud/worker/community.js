export function publicRecord(row){
 if(!['community','accepted','exported'].includes(row.status))return null;
 const raw=row.review_json||row.community_json;
 if(!raw)return null;
 return {...JSON.parse(raw),disclosure:row.review_json?'curated':'community',verification:'unverified'};
}
