import {useState} from 'react';import {ChevronDown,History,Play,RotateCcw,ShieldAlert} from 'lucide-react';
import {DomainBadge} from './common';
import {useAppStore} from '../store/useAppStore';
import type {RolloutPlan} from '../types';
const actionText:Record<string,string>={'start-pilot':'纳入试点','halt-pilot':'主管停批','reopen-pilot':'再开放','publish':'版本发布'};
function PlanCard({plan}:{plan:RolloutPlan}){
 const wf=useAppStore(s=>s.workflows.find(w=>w.id===plan.workflowId));const halt=useAppStore(s=>s.haltDomain),reopen=useAppStore(s=>s.reopenDomain),addPilot=useAppStore(s=>s.addPilotDomain);
 const [reopenFor,setReopenFor]=useState<string|null>(null),[ver,setVer]=useState(plan.candidateVersion);
 if(!wf)return null;
 const versions=wf.versions.map(v=>v.version).sort((a,b)=>b-a);
 return <article className="rollout-card" data-testid="rollout-card">
  <div className="rollout-card-head"><div><b>{wf.name}</b><small>{wf.domain} 域所属流程 · 候选 v{plan.candidateVersion} / 现网稳定 v{plan.stableVersion}</small></div><div className="rollout-mini">{plan.domains.filter(d=>d.status==='pilot').length} 域试点 · {plan.domains.filter(d=>d.status==='halted').length} 域停批</div></div>
  <div className="rollout-domains">{plan.domains.map(d=><div key={d.domain} className="rollout-domain" data-testid={'domain-row-'+d.domain}>
    <span className="rd-name">{d.domain}</span>
    <DomainBadge status={d.status} version={d.status==='pilot'?(d.reopenVersion??plan.candidateVersion):plan.stableVersion}/>
    <small className="rd-time">{d.updatedAt}</small>
    <span className="rd-actions">{d.status==='pilot'&&<button className="danger-mini" data-testid={'halt-'+d.domain} onClick={()=>halt(plan.workflowId,d.domain)}><ShieldAlert/>停批，回 v{plan.stableVersion}</button>}
     {d.status==='halted'&&(reopenFor===d.domain?<span className="reopen-line"><select aria-label="再开放版本" value={ver} onChange={e=>setVer(Number(e.target.value))}>{versions.map(v=><option key={v} value={v}>v{v}{v===plan.candidateVersion?'（候选新版）':v===plan.stableVersion?'（现网旧版）':''}</option>)}</select><button className="mini confirm" data-testid={'reopen-confirm-'+d.domain} onClick={()=>{reopen(plan.workflowId,d.domain,ver);setReopenFor(null)}}>确认开放</button><button className="mini" onClick={()=>setReopenFor(null)}>取消</button></span>:<button className="secondary mini" data-testid={'reopen-'+d.domain} onClick={()=>{setVer(plan.candidateVersion);setReopenFor(d.domain)}}><RotateCcw/>再开放…</button>)}
     {d.status==='production'&&<button className="secondary mini" data-testid={'add-pilot-'+d.domain} onClick={()=>addPilot(plan.workflowId,d.domain)}><Play/>加入试点 v{plan.candidateVersion}</button>}</span>
  </div>)}</div>
  <div className="rollout-audit"><h4><History/>停批与分配记录</h4>{plan.audits.map(a=><div key={a.id} className={'audit-row '+a.action} data-testid="audit-row"><i/><span className={'audit-tag '+a.action}>{actionText[a.action]}</span><b>{a.domain}</b><small>{a.detail}</small><em>{a.operator} · {a.time}</em></div>)}</div>
 </article>}
export function RolloutPanel(){
 const plans=useAppStore(s=>s.rolloutPlans),[open,setOpen]=useState(true);
 return <section className="panel rollout-panel" data-testid="rollout-panel"><button className="rollout-head" onClick={()=>setOpen(o=>!o)}><div><h2>分批试点发布</h2><p>按业务域灰度：停批后该域后续申请回旧版本，其他试点域照常；再开放时指定版本。办理中的申请保留提交时版本。</p></div><ChevronDown className={open?'up':''}/></button>{open&&<div className="rollout-body">{plans.map(p=><PlanCard key={p.workflowId} plan={p}/>)}<div className="rollout-empty">其余流程未配置灰度计划，发布时可在编辑器中选择试点业务域</div></div>}</section>}
