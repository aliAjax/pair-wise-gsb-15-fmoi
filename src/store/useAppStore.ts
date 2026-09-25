import {create} from 'zustand'; import {persist} from 'zustand/middleware';
import {workflows as seed} from '../../mock-data/workflows'; import {instances as seedInstances} from '../../mock-data/instances'; import {domains} from '../../mock-data/catalog';
import type {FlowEdge,FlowNode,Instance,PilotState,ValidationIssue,Workflow,DomainRollout,PilotRecord} from '../types';
const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
// 现网稳定版本；试点域新申请走目标版本，停批后回退稳定版本
export const STABLE_VERSION=1;
const NOW='2026-07-11 17:05';
// 初始试点：财务、人力资源、IT服务已开放新版本 v2
const initialRollouts:DomainRollout[]=domains.map(d=>['财务','人力资源','IT服务'].includes(d)?{domain:d,active:true,targetVersion:2,startedAt:'2026-07-05 09:00'}:{domain:d,active:false,targetVersion:STABLE_VERSION});
const initialPilotLog:PilotRecord[]=[
 {id:'rec-3',time:'2026-07-05 09:00',domain:'IT服务',action:'start',version:2,operator:'林秋',note:'IT服务域加入第二批试点，新申请走 v2'},
 {id:'rec-2',time:'2026-07-05 09:00',domain:'人力资源',action:'start',version:2,operator:'林秋',note:'人力资源域加入第一批试点，新申请走 v2'},
 {id:'rec-1',time:'2026-07-05 09:00',domain:'财务',action:'start',version:2,operator:'林秋',note:'财务域成为首批试点，新申请走 v2'},
];
// 按提交时刻的试点路由决定执行版本：办理中/已完成实例始终沿用提交结果，不随后续停批变化
export const routeAt=(_domain:string,rollouts:DomainRollout[]):{version:number;pilot:PilotState}=>{
 const r=rollouts.find(x=>x.domain===_domain);
 if(r?.active)return{version:r.targetVersion,pilot:'pilot'};
 if(r)return{version:STABLE_VERSION,pilot:'fallback'};
 return{version:STABLE_VERSION,pilot:'standard'};
};
const validate=(w:Workflow):ValidationIssue[]=>{const issues:ValidationIssue[]=[]; if(!w.nodes.some(n=>n.type==='end')) issues.push({nodeId:w.nodes[0]?.id||'flow',level:'error',message:'流程缺少结束节点'}); const linked=new Set(w.edges.flatMap(e=>[e.source,e.target])); w.nodes.filter(n=>n.type!=='start'&&n.type!=='end'&&!linked.has(n.id)).forEach(n=>issues.push({nodeId:n.id,level:'error',message:'必经节点不能孤立'})); w.nodes.forEach(n=>{if(n.type==='condition'&&!n.data.config.ruleType)issues.push({nodeId:n.id,level:'error',message:'条件分支规则未配置'}); if(n.type==='approval'&&!n.data.config.approverSource)issues.push({nodeId:n.id,level:'error',message:'审批人不能为空'});}); return issues};
interface State{workflows:Workflow[];instances:Instance[];rollouts:DomainRollout[];pilotLog:PilotRecord[];currentId:string;selectedNodeId:string|null;issues:ValidationIssue[];toast:string;setCurrent:(id:string)=>void;selectNode:(id:string|null)=>void;updateNodes:(nodes:FlowNode[])=>void;updateEdges:(edges:FlowEdge[])=>void;updateConfig:(id:string,config:Record<string,any>)=>void;runValidation:()=>ValidationIssue[];save:()=>void;publish:()=>void;create:()=>string;copy:(id:string)=>void;archive:(id:string)=>void;restore:(v:number)=>void;startPilot:(domain:string,version:number)=>void;stopPilot:(domain:string)=>void;resumePilot:(domain:string,version:number)=>void;submitInstance:(workflowId:string,domain:string)=>string;clearToast:()=>void}
export const useAppStore=create<State>()(persist((set,get)=>({workflows:clone(seed),instances:clone(seedInstances),rollouts:initialRollouts,pilotLog:initialPilotLog,currentId:'wf-1',selectedNodeId:null,issues:[],toast:'',
 setCurrent:id=>set({currentId:id,selectedNodeId:null,issues:[]}),selectNode:id=>set({selectedNodeId:id}),
 updateNodes:nodes=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,nodes}:w)})),
 updateEdges:edges=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,edges}:w)})),
 updateConfig:(id,config)=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,nodes:w.nodes.map(n=>n.id===id?{...n,data:{...n.data,config:{...n.data.config,...config},state:'configuring'}}:n)}:w)})),
 runValidation:()=>{const w=get().workflows.find(x=>x.id===get().currentId)!; const issues=validate(w); set(s=>({issues,workflows:s.workflows.map(x=>x.id===w.id?{...x,nodes:x.nodes.map(n=>({...n,data:{...n.data,state:issues.some(i=>i.nodeId===n.id)?'invalid':'valid'}}))}:x),toast:issues.length?`发现 ${issues.length} 个问题`:'校验通过'}));return issues},
 save:()=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,status:'draft',updatedAt:'2026-07-11 16:30'}:w),toast:'草稿已保存'})),
 publish:()=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,status:'published',version:w.version+1,publishedAt:'2026-07-11 16:35',updatedAt:'2026-07-11 16:35',versions:[...w.versions,{version:w.version+1,createdAt:'2026-07-11 16:35',note:'发布最新审批配置',nodes:clone(w.nodes),edges:clone(w.edges)}]}:w),toast:'流程发布成功'})),
 create:()=>{const id='wf-'+Date.now();set(s=>({workflows:[{id,name:'未命名流程',domain:'财务',status:'draft',version:0,editor:'林秋',updatedAt:'2026-07-11 16:40',abnormalCount:0,nodes:[],edges:[],versions:[]},...s.workflows],currentId:id}));return id},
 copy:id=>set(s=>{const w=s.workflows.find(x=>x.id===id)!;return{workflows:[{...clone(w),id:'wf-'+Date.now(),name:w.name+'（副本）',status:'draft'},...s.workflows]}}),
 archive:id=>set(s=>({workflows:s.workflows.map(w=>w.id===id?{...w,status:'archived'}:w)})),
 restore:v=>set(s=>({workflows:s.workflows.map(w=>{if(w.id!==s.currentId)return w;const old=w.versions.find(x=>x.version===v)!;return{...w,status:'draft',nodes:clone(old.nodes),edges:clone(old.edges)}}),toast:`已恢复 v${v} 为草稿`})),
 // 主管开放试点（新加入或从停批恢复），指定后续新申请的执行版本
 startPilot:(domain,version)=>set(s=>({rollouts:s.rollouts.map(r=>r.domain===domain?{...r,active:true,targetVersion:version,startedAt:NOW,stoppedAt:undefined}:r),pilotLog:[{id:'rec-'+Date.now(),time:NOW,domain,action:s.rollouts.find(r=>r.domain===domain)?.startedAt?'resume':'start',version,operator:'林秋',note:`${domain}域开放试点，新申请走 v${version}`},...s.pilotLog],toast:`${domain} 域已开放试点（新申请 v${version}）`})),
 // 主管停批：该域后续申请回旧版本，其他试点域照常；已提交实例的版本不变
 stopPilot:domain=>set(s=>({rollouts:s.rollouts.map(r=>r.domain===domain?{...r,active:false,stoppedAt:NOW}:r),pilotLog:[{id:'rec-'+Date.now(),time:NOW,domain,action:'stop',version:STABLE_VERSION,operator:'林秋',note:`${domain}域已停批，后续申请回退现网 v${STABLE_VERSION}`},...s.pilotLog],toast:`${domain} 域已停批，后续申请回 v${STABLE_VERSION}`})),
 resumePilot:(domain,version)=>get().startPilot(domain,version),
 // 预览页模拟提交：按提交瞬间的试点路由盖章执行版本与试点状态
 submitInstance:(workflowId,domain)=>{const w=get().workflows.find(x=>x.id===workflowId)!;const{version,pilot}=routeAt(domain,get().rollouts);const seq=get().instances.length+1;const id=`INS-2026-${String(seq).padStart(4,'0')}`;const inst:Instance={id,workflowId,applicant:'林秋',domain,currentNode:'提交申请',status:'running',submittedAt:NOW,duration:'0h 0m',risk:'low',execVersion:version,pilot,timeline:[{title:'提交申请',time:NOW.slice(11),status:'completed'},{title:'直属主管审批',time:'—',status:'pending'}]};set(s=>({instances:[inst,...s.instances],workflows:s.workflows.map(x=>x.id===workflowId?{...x,updatedAt:NOW}:x)}));return id},
 clearToast:()=>set({toast:''})}),
 {name:'flowdesk-rollout-v1',partialize:s=>({instances:s.instances,rollouts:s.rollouts,pilotLog:s.pilotLog})}
));
