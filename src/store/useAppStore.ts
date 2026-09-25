import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {workflows as seed,rolloutPlans as seedPlans} from '../../mock-data/workflows';
import {instances as seedInstances} from '../../mock-data/instances';
import type {DomainRoute,FlowEdge,FlowNode,Instance,PilotStatus,RolloutAudit,RolloutPlan,ValidationIssue,Workflow} from '../types';
const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
export const ALL_DOMAINS=['财务','采购','人力资源','IT服务','法务'];
export const now=()=>{const d=new Date(),p=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`};
const validate=(w:Workflow):ValidationIssue[]=>{const issues:ValidationIssue[]=[]; if(!w.nodes.some(n=>n.type==='end')) issues.push({nodeId:w.nodes[0]?.id||'flow',level:'error',message:'流程缺少结束节点'}); const linked=new Set(w.edges.flatMap(e=>[e.source,e.target])); w.nodes.filter(n=>n.type!=='start'&&n.type!=='end'&&!linked.has(n.id)).forEach(n=>issues.push({nodeId:n.id,level:'error',message:'必经节点不能孤立'})); w.nodes.forEach(n=>{if(n.type==='condition'&&!n.data.config.ruleType)issues.push({nodeId:n.id,level:'error',message:'条件分支规则未配置'}); if(n.type==='approval'&&!n.data.config.approverSource)issues.push({nodeId:n.id,level:'error',message:'审批人不能为空'});}); return issues};
/** 取申请执行版本对应的流程图：办理中申请始终按提交时锁定的版本渲染 */
export const snapshotOf=(w:Workflow|undefined,version:number):{nodes:FlowNode[];edges:FlowEdge[]}=>{const v=w?.versions.find(x=>x.version===version); return v?{nodes:v.nodes,edges:v.edges}:{nodes:w?.nodes||[],edges:w?.edges||[]}};
interface State{workflows:Workflow[];instances:Instance[];rolloutPlans:RolloutPlan[];currentId:string;selectedNodeId:string|null;issues:ValidationIssue[];toast:string;hydrated:boolean;setCurrent:(id:string)=>void;selectNode:(id:string|null)=>void;updateNodes:(nodes:FlowNode[])=>void;updateEdges:(edges:FlowEdge[])=>void;updateConfig:(id:string,config:Record<string,any>)=>void;runValidation:()=>ValidationIssue[];save:()=>void;publish:()=>void;create:()=>string;copy:(id:string)=>void;archive:(id:string)=>void;restore:(v:number)=>void;clearToast:()=>void;
 // 分批试点
 getPlan:(workflowId:string)=>RolloutPlan|undefined;routeVersion:(workflowId:string,domain:string)=>number;routePilotStatus:(workflowId:string,domain:string)=>PilotStatus;startRollout:(domains:string[])=>void;haltDomain:(workflowId:string,domain:string)=>void;reopenDomain:(workflowId:string,domain:string,version:number)=>void;addPilotDomain:(workflowId:string,domain:string)=>void;submitPreview:(workflowId:string,domain:string)=>Instance}
let auditSeq=100;
const audit=(a:Omit<RolloutAudit,'id'|'time'|'operator'>):RolloutAudit=>({id:`au-${Date.now()}-${++auditSeq}`,time:now(),operator:'林秋',...a});
export const useAppStore=create<State>()(persist((set,get)=>({
 workflows:clone(seed),instances:clone(seedInstances),rolloutPlans:clone(seedPlans),currentId:'wf-1',selectedNodeId:null,issues:[],toast:'',hydrated:false,
 setCurrent:id=>set({currentId:id,selectedNodeId:null,issues:[]}),selectNode:id=>set({selectedNodeId:id}),
 updateNodes:nodes=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,nodes}:w)})),updateEdges:edges=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,edges}:w)})),
 updateConfig:(id,config)=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,nodes:w.nodes.map(n=>n.id===id?{...n,data:{...n.data,config:{...n.data.config,...config},state:'configuring'}}:n)}:w)})),
 runValidation:()=>{const w=get().workflows.find(x=>x.id===get().currentId)!; const issues=validate(w); set(s=>({issues,workflows:s.workflows.map(x=>x.id===w.id?{...x,nodes:x.nodes.map(n=>({...n,data:{...n.data,state:issues.some(i=>i.nodeId===n.id)?'invalid':'valid'}}))}:x),toast:issues.length?`发现 ${issues.length} 个问题`:'校验通过'}));return issues},
 save:()=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,status:'draft',updatedAt:now()}:w),toast:'草稿已保存'})),
 publish:()=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,status:'published',version:w.version+1,publishedAt:now(),updatedAt:now(),versions:[...w.versions,{version:w.version+1,createdAt:now(),note:'发布最新审批配置',nodes:clone(w.nodes),edges:clone(w.edges)}]}:w),toast:'流程发布成功'})),
 create:()=>{const id='wf-'+Date.now();set(s=>({workflows:[{id,name:'未命名流程',domain:'财务',status:'draft',version:0,editor:'林秋',updatedAt:now(),abnormalCount:0,nodes:[],edges:[],versions:[]},...s.workflows],currentId:id}));return id},
 copy:id=>set(s=>{const w=s.workflows.find(x=>x.id===id)!;return{workflows:[{...clone(w),id:'wf-'+Date.now(),name:w.name+'（副本）',status:'draft'},...s.workflows]}}),
 archive:id=>set(s=>({workflows:s.workflows.map(w=>w.id===id?{...w,status:'archived'}:w)})),
 restore:v=>set(s=>({workflows:s.workflows.map(w=>{if(w.id!==s.currentId)return w;const old=w.versions.find(x=>x.version===v)!;return{...w,status:'draft',nodes:clone(old.nodes),edges:clone(old.edges)}}),toast:`已恢复 v${v} 为草稿`})),clearToast:()=>set({toast:''}),
 // —— 分批试点发布 ——
 getPlan:workflowId=>get().rolloutPlans.find(p=>p.workflowId===workflowId),
 /** 新申请在该业务域当前应执行的版本 */
 routeVersion:(workflowId,domain)=>{const p=get().rolloutPlans.find(x=>x.workflowId===workflowId);if(!p)return get().workflows.find(w=>w.id===workflowId)?.version??1;const dr=p.domains.find(d=>d.domain===domain);if(dr?.status==='pilot')return dr.reopenVersion??p.candidateVersion;return p.stableVersion},
 routePilotStatus:(workflowId,domain)=>{const p=get().rolloutPlans.find(x=>x.workflowId===workflowId);const st=p?.domains.find(d=>d.domain===domain)?.status;return st==='pilot'?'pilot':st==='halted'?'rollback':'production'},
 /** 发布候选版本，并仅让所选业务域的新申请走新版本，其余域继续现网 */
 startRollout:domains=>set(s=>{const pick=new Set(domains);const ts=now();return{workflows:s.workflows.map(w=>{if(w.id!==s.currentId)return w;const v=w.version+1;return{...w,status:'published',version:v,publishedAt:ts,updatedAt:ts,versions:[...w.versions,{version:v,createdAt:ts,note:`候选 v${v} 按业务域分批试点发布`,nodes:clone(w.nodes),edges:clone(w.edges)}]}}),
  rolloutPlans:[...s.rolloutPlans.filter(p=>p.workflowId!==s.currentId),(()=>{const wf=s.workflows.find(w=>w.id===s.currentId)!;const plan:RolloutPlan={workflowId:s.currentId,candidateVersion:wf.version+1,stableVersion:wf.version,updatedAt:ts,domains:ALL_DOMAINS.map(d=>({domain:d,status:pick.has(d)?'pilot':'production',updatedAt:ts})),audits:domains.map(d=>audit({action:'start-pilot',domain:d,detail:`纳入试点，新申请路由到 v${wf.version+1}`,version:wf.version+1}))};return plan})()],
  toast:`已发布候选版本，${domains.join('、')} 新申请走新版本`}}),
 /** 主管停批：该域后续申请回旧版本；其他试点域不受影响 */
 haltDomain:(workflowId,domain)=>set(s=>({rolloutPlans:s.rolloutPlans.map(p=>{if(p.workflowId!==workflowId)return p;const route:DomainRoute={domain,status:'halted',updatedAt:now()};return{...p,updatedAt:now(),domains:p.domains.map(d=>d.domain===domain?route:d),audits:[audit({action:'halt-pilot',domain,detail:`主管停批，该域后续申请回退 v${p.stableVersion}，其他试点域不受影响`,version:p.candidateVersion}),...p.audits]}}),toast:`已停批 ${domain}，该域新申请回 v${get().getPlan(workflowId)?.stableVersion}`})),
 /** 再开放并指定版本（可指定候选新版本或旧版本） */
 reopenDomain:(workflowId,domain,version)=>set(s=>({rolloutPlans:s.rolloutPlans.map(p=>{if(p.workflowId!==workflowId)return p;const route:DomainRoute={domain,status:'pilot',reopenVersion:version,updatedAt:now()};return{...p,updatedAt:now(),domains:p.domains.map(d=>d.domain===domain?route:d),audits:[audit({action:'reopen-pilot',domain,detail:`再开放试点，指定新申请执行 v${version}`,version}),...p.audits]}}),toast:`${domain} 已再开放，新申请指定 v${version}`})),
 addPilotDomain:(workflowId,domain)=>set(s=>({rolloutPlans:s.rolloutPlans.map(p=>{if(p.workflowId!==workflowId)return p;const route:DomainRoute={domain,status:'pilot',updatedAt:now()};return{...p,updatedAt:now(),domains:p.domains.map(d=>d.domain===domain?route:d),audits:[audit({action:'start-pilot',domain,detail:`追加为试点域，新申请路由到 v${p.candidateVersion}`,version:p.candidateVersion}),...p.audits]}}),toast:`${domain} 已纳入试点`})),
 /** 预览提交：按业务域当前路由锁定执行版本，生成一条申请（办理中始终保留该版本） */
 submitPreview:(workflowId,domain)=>{const seq=get().instances.length+1;const ins:Instance={id:`INS-2026-${String(seq).padStart(4,'0')}`,workflowId,applicant:'林秋',domain,currentNode:'直属主管审批',status:'running',submittedAt:now(),duration:'0h 0m',risk:'low',execVersion:get().routeVersion(workflowId,domain),pilotStatus:get().routePilotStatus(workflowId,domain),timeline:[{title:'提交申请',time:now(),status:'completed'},{title:'直属主管审批',time:'待分派',status:'current'},{title:'金额判断',time:'—',status:'pending'}]};set(s=>({instances:[ins,...s.instances]}));return ins}
}),{name:'flowdesk-rollout-v1',partialize:s=>({workflows:s.workflows,instances:s.instances,rolloutPlans:s.rolloutPlans}),onRehydrateStorage:()=>state=>{state&&useAppStore.setState({hydrated:true})}}));
