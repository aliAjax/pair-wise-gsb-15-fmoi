import {test,expect} from '@playwright/test';

test.describe.serial('按业务域分批试点发布',()=>{
 test('监控控制台初始试点状态：财务/人力/IT 试点 v2，采购/法务现网',async({page})=>{
  await page.goto('/monitor');
  await expect(page.getByTestId('pilot-console')).toBeVisible();
  const fin=page.getByTestId('pilot-row').filter({hasText:'财务'});
  await expect(fin).toContainText('试点中');
  await expect(fin).toContainText('v2');
  const pur=page.getByTestId('pilot-row').filter({hasText:'采购'});
  await expect(pur).toContainText('未试点');
  await expect(pur).toContainText('v1');
 });

 test('总览按申请显示执行版本与试点状态',async({page})=>{
  await page.goto('/');
  await expect(page.getByTestId('pilot-overview')).toBeVisible();
  await expect(page.getByTestId('pilot-overview')).toContainText('分批试点发布');
  await page.getByTestId('pilot-chip').filter({hasText:'财务'}).click();
  await expect(page).toHaveURL(/\/monitor$/);
 });

 test('停批一个试点域：该域后续申请回旧版本，其他试点域照常，办理中实例版本不变',async({page})=>{
  await page.goto('/monitor');
  const rows=page.getByTestId('instance-row');
  const firstFin=rows.filter({hasText:'财务'}).first();
  await firstFin.click();
  const beforeText=await page.getByTestId('detail-version').innerText();
  const beforeVersion=(beforeText.match(/v\d+/)||['v?'])[0];
  await page.locator('[data-testid="instance-detail"] .icon-btn').click();
  // 停批财务域
  await page.getByTestId('stop-财务').click();
  await expect(page.getByRole('status')).toContainText('已停批');
  const finRow=page.getByTestId('pilot-row').filter({hasText:'财务'});
  await expect(finRow).toContainText('已停批');
  await expect(finRow).toContainText('v1');
  // 其他试点域照常
  const hrRow=page.getByTestId('pilot-row').filter({hasText:'人力资源'});
  await expect(hrRow).toContainText('试点中');
  await expect(hrRow).toContainText('v2');
  // 办理中的申请仍保留提交时版本
  await firstFin.click();
  await expect(page.getByTestId('detail-version')).toContainText(beforeVersion.replace(/\s|·.*$/,'').trim());
 });

 test('停批后预览新申请自动路由到旧版本',async({page})=>{
  await page.goto('/monitor');
  await page.getByTestId('stop-财务').click();
  await expect(page.getByRole('status')).toContainText('已停批');
  await page.goto('/workflows/wf-1/preview');
  await page.getByLabel('申请业务域').selectOption('财务');
  await expect(page.getByTestId('route-hint')).toContainText('已停批');
  await expect(page.getByTestId('route-hint')).toContainText('提交后执行 v1');
  await page.getByLabel('申请说明').fill('停批后的财务申请');
  await page.getByLabel('申请金额').fill('1200');
  await page.getByTestId('preview-submit').click();
  await expect(page.getByTestId('submit-receipt')).toContainText('执行版本');
  await expect(page.getByTestId('submit-receipt')).toContainText('v1');
  await expect(page.getByTestId('submit-receipt')).toContainText('停批回旧');
  await page.getByRole('button',{name:'去监控查看'}).click();
  await expect(page).toHaveURL(/\/monitor\?instance=INS-/);
  await expect(page.getByTestId('instance-detail')).toContainText('v1');
 });

 test('试点域的预览新申请走新版本，其他域继续现网',async({page})=>{
  await page.goto('/workflows/wf-1/preview');
  await page.getByLabel('申请业务域').selectOption('人力资源');
  await expect(page.getByTestId('route-hint')).toContainText('试点中');
  await expect(page.getByTestId('route-hint')).toContainText('提交后执行 v2');
  await page.getByLabel('申请说明').fill('试点期人力申请');
  await page.getByLabel('申请金额').fill('300');
  await page.getByTestId('preview-submit').click();
  await expect(page.getByTestId('submit-receipt')).toContainText('v2');
  await expect(page.getByTestId('submit-receipt')).toContainText('试点中');
  await page.goto('/workflows/wf-3/preview');
  await page.getByLabel('申请业务域').selectOption('法务');
  await expect(page.getByTestId('route-hint')).toContainText('现网版本');
  await expect(page.getByTestId('route-hint')).toContainText('提交后执行 v1');
 });

 test('重新开放时指定版本 v1 或 v2，记录保留',async({page})=>{
  await page.goto('/monitor');
  const fin=page.getByTestId('pilot-row').filter({hasText:'财务'});
  await page.getByTestId('stop-财务').click();
  await expect(page.getByRole('status')).toContainText('已停批');
  await fin.getByLabel('财务 开放版本').selectOption('1');
  await page.getByTestId('start-财务').click();
  await expect(page.getByRole('status')).toContainText('开放试点');
  await expect(fin).toContainText('试点中');
  await expect(fin).toContainText('v1');
  // 再停批、以 v2 重新开放
  await page.getByTestId('stop-财务').click();
  await fin.getByLabel('财务 开放版本').selectOption('2');
  await page.getByTestId('start-财务').click();
  await expect(fin).toContainText('v2');
  // 停批与开放记录都在
  const log=page.getByTestId('pilot-log');
  await expect(log).toContainText('财务');
  await expect(log).toContainText('停批回退');
  await expect(log).toContainText('重新开放');
  // 重开后刷新：分配和停批记录仍在
  await page.reload();
  const fin2=page.getByTestId('pilot-row').filter({hasText:'财务'});
  await expect(fin2).toContainText('试点中');
  await expect(fin2).toContainText('v2');
  await expect(page.getByTestId('pilot-log')).toContainText('停批回退');
 });
});
