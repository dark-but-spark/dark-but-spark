// ==UserScript==
// @name         【银河奶牛测试服】一键购买测试商店物品
// @namespace    http://tampermonkey.net/
// @version      0.2.2
// @description  仅用于测试服，在生产炼金强化界面一键购买所需的测试商店物品
// @author       Q7
// @icon         https://www.milkywayidle.com/favicon.svg
// @match        https://test.milkywayidle.com/*
// @match        https://test.milkywayidlecn.com/*
// @grant        none
// @run-at       document-start
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/570497/%E3%80%90%E9%93%B6%E6%B2%B3%E5%A5%B6%E7%89%9B%E6%B5%8B%E8%AF%95%E6%9C%8D%E3%80%91%E4%B8%80%E9%94%AE%E8%B4%AD%E4%B9%B0%E6%B5%8B%E8%AF%95%E5%95%86%E5%BA%97%E7%89%A9%E5%93%81.user.js
// @updateURL https://update.greasyfork.org/scripts/570497/%E3%80%90%E9%93%B6%E6%B2%B3%E5%A5%B6%E7%89%9B%E6%B5%8B%E8%AF%95%E6%9C%8D%E3%80%91%E4%B8%80%E9%94%AE%E8%B4%AD%E4%B9%B0%E6%B5%8B%E8%AF%95%E5%95%86%E5%BA%97%E7%89%A9%E5%93%81.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. WebSocket 拦截器 ---
    let activeWS = null;
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function(data) {
        if (!activeWS || activeWS.readyState !== WebSocket.OPEN) {
            activeWS = this;
        }
        return originalSend.apply(this, arguments);
    };

    // --- 2. UI 样式 ---
    function initUI() {
        if (document.getElementById('mwi-v5-2-style')) return;
        const style = document.createElement('style');
        style.id = 'mwi-v5-2-style';
        style.innerHTML = `
            .Item_itemContainer__x7kH1 {
                display: inline-flex !important;
                flex-direction: row !important;
                align-items: center !important;
                vertical-align: middle !important;
            }
            .mwi-wss-buy-btn {
                display: inline-flex !important;
                align-items: center;
                justify-content: center;
                width: 20px; height: 20px; margin-left: 6px;
                background-color: #27ae60; color: white;
                border: 1px solid #1e7e34; border-radius: 4px;
                font-size: 11px; cursor: pointer; flex-shrink: 0; font-weight: bold;
            }
            .mwi-wss-buy-btn:hover { background-color: #2ecc71; }

            /* 一键购买按钮样式 */
            .mwi-buy-all-house {
                width: 100%; margin: 8px 0; padding: 8px;
                background-color: #2980b9; color: white;
                border: 1px solid #1c5982; border-radius: 4px;
                font-size: 13px; font-weight: bold; cursor: pointer;
            }
            .mwi-buy-all-house:disabled {
                background-color: #7f8c8d; cursor: not-allowed;
            }

            #mwi-quick-input-popover {
                position: fixed; z-index: 100000; background: #2c3e50; padding: 6px;
                border-radius: 4px; display: none; align-items: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.6); border: 1px solid #455a64;
            }
            #mwi-quick-input-popover input {
                width: 70px; height: 24px; background: #1a252f; border: 1px solid #7f8c8d;
                color: white; font-size: 13px; padding: 0 6px; outline: none;
            }
            #mwi-quick-input-popover button {
                margin-left: 6px; padding: 0 8px; height: 24px; background: #27ae60;
                color: white; border: none; cursor: pointer; border-radius: 2px;
            }
        `;
        document.head.appendChild(style);

        if (!document.getElementById('mwi-quick-input-popover')) {
            const popover = document.createElement('div');
            popover.id = 'mwi-quick-input-popover';
            popover.innerHTML = `<input type="number" id="mwi-popover-qty" min="1"><button id="mwi-popover-buy">购买</button>`;
            document.body.appendChild(popover);
            document.addEventListener('mousedown', (e) => {
                const pop = document.getElementById('mwi-quick-input-popover');
                if (pop.style.display === 'flex' && !pop.contains(e.target) && !e.target.classList.contains('mwi-wss-buy-btn')) {
                    pop.style.display = 'none';
                }
            });
        }
    }

    // --- 3. 指令发送函数 ---
    function sendBuyPacket(itemId, count) {
        if (!activeWS || count <= 0) return;
        activeWS.send(JSON.stringify({
            type: "buy_from_shop",
            buyFromShopData: { shopItemHrid: `/shop_items/test/${itemId}`, count: parseInt(count) },
            ts: Date.now()
        }));
    }

    function parseNum(s) {
        if (!s) return 0;
        s = s.replace(/[/\s,]/g, '').toUpperCase();
        let n = parseFloat(s);
        if (s.includes('K')) n *= 1000;
        if (s.includes('M')) n *= 1000000;
        if (s.includes('B')) n *= 1000000000;
        return isNaN(n) ? 0 : n;
    }

    // --- 4. 核心：异步排队购买逻辑 ---
    async function handleBuyAllHouse(container, btn) {
        const inventorySpans = container.querySelectorAll('[class*="inventoryCount"]');
        const requirementSpans = container.querySelectorAll('[class*="inputCount"]');
        const wrappers = container.querySelectorAll('.Item_itemContainer__x7kH1');

        // 1. 扫描所有需要购买的项目
        const tasks = [];
        wrappers.forEach((wrapper, i) => {
            const svgUse = wrapper.querySelector('use');
            if (!svgUse) return;
            const itemId = svgUse.getAttribute('href').split('#')[1];
            if (itemId === 'coin') return;

            const has = parseNum(inventorySpans[i]?.innerText);
            const req = parseNum(requirementSpans[i]?.innerText);
            const diff = Math.max(0, Math.ceil(req - has));

            if (diff > 0) {
                tasks.push({ itemId, diff });
            }
        });

        if (tasks.length === 0) {
            btn.innerText = "✅ 材料已充足";
            setTimeout(() => btn.innerText = "🛒 一键补全所有房屋材料", 2000);
            return;
        }

        // 2. 开始排队执行
        btn.disabled = true;
        let successCount = 0;

        for (const task of tasks) {
            btn.innerText = `⏳ 正在购买: ${task.itemId} (${successCount + 1}/${tasks.length})...`;
            sendBuyPacket(task.itemId, task.diff);

            successCount++;
            // 每次购买后等待 800毫秒，给服务器喘息时间
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        // 3. 完成反馈
        btn.innerText = "✅ 一键购买完成！";
        setTimeout(() => {
            btn.disabled = false;
            btn.innerText = "🛒 一键补全所有房屋材料";
        }, 3000);
    }

    // --- 5. 注入逻辑 ---
    function refreshButtons() {
        const houseRequirements = document.querySelector('.HousePanel_itemRequirements__1qFjZ');

        if (houseRequirements) {
            let buyAllBtn = document.querySelector('.mwi-buy-all-house');
            if (!buyAllBtn) {
                buyAllBtn = document.createElement('button');
                buyAllBtn.className = 'mwi-buy-all-house';
                buyAllBtn.innerText = '🛒 一键补全所有房屋材料';
                buyAllBtn.onclick = () => handleBuyAllHouse(houseRequirements, buyAllBtn);
                houseRequirements.parentNode.insertBefore(buyAllBtn, houseRequirements);
            }
        }

        const allContainers = document.querySelectorAll('[class*="itemRequirements"]');
        allContainers.forEach(container => {
            const inventorySpans = container.querySelectorAll('[class*="inventoryCount"]');
            const requirementSpans = container.querySelectorAll('[class*="inputCount"]');
            const itemWrappers = container.querySelectorAll('.Item_itemContainer__x7kH1');

            itemWrappers.forEach((wrapper, i) => {
                const svgUse = wrapper.querySelector('use');
                if (!svgUse) return;
                const itemId = svgUse.getAttribute('href').split('#')[1];
                if (itemId === 'coin' || wrapper.innerText.includes("金币")) return;

                const has = parseNum(inventorySpans[i]?.innerText);
                const req = parseNum(requirementSpans[i]?.innerText);
                const diff = Math.max(0, Math.ceil(req - has));

                let btn = wrapper.querySelector('.mwi-wss-buy-btn');
                if (!btn) {
                    btn = document.createElement('button');
                    btn.className = 'mwi-wss-buy-btn';
                    btn.innerText = '购';
                    wrapper.appendChild(btn);
                }
                btn.title = `缺: ${diff}`;
                btn.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const pop = document.getElementById('mwi-quick-input-popover');
                    const inp = document.getElementById('mwi-popover-qty');
                    const bBtn = document.getElementById('mwi-popover-buy');
                    const rect = btn.getBoundingClientRect();
                    pop.style.left = `${rect.left}px`;
                    pop.style.top = `${rect.bottom + window.scrollY + 5}px`;
                    pop.style.display = 'flex';
                    inp.value = diff > 0 ? diff : 1;
                    inp.focus(); inp.select();
                    bBtn.onclick = () => { sendBuyPacket(itemId, inp.value); pop.style.display = 'none'; };
                    inp.onkeydown = (ev) => {
                        if (ev.key === 'Enter') { sendBuyPacket(itemId, inp.value); pop.style.display = 'none'; }
                        if (ev.key === 'Escape') pop.style.display = 'none';
                    };
                };
            });
        });
    }

    let debounce;
    const observer = new MutationObserver(() => {
        clearTimeout(debounce);
        debounce = setTimeout(refreshButtons, 150);
    });

    function start() {
        if (!document.body) { setTimeout(start, 100); return; }
        initUI();
        observer.observe(document.body, { childList: true, subtree: true });
        refreshButtons();
    }
    start();
})();