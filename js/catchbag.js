// ==UserScript==
// @name         MWI 专包抓取器 - new_character_action
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  仅拦截并打印 type 为 "new_character_action" 的 WebSocket 发送包
// @author       You
// @match        https://test.milkywayidle.com/*
// @match        https://test.milkywayidlecn.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('%c[抓包器] 已启动，正在监听 new_character_action...', 'color: #00ff00; font-weight: bold;');

    // 保存原生 send 方法
    const originalSend = WebSocket.prototype.send;

    // Hook send 方法
    WebSocket.prototype.send = function(data) {
        // 先执行原生发送，保证游戏正常运行
        const result = originalSend.apply(this, arguments);

        try {
            // 尝试解析数据
            let parsed = data;
            if (typeof data === 'string') {
                parsed = JSON.parse(data);
            }

            // 【核心过滤】只处理 type 为 new_character_action 的包
            if (parsed && typeof parsed === 'object' && parsed.type === 'new_character_action') {
                console.group('%c[捕获] new_character_action', 'color: #ff9900; font-weight: bold; background: #222; padding: 4px;');
                console.log('📡 目标 URL:', this.url);
                console.log('📦 完整 Payload:', parsed);
                
                // 提取关键信息方便查看
                const info = parsed.newCharacterActionData || {};
                console.log('🔑 关键参数:', {
                    动作: info.actionHrid,
                    主物品: info.primaryItemHash,
                    副物品: info.secondaryItemHash,
                    最大等级: info.enhancingMaxLevel,
                    次数: info.maxCount
                });
                console.groupEnd();
            }
        } catch (e) {
            // 忽略非 JSON 数据或解析错误
        }

        return result;
    };
})();