export type WorkflowStatus='draft'|'published'|'archived';
export type NodeKind='start'|'form'|'approval'|'condition'|'automation'|'notify'|'end';
export type NodeState='unconfigured'|'configuring'|'valid'|'invalid';
export interface FormField {id:string;label:string;type:'text'|'number'|'amount'|'date'|'select'|'attachment';required:boolean;options?:string[]}
export interface FlowNode {id:string;type:NodeKind;position:{x:number;y:number};data:{label:string;state:NodeState;config:Record<string,any>}}
export interface FlowEdge {id:string;source:string;target:string;label?:string}
export interface Version {version:number;createdAt:string;note:string;nodes:FlowNode[];edges:FlowEdge[]}
export interface Workflow {id:string;name:string;domain:string;status:WorkflowStatus;version:number;editor:string;updatedAt:string;publishedAt?:string;abnormalCount:number;nodes:FlowNode[];edges:FlowEdge[];versions:Version[]}
/** 业务域在某条流程灰度计划中的路由状态 */
export type DomainRouteStatus='production'|'pilot'|'halted';
/** 申请提交时被路由到的版本通道 */
export type PilotStatus='production'|'pilot'|'rollback';
export interface DomainRoute {domain:string;status:DomainRouteStatus;/** 再开放时指定的执行版本（缺省走候选新版本） */ reopenVersion?:number;/** 纳入试点 / 停批 / 再开放时间 */ updatedAt:string}
export interface RolloutAudit {id:string;action:'start-pilot'|'halt-pilot'|'reopen-pilot'|'publish';domain:string;time:string;operator:string;detail:string;version?:number}
/** 一条流程的分批试点发布计划 */
export interface RolloutPlan {workflowId:string;candidateVersion:number;stableVersion:number;domains:DomainRoute[];audits:RolloutAudit[];updatedAt:string}
export interface Instance {id:string;workflowId:string;applicant:string;domain:string;currentNode:string;status:'abnormal'|'timeout'|'running'|'completed';submittedAt:string;duration:string;risk:'high'|'medium'|'low';timeline:{title:string;time:string;status:string}[];/** 提交时锁定的执行版本，办理中申请不随后续灰度变化 */ execVersion:number;/** 提交时的试点通道状态 */ pilotStatus:PilotStatus}
export interface ValidationIssue {nodeId:string;level:'error'|'warning';message:string}
