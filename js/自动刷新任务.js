// ==UserScript==
// @name         WMI测试服自动刷新任务
// @namespace    http://tampermonkey.net/
// @version      2025.09.21.2
// @description  每个任务独立按钮,独立刷新,达标或无法刷新时停止,点击返回键后找不到刷新按钮可停止刷新。可以在任务中配置相关参数。\n目标代币:当任务奖励大于等于目标代笔时停止刷新\n刷新间隔: 如果提示请勿过快发送指令可以适当加大间隔时间\n最大刷新次数:达到次数后即便没有达成目标也会停止可以设置一个很大的值\n随机延迟范围:模拟人类点击行为的随机延迟区间(毫秒)
// @author       dark but spark
// @match        https://test.milkywayidle.com/*
// @icon         https://www.milkywayidle.com/favicon.svg
// @grant        none
// @run-at       document-end
// @license MIT
// ==/UserScript==

(function () {
    'use strict';

    /* ==========  可配置变量  ========== */
    let CHECK_INTERVAL  = 500;   // 全局定时检查间隔
    let MAX_RETRIES     = 1000;   // 单条任务最大刷新次数
    let RETRY_DELAY_MIN = 1500;   // 随机延迟最小值(ms)
    let RETRY_DELAY_MAX = 2500;   // 随机延迟最大值(ms)
    let TARGET_TOKEN    = 25;     // 目标代币数

    /* ==========  随机延迟生成器  ========== */
    function getRandomDelay() {
        return Math.floor(Math.random() * (RETRY_DELAY_MAX - RETRY_DELAY_MIN + 1)) + RETRY_DELAY_MIN;
    }

    /* ==========  配置面板  ========== */
    function insertConfigPanel() {
        const board = document.querySelector('.TasksPanel_taskBoard__VNcZV');
        if (!board || board.querySelector('.auto-config-panel')) return;
        const panel = document.createElement('div');
        panel.className = 'auto-config-panel';
        panel.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin:12px 0;padding:8px;border:1px solid #ccc;border-radius:4px;';

        function row(labelText, defVal, key) {
            const dv = document.createElement('div');
            dv.style.cssText = 'display:flex;align-items:center;gap:6px;';
            const lb = document.createElement('span');
            lb.textContent = labelText;
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.value = defVal;
            inp.style.width = '80px';
            const btn = document.createElement('button');
            btn.textContent = '修改';
            btn.onclick = () => {
                const v = parseInt(inp.value, 10);
                if (v > 0) {
                    switch (key) {
                        case 'TARGET': TARGET_TOKEN = v; break;
                        case 'DELAY_MIN':  RETRY_DELAY_MIN  = v; break;
                        case 'DELAY_MAX':  RETRY_DELAY_MAX  = v; break;
                        case 'MAX':    MAX_RETRIES  = v; break;
                    }
                }
            };
            dv.append(lb, inp, btn);
            return dv;
        }
        panel.append(
            row('目标代币:', TARGET_TOKEN, 'TARGET'),
            row('最小延迟(ms):', RETRY_DELAY_MIN, 'DELAY_MIN'),
            row('最大延迟(ms):', RETRY_DELAY_MAX, 'DELAY_MAX'),
            row('最大刷新次数:', MAX_RETRIES, 'MAX')
        );

        const seqRow = document.createElement('div');
        seqRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:6px;';
        const seqBtn = document.createElement('button');
        seqBtn.textContent = '顺序刷新所有';
        seqBtn.className = 'Button_button__1Fe9z auto-refresh-sequence';
        seqBtn.style.cssText = 'padding:6px 10px;';
        seqBtn.onclick = () => {
            refreshSequential();
        };
        seqRow.appendChild(seqBtn);
        panel.appendChild(seqRow);
        board.insertBefore(panel, board.children[1] || null);
    }

    /* ==========  代币读取  ========== */
    function getToken(task) {
        const rc = task.querySelector('.RandomTask_rewards__YZk7D');
        if (!rc) return 0;
        const its = rc.querySelectorAll('.Item_itemContainer__x7kH1');
        if (its.length < 2) return 0;
        const cnt = its[1].querySelector('.Item_count__1HVvv');
        return cnt ? (parseInt(cnt.textContent, 10) || 0) : 0;
    }

    /* ==========  单任务刷新逻辑  ========== */
    async function refreshSingle(taskCard) {
        const card = taskCard;                       // 当前任务容器
        const taskId = Array.from(document.querySelectorAll('.RandomTask_randomTask__3B9fA')).indexOf(card);
        console.log(`[任务${taskId}] 开始刷新`);

        const resetWrap = card.querySelector('.RandomTask_buttonsContainer__32ypF');
        if (resetWrap) {
            console.log('找到重置父容器');
            const resetGroup = resetWrap.querySelector('.RandomTask_buttonGroup__2gFGO');
            const resetBtn = resetGroup?.querySelector(':scope > button');
            if (resetBtn && resetBtn.textContent.trim() === '重置') {
                resetBtn.click();
                console.log(`[任务${taskId}] 已点击"重置"按钮`);
                await new Promise(r => setTimeout(r, 500)); // 稍等页面更新
            }
        }

        for (let tries = 0; tries < MAX_RETRIES; tries++) {
            const tok = getToken(card);
            if (tok >= TARGET_TOKEN) {
                console.log(`[任务${taskId}] 已达标(${tok})停止`);
                return;
            }
            const rerollBox = card.querySelector('.RandomTask_rerollOptionsContainer__3yFjo');
            if (!rerollBox) {
                console.log(`[任务${taskId}] 找不到刷新容器,终止`);
                return;
            }
            const btn = rerollBox.querySelector('div:first-child button');
            if (!btn) {
                console.log(`[任务${taskId}] 找不到牛铃刷新按钮,终止`);
                return;
            }
            btn.click();
            const delay = getRandomDelay();
            console.log(`[任务${taskId}] 已点击刷新(${tries + 1}/${MAX_RETRIES}),等待 ${delay}ms`);
            await new Promise(r => setTimeout(r, delay));
        }
        console.log(`[任务${taskId}] 已达最大次数,停止`);
    }

    /* ==========  按序刷新所有任务(每个任务只刷新一次,遇到已达标则跳过)  ========== */
    async function refreshSequential() {
        const seqBtn = document.querySelector('.auto-refresh-sequence');
        if (seqBtn) {
            seqBtn.disabled = true;
            seqBtn.textContent = '正在顺序刷新...';
        }
        let cards = Array.from(document.querySelectorAll('.RandomTask_randomTask__3B9fA'));
        console.log('[顺序刷新] 开始按序循环刷新任务,目标代币=' + TARGET_TOKEN + ',共' + cards.length + ' 个');

        // 每个任务的点击计数,防止无限刷新
        const counts = new Array(cards.length).fill(0);

        while (true) {
            let anyClickable = false;
            // 遍历每个任务,按序点击一次(若未达标且未超限)
            for (let idx = 0; idx < cards.length; idx++) {
                const card = cards[idx];
                try {
                    const tok = getToken(card);
                    if (tok >= TARGET_TOKEN) {
                        // 已达标,跳过
                        continue;
                    }
                    if (counts[idx] >= MAX_RETRIES) {
                        console.log(`[顺序刷新] 任务${idx} 已达最大次数(${MAX_RETRIES}),跳过`);
                        continue;
                    }

                    // 若存在重置按钮,则先点击一次以确保刷新选项可见
                    const resetWrap = card.querySelector('.RandomTask_buttonsContainer__32ypF');
                    if (resetWrap) {
                        const resetGroup = resetWrap.querySelector('.RandomTask_buttonGroup__2gFGO');
                        const resetBtn = resetGroup?.querySelector(':scope > button');
                        if (resetBtn && resetBtn.textContent.trim() === '重置') {
                            resetBtn.click();
                            await new Promise(r => setTimeout(r, 300));
                        }
                    }

                    const rerollBox = card.querySelector('.RandomTask_rerollOptionsContainer__3yFjo');
                    if (!rerollBox) {
                        // 无法刷新,跳过
                        continue;
                    }
                    const btn = rerollBox.querySelector('div:first-child button');
                    if (!btn) continue;

                    btn.click();
                    counts[idx]++;
                    anyClickable = true;
                    const delay = getRandomDelay();
                    console.log(`[顺序刷新] 已对任务${idx} 点击一次刷新(第 ${counts[idx]} 次),等待 ${delay}ms`);
                    await new Promise(r => setTimeout(r, delay));
                } catch (e) {
                    console.error('[顺序刷新] 任务' + idx + ' 处理出错,继续下一个', e);
                }
            }

            // 检查是否全部达标或全部超限
            let allDone = true;
            for (let i = 0; i < cards.length; i++) {
                const tok = getToken(cards[i]);
                if (tok < TARGET_TOKEN && counts[i] < MAX_RETRIES) {
                    allDone = false;
                    break;
                }
            }
            if (allDone) {
                console.log('[顺序刷新] 所有任务已达标或达到最大次数,停止循环');
                break;
            }
            if (!anyClickable) {
                console.log('[顺序刷新] 本轮没有可点击的刷新按钮,可能页面未加载或需要手动干预,停止循环');
                break;
            }
            // 继续下一轮(cards DOM 可能变化,尝试刷新引用)
            cards = Array.from(document.querySelectorAll('.RandomTask_randomTask__3B9fA'));
        }

        if (seqBtn) {
            seqBtn.disabled = false;
            seqBtn.textContent = '顺序刷新所有';
        }
    }

    /* ==========  为每个任务插入独立按钮  ========== */
    function addButtons() {
        document.querySelectorAll('.RandomTask_randomTask__3B9fA').forEach((card, idx) => {
            if (card.querySelector('.auto-refresh-single')) return; // 已存在
            const box = card;
            const bt = document.createElement('button');
            bt.className = 'Button_button__1Fe9z Button_fullWidth__17pVU auto-refresh-single';
            bt.style.cssText = 'box-shadow:none;margin-top:6px;';
            bt.innerHTML = `<span>自动刷新</span>`;
            bt.onclick = () => refreshSingle(card);
            box.appendChild(bt);
        });
    }

    /* ==========  定时检查并补充按钮 / 配置面板  ========== */
    function run() {
        insertConfigPanel();
        addButtons();
    }
    run();
    setInterval(run, CHECK_INTERVAL);

    /* ==========  监听 DOM 变化  ========== */
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
})();