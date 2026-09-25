import type {ReactNode} from 'react';
import type {DomainRouteStatus,PilotStatus} from '../types';
export const Status=({value}:{value:string})=><span className={'status '+value}>{({published:'已发布',draft:'草稿',archived:'已归档',abnormal:'异常',timeout:'超时',running:'进行中',completed:'已完成',high:'高风险',medium:'中风险',low:'低风险'} as any)[value]||value}</span>;
const pilotMap:Record<PilotStatus,{label:string;cls:string;tip:string}>={pilot:{label:'试点新版',cls:'pilot',tip:'提交时业务域为试点，执行灰度新版本'},rollback:{label:'停批回旧版',cls:'rollback',tip:'提交时业务域已停批，执行现网旧版本'},production:{label:'现网版本',cls:'production',tip:'业务域未试点，执行现网稳定版本'}};
/** 按申请显示：执行版本 + 提交时的试点状态 */
export const PilotBadge=({status,version}:{status:PilotStatus;version:number})=>{const m=pilotMap[status];return <span className={'pilot-badge '+m.cls} title={m.tip} data-testid="pilot-badge"><i/><b>v{version}</b><em>{m.label}</em></span>};
export const domainStatusMap:Record<DomainRouteStatus,{label:string;cls:string}>={pilot:{label:'试点中',cls:'pilot'},halted:{label:'已停批',cls:'rollback'},production:{label:'现网',cls:'production'}};
export const DomainBadge=({status,version}:{status:DomainRouteStatus;version?:number})=>{const m=domainStatusMap[status];return <span className={'domain-badge '+m.cls} data-testid="domain-badge"><i/>{m.label}{status!=='production'&&version!=null&&<b>v{version}</b>}</span>};
export const Empty=({title='暂无数据',text='当前筛选条件下没有匹配内容'}:{title?:string;text?:string})=><div className="empty"><div>⌁</div><b>{title}</b><p>{text}</p></div>;
export const PageTitle=({eyebrow,title,desc,actions}:{eyebrow?:string;title:string;desc:string;actions?:ReactNode})=><div className="page-title"><div>{eyebrow&&<small>{eyebrow}</small>}<h1>{title}</h1><p>{desc}</p></div>{actions&&<div className="title-actions">{actions}</div>}</div>;
