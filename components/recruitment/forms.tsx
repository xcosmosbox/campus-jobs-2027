'use client';
import {useState,type ReactNode,type FormEvent} from 'react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Checkbox} from '@/components/ui/checkbox';
import {shanghaiDate,statusOf,type Opportunity} from '@/lib/screening';
import {stages,priorities,directions,employmentLabels,reasons,educationLabels,overseasLabels,taskKinds,localTime,prettyTime,fieldLabels,reasonOf,dateConfirmation,
 type Personal,type Position,type Review,type Task,type Item,type Event,type Kind} from '@/lib/workspace';

export function Picker({label,value,onChange,options,id}:{label:string;value:string;onChange:(value:string)=>void;options:[string,string][];id?:string}){
 return <Select value={value} onValueChange={onChange}><SelectTrigger id={id} className="picker" aria-label={label}><SelectValue/></SelectTrigger><SelectContent position="popper">{options.map(([value,text])=><SelectItem key={value} value={value}>{text}</SelectItem>)}</SelectContent></Select>;
}
export function Field({label,children,wide=false}:{label:string;children:ReactNode;wide?:boolean}){return <div className={'form-field '+(wide?'wide':'')}><span className="form-label">{label}</span>{children}</div>;}
export function TextField({label,value,onChange,type='text',placeholder='',wide=false,required=false,maxLength=3000}:{label:string;value:string;onChange:(value:string)=>void;type?:string;placeholder?:string;wide?:boolean;required?:boolean;maxLength?:number}){
 return <Field label={label} wide={wide}><input aria-label={label} value={value} onChange={e=>onChange(e.target.value)} onInput={e=>onChange(e.currentTarget.value)} type={type} placeholder={placeholder} required={required} maxLength={maxLength}/></Field>;
}
export function TextArea({label,value,onChange,required=false}:{label:string;value:string;onChange:(value:string)=>void;required?:boolean}){return <Field label={label} wide><textarea aria-label={label} value={value} onChange={e=>onChange(e.target.value)} rows={3} required={required} maxLength={5000}/></Field>;}
export function Check({label,checked,onChange,id}:{label:string;checked:boolean;onChange:(value:boolean)=>void;id:string}){return <div className="form-check"><Checkbox id={id} checked={checked} onCheckedChange={v=>onChange(v===true)}/><label htmlFor={id}>{label}</label></div>;}
export function Confirmations({r,today,now,expanded=false}:{r:Opportunity;today:string;now:Date;expanded?:boolean}){
 const date=dateConfirmation(r),status=statusOf(r,today,now);
 const open={open:'公告开放中',closed:'已截止',upcoming:'尚未开始',unknown:'可投状态未确认'}[status];
 return <div className={'confirmation-stack '+(expanded?'expanded':'')}>
  <div><span className="confirmation-label">来源</span><span className={'fact-badge '+(r.confirmed?'yes':'unknown')}>{r.confirmed?'来源已确认':'来源未确认'}</span></div>
  <div><span className="confirmation-label">日期</span><span className={'fact-badge '+(date.key==='full'?'yes':date.key==='partial'?'partial':'unknown')}>{date.label}</span></div>
  <div><span className="confirmation-label">可投</span><span className={'fact-badge '+status}>{open}</span></div>
  {expanded&&<p>来源核验于 {r.checkedAt}。可投判断按公告与已确认期限更新，具体岗位余量以投递页为准。</p>}
 </div>;
}
type Save=(kind:Kind,id:string,data:unknown)=>Promise<unknown>;
function recordId(kind:'role'|'task'){return kind+':'+Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');}
function ErrorMessage({error}:{error:string}){return error?<p className="form-error" role="alert">{error}</p>:null;}
export function ProgressForm({item,save,disabled}:{item:Item;save:Save;disabled:boolean}){
 const [draft,setDraft]=useState<Personal>({...item.personal}),[error,setError]=useState(''),[saved,setSaved]=useState(item.tracked);
 const set=(key:keyof Personal,value:unknown)=>{setSaved(false);setDraft(v=>({...v,[key]:value}));};
 async function submit(e:FormEvent){e.preventDefault();setError('');try{await save('personal',item.id,draft);setSaved(true);}catch(e){setError(e instanceof Error?e.message:'保存失败');}}
 return <form onSubmit={submit} className="product-form"><fieldset disabled={disabled}><div className="form-grid">
  <Field label="我的投递进度"><Picker label="我的投递进度" value={draft.stage} onChange={v=>set('stage',v)} options={Object.entries(stages)}/></Field>
  <Field label="我的优先级"><Picker label="我的优先级" value={draft.priority} onChange={v=>set('priority',v)} options={Object.entries(priorities)}/></Field>
  <TextField label="投递时间（北京时间）" type="datetime-local" value={draft.submittedAt?localTime(draft.submittedAt):''} onChange={v=>set('submittedAt',v?v+':00+08:00':null)}/>
  <TextField label="简历版本" value={draft.resumeVersion} onChange={v=>set('resumeVersion',v)} placeholder="例如 AI工程师 v3" maxLength={120}/>
  <TextField label="面试轮次" type="number" value={String(draft.interviewRound)} onChange={v=>set('interviewRound',Number(v))}/>
  <TextField label="结束原因" value={draft.endedReason} onChange={v=>set('endedReason',v)} placeholder="拒绝／主动退出／其他"/>
  <TextArea label="跟进备注" value={draft.notes} onChange={v=>set('notes',v)}/>
 </div><div className="form-inline-checks"><Check label="收藏这个机会" id={'favorite-'+item.id} checked={draft.favorite} onChange={v=>set('favorite',v)}/><Check label="暂不考虑，在默认列表中隐藏" id={'hidden-'+item.id} checked={draft.hidden} onChange={v=>set('hidden',v)}/></div>
 <p className="form-hint">选择“已投递”且未填投递时间时，会记录本次保存时间。每个公司和岗位可分别跟进。</p>
 <ErrorMessage error={error}/><div className="form-actions"><button className="primary-button" type="submit">{disabled?'保存暂不可用':item.tracked?'保存投递记录':'加入跟进并保存'}</button>{saved&&<span className="saved-message" role="status">已保存</span>}</div></fieldset></form>;
}
export function PositionForm({opportunity,position,save,disabled,onSaved}:{opportunity:Opportunity;position?:Position;save:Save;disabled:boolean;onSaved:()=>void}){
 const [draft,setDraft]=useState<Position>(()=>position||{id:recordId('role'),opportunityId:opportunity.id,name:'',department:'',locations:[],direction:'其他',education:'unknown',majors:'',graduationStart:null,graduationEnd:null,graduationText:'',overseas:'unknown',qualificationNote:'',sourceUrl:'',evidence:'',verified:false,verification:'official',checkedAt:null,entryUrl:'',startDate:null,endDate:null,endTime:null,deadlineLabel:'',campaignStatus:'unknown',deadlineScope:''});
 const [ack,setAck]=useState(false),[error,setError]=useState('');const set=(key:keyof Position,value:unknown)=>setDraft(v=>({...v,[key]:value}));
 async function submit(e:FormEvent){e.preventDefault();setError('');try{await save('position',draft.id,{...draft,acknowledged:ack});onSaved();}catch(e){setError(e instanceof Error?e.message:'保存失败');}}
 return <form onSubmit={submit} className="product-form"><fieldset disabled={disabled}><p className="form-hint">关联：{opportunity.company}。岗位自己的资格和期限独立填写，不自动继承集团期限。</p><div className="form-grid">
 <TextField label="岗位名称" value={draft.name} onChange={v=>set('name',v)} required/>
 <TextField label="所属部门／成员公司" value={draft.department} onChange={v=>set('department',v)}/>
 <TextField label="工作地点" value={draft.locations.join('、')} onChange={v=>set('locations',v.split(/[、，,]/).map(s=>s.trim()).filter(Boolean))} placeholder="多个地点用顿号分隔"/>
 <Field label="岗位性质"><Picker label="岗位性质" value={draft.employmentType||'unknown'} onChange={v=>set('employmentType',v as keyof typeof employmentLabels)} options={Object.entries(employmentLabels)}/></Field>
 <Field label="岗位方向"><Picker label="岗位方向" value={draft.direction} onChange={v=>set('direction',v)} options={directions.map(s=>[s,s])}/></Field>
 <Field label="最低学历"><Picker label="最低学历" value={draft.education} onChange={v=>set('education',v)} options={Object.entries(educationLabels)}/></Field>
 <Field label="海外毕业生要求"><Picker label="海外毕业生要求" value={draft.overseas} onChange={v=>set('overseas',v)} options={Object.entries(overseasLabels)}/></Field>
 <TextField label="毕业窗口开始" type="date" value={draft.graduationStart||''} onChange={v=>set('graduationStart',v||null)}/>
 <TextField label="毕业窗口结束" type="date" value={draft.graduationEnd||''} onChange={v=>set('graduationEnd',v||null)}/>
 <TextField label="毕业要求原意" value={draft.graduationText} onChange={v=>set('graduationText',v)} wide placeholder="只写2027届时，不补造具体日期窗口"/>
 <TextField label="专业要求" value={draft.majors} onChange={v=>set('majors',v)} wide/>
 <TextArea label="资格补充说明" value={draft.qualificationNote} onChange={v=>set('qualificationNote',v)}/>
 <TextField label="岗位来源网址" value={draft.sourceUrl} onChange={v=>set('sourceUrl',v)} type="url" wide/>
 <Field label="岗位来源类型"><Picker label="岗位来源类型" value={draft.verification||'official'} onChange={v=>set('verification',v)} options={[['official','官方岗位页'],['employer','企业供稿简章']]}/></Field>
 <Field label="岗位当前可投判断"><Picker label="岗位当前可投判断" value={draft.campaignStatus} onChange={v=>set('campaignStatus',v)} options={[['unknown','未确认'],['open','公告开放中'],['closed','已截止'],['upcoming','尚未开始']]}/></Field>
 <TextArea label="岗位核验依据" value={draft.evidence} onChange={v=>set('evidence',v)}/>
 <TextField label="岗位投递入口" value={draft.entryUrl} onChange={v=>set('entryUrl',v)} type="url" wide/>
 <TextField label="岗位开始日期" type="date" value={draft.startDate||''} onChange={v=>set('startDate',v||null)}/>
 <TextField label="岗位截止日期" type="date" value={draft.endDate||''} onChange={v=>set('endDate',v||null)}/>
 <TextField label="岗位截止时刻" value={draft.endTime||''} onChange={v=>set('endTime',v||null)} placeholder="HH:MM，可填24:00"/>
 <TextField label="岗位期限说明" value={draft.deadlineLabel} onChange={v=>set('deadlineLabel',v)} placeholder="暂定／按机构分别截止等"/>
 <TextField label="期限适用范围依据" value={draft.deadlineScope} onChange={v=>set('deadlineScope',v)} wide/>
 </div><div className="form-inline-checks"><Check label="岗位来源已确认" id={'verified-'+draft.id} checked={draft.verified} onChange={v=>set('verified',v)}/><Check label="我已阅读来源并核对岗位及资格信息" id={'ack-'+draft.id} checked={ack} onChange={setAck}/></div>
 <p className="form-hint">未核验的补录信息可保存为线索，日期不参与确定截止提醒或应届资格匹配。</p><ErrorMessage error={error}/><button className="primary-button" type="submit">保存岗位与资格</button></fieldset></form>;
}
export function ReviewForm({r,save,disabled,onSaved}:{r:Opportunity;save:Save;disabled:boolean;onSaved:()=>void}){
 const [draft,setDraft]=useState<Review>({confirmed:r.confirmed,verification:r.confirmed?r.verification==='employer'?'employer':'official':'unconfirmed',sourceUrl:r.sources[0]||'',evidence:r.evidence,scopeLabel:r.scopeLabel||'',startDate:r.startDate,startTime:r.startTime||null,endDate:r.endDate,endTime:r.endTime,deadlineLabel:r.deadlineLabel||'',campaignStatus:r.campaignStatus||'unknown',entryUrl:r.entries[0]||'',applicationEmail:r.applicationEmail||'',applicationMethod:r.applicationMethod||'',note:r.note,reviewReason:r.reviewReason||'',reasonCategory:reasonOf(r),checkedAt:r.checkedAt});
 const [ack,setAck]=useState(false),[error,setError]=useState('');const set=(key:keyof Review,value:unknown)=>setDraft(v=>({...v,[key]:value}));
 async function submit(e:FormEvent){e.preventDefault();setError('');try{await save('review',r.id,{...draft,acknowledged:ack});onSaved();}catch(e){setError(e instanceof Error?e.message:'保存失败');}}
 return <form onSubmit={submit} className="product-form"><fieldset disabled={disabled}><p className="form-hint">复核：{r.company}。保存后记录本次核验日期及每项信息的前后变化。</p><div className="form-grid">
 <Field label="来源确认结论"><Picker label="来源确认结论" value={draft.confirmed?'confirmed':'unconfirmed'} onChange={v=>setDraft(d=>({...d,confirmed:v==='confirmed',verification:v==='confirmed'?'official':'unconfirmed'}))} options={[['confirmed','当届来源已确认'],['unconfirmed','查证后仍未确认']]}/></Field>
 <Field label="复核来源类型"><Picker label="复核来源类型" value={draft.verification} onChange={v=>set('verification',v)} options={draft.confirmed?[['official','官方页面'],['employer','企业供稿简章']]:[['unconfirmed','未确认']]}/></Field>
 <TextField label="本次查证来源网址" value={draft.sourceUrl} onChange={v=>set('sourceUrl',v)} type="url" required wide/>
 <TextField label="招聘主体与批次范围" value={draft.scopeLabel} onChange={v=>set('scopeLabel',v)} wide/>
 <TextArea label="本次实际查证结果" value={draft.evidence} onChange={v=>set('evidence',v)} required/>
 <TextField label="核验开始日期" type="date" value={draft.startDate||''} onChange={v=>set('startDate',v||null)}/>
 <TextField label="核验截止日期" type="date" value={draft.endDate||''} onChange={v=>set('endDate',v||null)}/>
 <TextField label="核验开始时刻" value={draft.startTime||''} onChange={v=>set('startTime',v||null)} placeholder="HH:MM"/>
 <TextField label="核验截止时刻" value={draft.endTime||''} onChange={v=>set('endTime',v||null)} placeholder="HH:MM，可填24:00"/>
 <TextField label="期限原文说明" value={draft.deadlineLabel} onChange={v=>set('deadlineLabel',v)} wide placeholder="暂定期限、分机构期限或月份范围只在此说明"/>
 <Field label="当前可投判断"><Picker label="当前可投判断" value={draft.campaignStatus} onChange={v=>set('campaignStatus',v)} options={[['unknown','未确认'],['open','公告开放中'],['closed','已截止'],['upcoming','尚未开始']]}/></Field>
 <Field label="未确认原因分类"><Picker label="未确认原因分类" value={draft.reasonCategory} onChange={v=>set('reasonCategory',v)} options={Object.entries(reasons)}/></Field>
 <TextArea label="仍未确认的信息与原因" value={draft.reviewReason} onChange={v=>set('reviewReason',v)} required={!draft.confirmed}/>
 <TextField label="核验投递入口" value={draft.entryUrl} onChange={v=>set('entryUrl',v)} type="url" wide/>
 <TextField label="核验投递邮箱" value={draft.applicationEmail} onChange={v=>set('applicationEmail',v)} type="email" wide/>
 <TextArea label="官方投递方式说明" value={draft.applicationMethod} onChange={v=>set('applicationMethod',v)}/>
 <TextArea label="复核补充说明" value={draft.note} onChange={v=>set('note',v)}/>
 </div><Check label="我已实际查证并核对以上信息，未公布字段保持空白" id={'review-ack-'+r.id} checked={ack} onChange={setAck}/><ErrorMessage error={error}/><button type="submit" className="primary-button">保存复核结果</button></fieldset></form>;
}
export function TaskForm({task,items,defaultItemId='',save,disabled,onSaved}:{task?:Task;items:Item[];defaultItemId?:string;save:Save;disabled:boolean;onSaved:()=>void}){
 const [draft,setDraft]=useState<Task>(()=>task||{id:recordId('task'),itemId:defaultItemId,title:'',kind:'other',dueAt:localTime(new Date(Date.now()+2*3600000).toISOString())+':00+08:00',notes:'',completed:false,completedAt:null});
 const [error,setError]=useState(''),[associationSearch,setAssociationSearch]=useState('');const set=(key:keyof Task,value:unknown)=>setDraft(v=>({...v,[key]:value}));
 const related=items.filter(i=>(i.parent.company+' '+i.label).toLocaleLowerCase().includes(associationSearch.trim().toLocaleLowerCase()));
 const relatedOptions=related.slice(0,100);const chosen=items.find(i=>i.id===draft.itemId);if(chosen&&!relatedOptions.some(i=>i.id===chosen.id))relatedOptions.unshift(chosen);
 async function submit(e:FormEvent){e.preventDefault();setError('');try{await save('task',draft.id,draft);onSaved();}catch(e){setError(e instanceof Error?e.message:'保存失败');}}
 return <form onSubmit={submit} className="product-form"><fieldset disabled={disabled}><div className="form-grid">
 <TextField label="待办标题" value={draft.title} onChange={v=>set('title',v)} required wide placeholder="例如：中国银行在线测评"/>
 <Field label="待办类型"><Picker label="待办类型" value={draft.kind} onChange={v=>set('kind',v)} options={Object.entries(taskKinds)}/></Field>
 <TextField label="待办时间（北京时间）" type="datetime-local" value={draft.dueAt?localTime(draft.dueAt):''} onChange={v=>set('dueAt',v?v+':00+08:00':'')} required/>
 <TextField label="搜索要关联的公司或岗位" value={associationSearch} onChange={setAssociationSearch} wide placeholder="输入公司或岗位名称，缩小可选范围"/>
 <Field label="关联公司或岗位" wide><Picker label="关联公司或岗位" value={draft.itemId||'none'} onChange={v=>set('itemId',v==='none'?'':v)} options={[["none","不关联"],...relatedOptions.map(i=>[i.id,i.parent.company+(i.position?' · '+i.label:'')] as [string,string])]}/></Field>
 <p className="control-hint wide">匹配 {related.length} 个机会，最多显示前 100 项；可输入更多关键词，已选关联会保留。</p>
 <TextArea label="待办备注" value={draft.notes} onChange={v=>set('notes',v)}/>
 </div><Check label="待办已完成" id={'complete-'+draft.id} checked={draft.completed} onChange={v=>set('completed',v)}/><ErrorMessage error={error}/><button type="submit" className="primary-button">保存待办</button></fieldset></form>;
}
function valueText(field:string,value:unknown){if(value===null||value===undefined||value==='')return '未填写';if(Array.isArray(value))return value.join('、');if(typeof value==='boolean')return value?'是':'否';if(field==='stage')return stages[value as keyof typeof stages]||String(value);if(field==='priority')return priorities[value as keyof typeof priorities]||String(value);if(field==='campaignStatus')return {open:'公告开放中',closed:'已截止',upcoming:'尚未开始',unknown:'未确认'}[String(value)]||String(value);return String(value);}
export function HistoryList({events,labelFor}:{events:Event[];labelFor:(id:string)=>string}){return <div className="history-list">{events.length?events.map(e=><article className="history-event" key={e.id}><div className="history-top"><strong>{labelFor(e.itemId)}</strong><time>{prettyTime(e.createdAt)}</time></div><p>{e.summary}</p>{e.changes.length>0&&<details><summary>查看 {e.changes.length} 项变化</summary><dl>{e.changes.map((change,i)=><div key={i}><dt>{fieldLabels[change.field]||change.field}</dt><dd><span>{valueText(change.field,change.before)}</span><b>更新为</b><span>{valueText(change.field,change.after)}</span></dd></div>)}</dl></details>}{e.sourceUrl&&<a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">本次来源依据</a>}</article>):<div className="small-empty">还没有新的变更记录。投递跟进、待办、岗位补录和来源复核保存后会出现在这里。</div>}</div>;}
