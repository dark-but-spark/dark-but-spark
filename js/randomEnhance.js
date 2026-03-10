// ==UserScript==
// @name         testMWI 装备强化 - 批量随机强化
// @version      1.0.2
// @namespace    http://tampermonkey.net/
// @description  salal强化法
// @author       dark-but-spark
// @match        https://test.milkywayidle.com/*
// @match        https://test.milkywayidlecn.com/*
// @grant        none
// @run-at       document-body
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/569143/testMWI%20%E8%A3%85%E5%A4%87%E5%BC%BA%E5%8C%96%20-%20%E6%89%B9%E9%87%8F%E9%9A%8F%E6%9C%BA%E5%BC%BA%E5%8C%96.user.js
// @updateURL https://update.greasyfork.org/scripts/569143/testMWI%20%E8%A3%85%E5%A4%87%E5%BC%BA%E5%8C%96%20-%20%E6%89%B9%E9%87%8F%E9%9A%8F%E6%9C%BA%E5%BC%BA%E5%8C%96.meta.js
// ==/UserScript==

(function() {
    'use strict';
    let ws = null;
    const urlParams = new URLSearchParams(window.location.search);
    const characterId = urlParams.get('characterId');
    // 异步 sleep，支持随机延迟
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    function sleepRandom(min = 800, max = 1400) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        return sleep(delay);
    }

    // Hook WebSocket（支持所有域名） — chain with any existing getter to avoid conflicts
    (function() {
        const prevDesc = Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'data') || {};
        const prevGet = prevDesc.get;
        Object.defineProperty(MessageEvent.prototype, 'data', {
            get: function() {
                const data = prevGet ? prevGet.call(this) : undefined;
                const socket = this.currentTarget;
                try {
                    if (socket instanceof WebSocket &&
                        (socket.url.includes('milkywayidle.com/ws') || socket.url.includes('milkywayidlecn.com/ws')) &&
                        socket.readyState === 1) {
                        ws = socket;
                    }
                } catch (e) {}
                return data;
            },
            configurable: true
        });
    })();


    // 监控页面变化，添加自定义控件
    const observer = new MutationObserver(() => {
        const enhanceBtn = document.querySelector('.Button_button__1Fe9z.Button_success__6d6kU.Button_fullWidth__17pVU.Button_large__yIDVZ');
        if (!enhanceBtn || enhanceBtn.parentNode.querySelector('.custom-random-batch-btn')) return;

        // 队列数量标签
        const queueLabel = document.createElement('label');
        queueLabel.textContent = '队列数量：';
        queueLabel.style.cssText = 'display: block; margin-top: 8px; font-size: 16px; font-weight: bold;';

        // 输入框选择任务重复次数
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = '5000';
        input.value = '10'; // 默认值
        input.style.cssText = 'width: 100%; padding: 10px; margin-top: 8px; font-size: 16px; border-radius: 6px;';

        // 批量强化按钮
        const batchBtn = document.createElement('button');
        batchBtn.textContent = '随机强化';
        batchBtn.className = 'custom-random-batch-btn';
        batchBtn.style.cssText = `
            margin-top: 12px;
            width: 100%;
            padding: 14px;
            font-size: 18px;
            background: #FF5722;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
        `;

        // 点击逻辑
        batchBtn.onclick = async () => {
            const repeatCount = parseInt(input.value);
            if (isNaN(repeatCount) || repeatCount < 1 || repeatCount > 5000) {
                alert('❌ 请输入有效的重复次数（1-5000）！');
                return;
            }

            if (!ws) {
                alert('❌ WebSocket 未连接！请先手动点一次强化操作再试');
                return;
            }
            const primaryContainer = document.querySelector('.SkillActionDetail_primaryItemSelectorContainer__nrvNW');
            if (!primaryContainer) {
                alert('❌ 未找到主物品容器！请确认已选择装备');
                return;
            }
            const useHref = primaryContainer.querySelector('use')?.getAttribute('href');
            if (!useHref) {
                alert('❌ 未读取到装备图标！请确认已选择主物品');
                return;
            }
            const hrid = useHref.split('#')[1];

            let count = 0;

            for (let i = 0; i < repeatCount; i++) {
                const createMessage = {
                    type: "new_character_action",
                    newCharacterActionData: {
                        actionHrid: "/actions/enhancing/enhance",
                        primaryItemHash: `${characterId}::/item_locations/inventory::/items/${hrid}::0`,
                        secondaryItemHash: `${characterId}::/item_locations/inventory::/items/mirror_of_protection::0`,
                        enhancingMaxLevel: 20,
                        enhancingProtectionMinLevel: 2,
                        characterLoadoutId: 0,
                        shouldClearQueue: false,
                        hasMaxCount: true,
                        maxCount: 10
                    }
                };
                ws.send(JSON.stringify(createMessage));
                count++;
                await sleepRandom(1500, 2000);
            }

            alert(`✅ 批量强化完成！\n共发送 ${count} 次指令`);
        };

        // 插入控件（标签和输入框在上，按钮在下）
        enhanceBtn.parentNode.appendChild(queueLabel);
        enhanceBtn.parentNode.appendChild(input);
        enhanceBtn.parentNode.appendChild(batchBtn);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log('🎯 MWI 批量强化脚本已加载,选择基底等级并自动添加相应数量到行动队列');
})();