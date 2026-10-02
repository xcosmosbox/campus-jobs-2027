import scans from '@/data/position-scans.json';

export const scanLabels={complete:'已读取完整列表',partial:'已读取部分岗位',blocked:'岗位列表读取受限',no_current:'当届岗位尚未确认',no_roles:'当届页面未列具体岗位'} as const;
export type PositionScan={opportunityId:string;company:string;industry:string;status:keyof typeof scanLabels;checkedAt:string;reportedTotal:number|null;observedRoles:number;importedRoles:number;pagesRead:number|null;sourceUrls:string[];attempts:{url:string|null;query:string|null;outcome:string;ref:string|null}[];scope:string;reason:string;jobCategories:string[];review:{status:string;reviewer:string;note:string};independentReviews?:{decision:'accepted'|'limited'|'rejected';reviewer:string;note:string;sourceUrls?:string[]}[]};
export const positionScans=scans as PositionScan[];
export const scanByCompany=new Map(positionScans.map(s=>[s.opportunityId,s]));
export function coverageSummary(rows:PositionScan[]){return {attempted:rows.length,complete:rows.filter(s=>s.status==='complete').length,partial:rows.filter(s=>s.status==='partial').length,unresolved:rows.filter(s=>!['complete','partial'].includes(s.status)).length};}
