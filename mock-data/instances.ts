import type {Instance} from '../src/types';
import {domains,users} from './catalog';
// wf-1（差旅费用审批）的灰度种子：财务、IT服务 试点新版本 v3；采购已停批，新申请回旧版 v2；其余域走现网
const pilotDomains=new Set(['财务','IT服务']);
const haltedDomains=new Set(['采购']);
export const instances:Instance[]=Array.from({length:80},(_,i)=>{const status:Instance['status']=i<12?'abnormal':i<22?'timeout':i<50?'running':'completed'; const workflowNo=i%12+1; const domain=domains[i%5];
 const inRollout=workflowNo===1; const halted=inRollout&&haltedDomains.has(domain); const piloted=inRollout&&pilotDomains.has(domain);
 // 申请锁定提交时版本：办理中申请不随后续停批 / 再开放而改变
 const execVersion=halted?2:piloted?3:i%2+1;
 const pilotStatus:Instance['pilotStatus']=halted?'rollback':piloted?'pilot':'production';
 return {id:`INS-2026-${String(i+1).padStart(4,'0')}`,workflowId:`wf-${workflowNo}`,applicant:users[i%8],domain,currentNode:i%3===0?'直属主管审批':'金额判断',status,submittedAt:`2026-07-${String(10-i%9).padStart(2,'0')} ${String(8+i%10).padStart(2,'0')}:10`,duration:status==='timeout'?`${28+i}h`:`${i%9+1}h ${i%6*10}m`,risk:i<22?'high':i<45?'medium':'low',execVersion,pilotStatus,timeline:[{title:'提交申请',time:'09:10',status:'completed'},{title:'直属主管审批',time:'10:24',status:i%3===0?'current':'completed'},{title:'金额判断',time:'11:05',status:i%3!==0?'current':'pending'}]};});
