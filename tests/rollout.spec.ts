import {test,expect} from '@playwright/test';
// 分批试点发布：按域路由、停批、再开放指定版本、提交锁版本、刷新后记录保留
test.describe('分批试点发布',()=>{
 test('总览与监控按申请显示执行版本与试点状态',async({page})=>{
  await page.goto('/');
  await expect(page.getByTestId('rollout-overview')).toBeVisible();
  const card=page.getByTestId('ro-card').filter({hasText:'差旅费用审批'});
  await expect(card).toContainText('候选 v3');
  await expect(card.getByTestId('domain-badge').filter({hasText:'试点中'})).toHaveCount(2);
  await expect(card.getByTestId('domain-badge').filter({hasText:'停批'})).toHaveCount(1);
  // 异常实例表按申请展示执行版本
  await expect(page.getByTestId('exception-row').first().getByTestId('pilot-badge')).toBeVisible();
  await page.goto('/monitor');
  await expect(page.getByTestId('rollout-panel')).toBeVisible();
  await expect(page.getByTestId('rollout-card')).toBeVisible();
  await expect(page.getByTestId('instance-row').first().getByTestId('pilot-badge')).toBeVisible();
 });
 test('停批试点域：该域后续申请回旧版本，其他试点域照常',async({page})=>{
  await page.goto('/monitor');
  const card=page.getByTestId('rollout-card');
  // 财务试点中（v3），IT服务试点中（v3）
  await expect(card.getByTestId('domain-row-财务')).toContainText('试点中');
  await expect(card.getByTestId('domain-row-IT服务')).toContainText('试点中');
  // 主管停批财务
  await card.getByTestId('halt-财务').click();
  await expect(page.getByRole('status')).toContainText('已停批 财务');
  await expect(card.getByTestId('domain-row-财务')).toContainText('已停批');
  await expect(card.getByTestId('domain-row-财务')).toContainText('v2');
  // 其他试点域不受影响
  await expect(card.getByTestId('domain-row-IT服务')).toContainText('试点中');
  await expect(card.getByTestId('domain-row-IT服务')).toContainText('v3');
  // 停批记录写入审计
  await expect(card.getByTestId('audit-row').filter({hasText:'主管停批'}).first()).toContainText('财务');
  // 预览提交：财务走旧版 v2（阈值 5000），IT服务仍走新版 v3（阈值 8000）
  await page.goto('/workflows/wf-1/preview');
  await expect(page.getByTestId('preview-route')).toContainText('v2');
  await expect(page.getByTestId('preview-route')).toContainText('停批回旧版');
  await page.getByLabel('业务域').selectOption('IT服务');
  await expect(page.getByTestId('preview-route')).toContainText('v3');
  await expect(page.getByTestId('preview-route')).toContainText('试点新版');
  // v3 阈值为 8000：输入 6000 在新版走标准分支
  await page.getByLabel('申请金额').fill('6000');
  await expect(page.getByTestId('branch-result')).toContainText('标准分支');
  await expect(page.locator('.sim-rule')).toContainText('8,000');
 });
 test('停批域再开放时可指定版本，刷新后分配与停批记录仍在',async({page})=>{
  await page.goto('/monitor');
  const card=page.getByTestId('rollout-card');
  // 采购种子状态为已停批
  await expect(card.getByTestId('domain-row-采购')).toContainText('已停批');
  await card.getByTestId('reopen-采购').click();
  await card.getByLabel('再开放版本').selectOption('2');
  await card.getByTestId('reopen-confirm-采购').click();
  await expect(page.getByRole('status')).toContainText('指定 v2');
  await expect(card.getByTestId('domain-row-采购')).toContainText('试点中');
  await expect(card.getByTestId('domain-row-采购')).toContainText('v2');
  await expect(card.getByTestId('audit-row').filter({hasText:'再开放'}).first()).toContainText('采购');
  // 预览中采购新申请按指定 v2 路由
  await page.goto('/workflows/wf-1/preview');
  await page.getByLabel('业务域').selectOption('采购');
  await expect(page.getByTestId('preview-route')).toContainText('v2');
  await expect(page.getByTestId('preview-route')).toContainText('试点新版');
  // 刷新页面：分配与停批 / 再开放记录保留（localStorage 持久化）。下拉回到默认域，重新选择采购
  await page.reload();
  await page.getByLabel('业务域').selectOption('采购');
  await expect(page.getByTestId('preview-route')).toContainText('v2');
  await page.goto('/monitor');
  const card2=page.getByTestId('rollout-card');
  await expect(card2.getByTestId('domain-row-采购')).toContainText('v2');
  await expect(card2.getByTestId('audit-row').filter({hasText:'再开放'})).toContainText(['采购']);
  await expect(card2.getByTestId('audit-row').filter({hasText:'主管停批'})).toContainText(['采购']);
 });
 test('预览提交的申请锁定执行版本，办理中不随后续停批改变',async({page})=>{
  await page.goto('/workflows/wf-1/preview');
  await page.getByLabel('业务域').selectOption('财务'); // 财务试点 v3
  await page.getByLabel('申请说明').fill('差旅申请');
  await page.getByLabel('申请金额').fill('12000');
  await page.getByTestId('preview-submit').click();
  await expect(page.getByTestId('submit-locked')).toContainText('v3');
  const id=await page.getByTestId('submit-locked').innerText();
  const insId=id.match(/INS-\d{4}-\d{4}/)![0];
  // 提交后再停批财务
  await page.goto('/monitor');
  await page.getByTestId('rollout-card').getByTestId('halt-财务').click();
  // 该办理中申请仍显示锁定的 v3
  const row=page.getByTestId('instance-row').filter({hasText:insId});
  await expect(row.getByTestId('pilot-badge')).toContainText('v3');
  await row.click();
  await expect(page.getByTestId('instance-detail')).toContainText('v3');
  await expect(page.locator('.instance-drawer h3').first()).toContainText('v3');
 });
 test('编辑器发起新的分批试点：选域发布，其余域继续现网版本',async({page})=>{
  await page.goto('/workflows/wf-2');
  await page.getByTestId('rollout-button').click();
  await expect(page.getByTestId('rollout-dialog')).toBeVisible();
  await expect(page.getByTestId('rollout-dialog')).toContainText('v3');
  await expect(page.getByTestId('rollout-dialog')).toContainText('现网 v2');
  // 默认勾选所属域（采购），再勾选法务
  await page.getByTestId('pick-法务').click();
  await page.getByTestId('confirm-rollout').click();
  await expect(page.getByRole('status')).toContainText('新申请走新版本');
  // 预览路由：采购走新版 v3；财务仍现网 v2
  await page.goto('/workflows/wf-2/preview');
  await expect(page.getByTestId('preview-route')).toContainText('v3');
  await page.getByLabel('业务域').selectOption('财务');
  await expect(page.getByTestId('preview-route')).toContainText('现网版本');
  await expect(page.getByTestId('preview-route')).toContainText('v2');
  // 监控中出现第二条灰度计划且可停批
  await page.goto('/monitor');
  const newCard=page.getByTestId('rollout-card').filter({hasText:'采购合同审批'});
  await expect(newCard).toBeVisible();
  await newCard.getByTestId('halt-采购').click();
  await expect(newCard.getByTestId('domain-row-采购')).toContainText('已停批');
 });
});
