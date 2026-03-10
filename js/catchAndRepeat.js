// ==UserScript==
// @name         MWI 抓包并重复 new_character_action
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  捕获发送的 new_character_action 包并允许在界面输入重复次数后重发
// @author       dark-but-spark
// @match        https://test.milkywayidle.com/*
// @match        https://test.milkywayidlecn.com/*
// @grant        none
// @license MIT
// @run-at       document-start
// ==/UserScript==
 
(function() {
    'use strict';
 
    // 保存原始 send
    const originalSend = WebSocket.prototype.send;
    let lastPayload = null;
    let lastSocket = null;
    let hookEnabled = false;

    // 启用/禁用 hook，尽量减少对页面原型的长期修改以降低被检测概率
    function enableHook() {
        if (hookEnabled) return;
        hookEnabled = true;
        WebSocket.prototype.send = function(data) {
            // 先调用原始发送，保持正常行为
            const res = originalSend.apply(this, arguments);
            try {
                let parsed = data;
                if (typeof data === 'string') parsed = JSON.parse(data);
                if (parsed && typeof parsed === 'object' && parsed.type === 'new_character_action') {
                    lastPayload = parsed;
                    lastSocket = this;
                    console.group('%c[catchAndRepeat] 捕获 new_character_action', 'color:#ff9900');
                    console.log(parsed);
                    console.groupEnd();
                    createUI();
                    updateInfo();
                    // 如果 UI 中选择了自动重复，则执行
                    setTimeout(() => {
                        const auto = document.getElementById('catch-repeat-auto');
                        if (auto && auto.checked) {
                            const cnt = parseInt(document.getElementById('catch-repeat-count').value) || 0;
                            const min = parseInt(document.getElementById('catch-repeat-delay-min').value) || 1200;
                            const max = parseInt(document.getElementById('catch-repeat-delay-max').value) || min;
                            if (cnt > 0) sendRepeated(lastPayload, lastSocket, cnt, min, max);
                        }
                    }, 50);

                    // 根据 UI 配置决定是否立即恢复原始 send，减少被检测面板存在时间
                    try {
                        const autoRestore = document.getElementById('catch-auto-restore-hook');
                        if (autoRestore && autoRestore.checked) {
                            // 小延迟以确保当前帧的 send 能正常进行
                            setTimeout(() => { disableHook(); }, 150);
                        }
                    } catch (e) {}
                }
            } catch (e) {
                // 忽略无法解析的数据
            }
            return res;
        };
    }

    function disableHook() {
        if (!hookEnabled) return;
        try { WebSocket.prototype.send = originalSend; } catch (e) {}
        hookEnabled = false;
    }

    // 初始化为启用 hook
    enableHook();
 
    // UI 容器（延迟创建直到 DOM 可用）
    function createUI() {
        if (document.getElementById('catch-repeat-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'catch-repeat-panel';
        panel.style.cssText = `position:fixed;right:12px;bottom:12px;z-index:2147483647;background:rgba(20,20,20,0.9);color:#fff;padding:12px;border-radius:8px;font-family:Segoe UI,Arial,sans-serif;max-width:320px;`;

        const title = document.createElement('div');
        title.textContent = '捕获并重复 new_character_action';
        title.style.cssText = 'font-weight:700;margin-bottom:8px;font-size:13px;cursor:move;';
        panel.appendChild(title);

        // 拖动支持 —— 允许用户通过拖动标题移动面板
        (function enableDrag() {
            let offsetX = 0, offsetY = 0, dragging = false, pointerId = null;
            function onDown(e) {
                pointerId = e.pointerId;
                const rect = panel.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
                dragging = true;
                title.setPointerCapture(pointerId);
                document.addEventListener('pointermove', onMove);
                document.addEventListener('pointerup', onUp, { once: true });
            }
            function onMove(e) {
                if (!dragging) return;
                const x = Math.max(8, e.clientX - offsetX);
                const y = Math.max(8, e.clientY - offsetY);
                panel.style.left = x + 'px';
                panel.style.top = y + 'px';
            }
            function onUp(e) {
                dragging = false;
                try { title.releasePointerCapture(pointerId); } catch (err) {}
                document.removeEventListener('pointermove', onMove);
            }
            title.addEventListener('pointerdown', onDown);
        })();
 
        const info = document.createElement('div');
        info.id = 'catch-repeat-info';
        info.textContent = '未捕获数据';
        info.style.cssText = 'font-size:12px;opacity:0.9;margin-bottom:8px;max-height:72px;overflow:auto;';
        panel.appendChild(info);
 
        // 重复次数输入
        const countInput = document.createElement('input');
        countInput.type = 'number';
        countInput.min = '1';
        countInput.value = '1';
        countInput.style.cssText = 'width:100%;padding:8px;margin-bottom:8px;border-radius:6px;border:1px solid #333;background:#111;color:#fff;';
        countInput.id = 'catch-repeat-count';
        panel.appendChild(countInput);
 
        // 延迟范围输入
        const delayWrap = document.createElement('div');
        delayWrap.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;';
        const minDelay = document.createElement('input');
        minDelay.type = 'number'; minDelay.value = '1200'; minDelay.style.cssText = 'flex:1;padding:6px;border-radius:6px;border:1px solid #333;background:#111;color:#fff;';
        minDelay.id = 'catch-repeat-delay-min';
        const maxDelay = document.createElement('input');
        maxDelay.type = 'number'; maxDelay.value = '1800'; maxDelay.style.cssText = 'flex:1;padding:6px;border-radius:6px;border:1px solid #333;background:#111;color:#fff;';
        maxDelay.id = 'catch-repeat-delay-max';
        delayWrap.appendChild(minDelay);
        delayWrap.appendChild(maxDelay);
        panel.appendChild(delayWrap);
 
        // 自动在捕获时重复
        const autoLabel = document.createElement('label');
        autoLabel.style.cssText = 'display:block;margin-bottom:8px;font-size:12px;cursor:pointer;';
        const autoCheckbox = document.createElement('input');
        autoCheckbox.type = 'checkbox';
        autoCheckbox.style.marginRight = '8px';
        autoCheckbox.id = 'catch-repeat-auto';
        autoLabel.appendChild(autoCheckbox);
        autoLabel.appendChild(document.createTextNode(' 捕获后自动重复'));
        panel.appendChild(autoLabel);

        // 自动恢复 hook（减少长期覆写原型的时间）
        const autoRestoreLabel = document.createElement('label');
        autoRestoreLabel.style.cssText = 'display:block;margin-bottom:8px;font-size:12px;cursor:pointer;';
        const autoRestore = document.createElement('input');
        autoRestore.type = 'checkbox';
        autoRestore.style.marginRight = '8px';
        autoRestore.id = 'catch-auto-restore-hook';
        autoRestore.checked = true;
        autoRestoreLabel.appendChild(autoRestore);
        autoRestoreLabel.appendChild(document.createTextNode(' 捕获后自动恢复原始 send'));
        panel.appendChild(autoRestoreLabel);

        // 发送后自动隐藏/一次性使用
        const oneTimeLabel = document.createElement('label');
        oneTimeLabel.style.cssText = 'display:block;margin-bottom:8px;font-size:12px;cursor:pointer;';
        const oneTimeChk = document.createElement('input');
        oneTimeChk.type = 'checkbox';
        oneTimeChk.style.marginRight = '8px';
        oneTimeChk.id = 'catch-one-time-hide';
        oneTimeLabel.appendChild(oneTimeChk);
        oneTimeLabel.appendChild(document.createTextNode(' 发送后隐藏面板（一次性）'));
        panel.appendChild(oneTimeLabel);

        // 微抖动配置（在 ts 和延迟上添加微小随机偏移）
        const jitterWrap = document.createElement('div');
        jitterWrap.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;align-items:center;';
        const jitterLabel = document.createElement('div');
        jitterLabel.textContent = '微抖(ms):';
        jitterLabel.style.cssText = 'font-size:12px;color:#ccc;';
        const jitterInput = document.createElement('input');
        jitterInput.type = 'number'; jitterInput.value = '300'; jitterInput.style.cssText = 'width:80px;padding:6px;border-radius:6px;border:1px solid #333;background:#111;color:#fff;';
        jitterInput.id = 'catch-jitter-ms';
        jitterWrap.appendChild(jitterLabel);
        jitterWrap.appendChild(jitterInput);
        panel.appendChild(jitterWrap);

        // 重新启用捕获按钮
        const rehookBtn = document.createElement('button');
        rehookBtn.textContent = '重新启用捕获';
        rehookBtn.style.cssText = 'width:100%;padding:8px;margin-bottom:8px;background:#666;border:none;border-radius:6px;color:#fff;cursor:pointer;';
        rehookBtn.onclick = () => { try { enableHook(); } catch (e) { console.error(e); } };
        panel.appendChild(rehookBtn);
 
        // 执行按钮
        const btn = document.createElement('button');
        btn.textContent = '执行重复';
        btn.style.cssText = 'width:100%;padding:10px;background:#1e88e5;border:none;border-radius:6px;color:#fff;font-weight:700;cursor:pointer;';
        btn.onclick = async () => {
            const cnt = parseInt(document.getElementById('catch-repeat-count').value) || 0;
            const min = parseInt(document.getElementById('catch-repeat-delay-min').value) || 0;
            const max = parseInt(document.getElementById('catch-repeat-delay-max').value) || min;
            if (!lastPayload || !lastSocket) {
                alert('未捕获到 new_character_action 包，请先在游戏中执行一次相关操作以捕获');
                return;
            }
            if (cnt < 1) { alert('请输入至少 1 次'); return; }
            btn.disabled = true; btn.textContent = '发送中…';
            await sendRepeated(lastPayload, lastSocket, cnt, min, max);
            btn.disabled = false; btn.textContent = '执行重复';
            updateInfo();
        };
        panel.appendChild(btn);
 
        // 小提示 / 清空
        const footer = document.createElement('div');
        footer.style.cssText = 'font-size:11px;opacity:0.8;margin-top:8px;display:flex;gap:8px;justify-content:space-between;';
        const clearBtn = document.createElement('button');
        clearBtn.textContent = '清除记录';
        clearBtn.style.cssText = 'background:#333;color:#fff;border:none;border-radius:6px;padding:6px;cursor:pointer;';
        clearBtn.onclick = () => { lastPayload = null; lastSocket = null; updateInfo(); };
        footer.appendChild(clearBtn);
        const hint = document.createElement('div');
        hint.textContent = '捕获后可重复发送';
        footer.appendChild(hint);
        panel.appendChild(footer);
 
        document.documentElement.appendChild(panel);
        updateInfo();
        // 确保可见的结束提示如果已有，附着到 panel
        const existingPrompt = document.getElementById('catch-end-prompt');
        if (existingPrompt) {
            panel.appendChild(existingPrompt);
        }
    }
 
    function updateInfo() {
        const info = document.getElementById('catch-repeat-info');
        if (!info) return;
        if (!lastPayload) { info.textContent = '未捕获数据'; return; }
        try {
            const d = lastPayload.newCharacterActionData || {};
            info.textContent = `动作: ${d.actionHrid || '-'} 主物品: ${d.primaryItemHash || '-'} 副物品: ${d.secondaryItemHash || '-'} `;
        } catch (e) { info.textContent = '已捕获（无法预览）'; }
    }
 
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    function randBetween(min, max) { return min >= max ? min : Math.floor(Math.random() * (max - min + 1)) + min; }
 
    async function sendRepeated(payload, socket, count, delayMin, delayMax) {
        for (let i = 0; i < count; i++) {
            try {
                // 发送深拷贝的 payload，避免引用问题；并在 ts 上加入微小随机抖动以模拟人工行为
                const copy = JSON.parse(JSON.stringify(payload));
                try {
                    const jitter = parseInt(document.getElementById('catch-jitter-ms')?.value) || 0;
                    if (copy && typeof copy === 'object' && copy.ts) {
                        const delta = randBetween(-jitter, jitter);
                        // 保证 ts 为整数
                        copy.ts = Number(copy.ts) + delta;
                    }
                } catch (e) {}
                const toSend = JSON.stringify(copy);
                originalSend.call(socket, toSend);
            } catch (e) {
                console.error('重发失败:', e);
            }
            // 在延迟中加入微抖动，避免非常规律的间隔
            const baseWait = randBetween(delayMin || 1200, delayMax || 1800);
            const micro = parseInt(document.getElementById('catch-jitter-ms')?.value) || 0;
            const wait = Math.max(120, baseWait + randBetween(-Math.floor(micro/2), Math.floor(micro/2)));
            await sleep(wait);
        }
        console.log(`已发送 ${count} 次 new_character_action`);
        // 发送完成后显示结束提示
        try { showEndPrompt(`已发送 ${count} 次 new_character_action`); } catch (e) { console.error(e); }
        // 发送完成后根据一次性选项隐藏或移除面板
        try {
            const one = document.getElementById('catch-one-time-hide');
            if (one && one.checked) {
                const panel = document.getElementById('catch-repeat-panel');
                if (panel) panel.remove();
            }
        } catch (e) {}
    }

    // 结束提示：可显示短暂消息并可拖动
    function showEndPrompt(text) {
        let prompt = document.getElementById('catch-end-prompt');
        if (!prompt) {
            prompt = document.createElement('div');
            prompt.id = 'catch-end-prompt';
            prompt.style.cssText = 'position:fixed;right:12px;bottom:80px;z-index:2147483648;background:#2b2b2b;color:#fff;padding:8px 12px;border-radius:8px;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,0.5);cursor:default;min-width:160px;';
            const txt = document.createElement('div');
            txt.id = 'catch-end-prompt-txt';
            prompt.appendChild(txt);
            const close = document.createElement('button');
            close.textContent = '关闭';
            close.style.cssText = 'margin-left:8px;background:#444;border:none;color:#fff;border-radius:6px;padding:4px 6px;cursor:pointer;float:right;';
            close.onclick = () => { try { prompt.remove(); } catch (e){} };
            prompt.appendChild(close);
            document.documentElement.appendChild(prompt);

            // 使提示可拖动
            (function enablePromptDrag() {
                let dragging = false, offsetX = 0, offsetY = 0, pointerId = null;
                prompt.addEventListener('pointerdown', function (e) {
                    // 如果点击的是关闭按钮，跳过拖动
                    if (e.target === close) return;
                    pointerId = e.pointerId;
                    const rect = prompt.getBoundingClientRect();
                    offsetX = e.clientX - rect.left;
                    offsetY = e.clientY - rect.top;
                    prompt.style.right = 'auto';
                    prompt.style.bottom = 'auto';
                    dragging = true;
                    prompt.setPointerCapture(pointerId);
                    document.addEventListener('pointermove', onMove);
                    document.addEventListener('pointerup', onUp, { once: true });
                });
                function onMove(e) {
                    if (!dragging) return;
                    prompt.style.left = Math.max(8, e.clientX - offsetX) + 'px';
                    prompt.style.top = Math.max(8, e.clientY - offsetY) + 'px';
                }
                function onUp(e) {
                    dragging = false;
                    try { prompt.releasePointerCapture(pointerId); } catch (err) {}
                    document.removeEventListener('pointermove', onMove);
                }
            })();
        }
        const txt = document.getElementById('catch-end-prompt-txt');
        if (txt) txt.textContent = text;
        // 如果已经存在，短暂闪现样式
        prompt.style.opacity = '1';
        prompt.style.transition = 'opacity 0.3s ease';
        // 自动淡出（可手动关闭）
        clearTimeout(prompt._hideTimer);
        prompt._hideTimer = setTimeout(() => {
            try { prompt.style.opacity = '0'; setTimeout(()=>prompt.remove(), 400); } catch (e) {}
        }, 4200);
    }
 
    // 覆盖 send，捕获 new_character_action
    WebSocket.prototype.send = function(data) {
        // 先调用原始发送，保持正常行为
        const res = originalSend.apply(this, arguments);
        try {
            let parsed = data;
            if (typeof data === 'string') parsed = JSON.parse(data);
            if (parsed && typeof parsed === 'object' && parsed.type === 'new_character_action') {
                lastPayload = parsed;
                lastSocket = this;
                console.group('%c[catchAndRepeat] 捕获 new_character_action', 'color:#ff9900');
                console.log(parsed);
                console.groupEnd();
                createUI();
                updateInfo();
                // 如果 UI 中选择了自动重复，则执行
                setTimeout(() => {
                    const auto = document.getElementById('catch-repeat-auto');
                    if (auto && auto.checked) {
                        const cnt = parseInt(document.getElementById('catch-repeat-count').value) || 0;
                        const min = parseInt(document.getElementById('catch-repeat-delay-min').value) || 1200;
                        const max = parseInt(document.getElementById('catch-repeat-delay-max').value) || min;
                        if (cnt > 0) sendRepeated(lastPayload, lastSocket, cnt, min, max);
                    }
                }, 50);
            }
        } catch (e) {
            // 忽略无法解析的数据
        }
        return res;
    };
 
    // 在 DOM 可用时创建 UI（如果尚未捕获任何包，也允许手动打开）
    const initObserver = new MutationObserver(() => {
        if (document.body) {
            // 延迟创建，避免页面卡顿
            setTimeout(() => { createUI(); }, 500);
            initObserver.disconnect();
        }
    });
    initObserver.observe(document.documentElement, { childList: true, subtree: true });
 
    // 友好提示
    console.log('%c[catchAndRepeat] 脚本已加载：捕获 new_character_action，面板在右下角。', 'color:#6cf;');
 
})();