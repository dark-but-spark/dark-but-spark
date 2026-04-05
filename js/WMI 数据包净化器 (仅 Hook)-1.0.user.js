// ==UserScript==
// @name         WMI 数据包净化器 (仅 Hook)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  仅负责拦截并修改 WebSocket 数据包：移除 isAuto，添加 ts。不自动点击。
// @author       You
// @match        https://test.milkywayidle.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    console.log('%c[净化器] 已启动 - 正在监听 WebSocket 发送...', 'color: #00ff00; font-weight: bold; font-size: 14px;');

    // 1. 备份原始的 WebSocket send 方法
    const OriginalWebSocket = window.WebSocket;
    const originalSend = OriginalWebSocket.prototype.send;

    // 2. 重写 send 方法
    OriginalWebSocket.prototype.send = function (data) {
        // 检查是否是我们要拦截的数据包 (刷新任务的指令)
        if (typeof data === 'string' && data.includes('reroll_random_task')) {
            try {
                // 解析 JSON
                const json = JSON.parse(data);
                let isModified = false;

                // --- 净化逻辑开始 ---

                // A. 移除顶层的 isAuto (如果存在)
                if (json.isAuto) {
                    delete json.isAuto;
                    isModified = true;
                    console.log('🧹 移除顶层 isAuto');
                }

                // B. 移除数据体内的 isAuto (如果存在)
                if (json.rerollRandomTaskData && json.rerollRandomTaskData.isAuto) {
                    delete json.rerollRandomTaskData.isAuto;
                    isModified = true;
                    console.log('🧹 移除数据体 isAuto');
                }

                // C. 强制添加/更新时间戳 ts
                // 使用当前时间，模拟真实请求
                json.ts = Date.now();
                isModified = true;

                // --- 净化逻辑结束 ---

                if (isModified) {
                    // 重新序列化为字符串
                    const cleanData = JSON.stringify(json);

                    console.log('%c[净化成功] 发送纯净包:', 'color: #00aaff; font-weight: bold;');
                    console.log(cleanData);

                    // 发送修改后的数据
                    return originalSend.call(this, cleanData);
                }

            } catch (e) {
                console.error('[净化器] 解析 JSON 出错:', e);
            }
        }

        // 如果不是目标数据包，或者处理出错，则原样发送
        return originalSend.call(this, data);
    };

})();