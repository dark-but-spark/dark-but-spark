// ==UserScript==
// @name           MWI 迷宫自动化 (WebSocket 发包版)
// @namespace      http://tampermonkey.net/
// @version        2.0
// @description    通过 WebSocket 直接发包实现迷宫自动运行 - 更高效可靠
// @author         dark-but-spark
// @match          https://test.milkywayidle.com/*
// @match          https://test.milkywayidlecn.com/*
// @match          https://milkywayidle.com/*
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_xmlhttpRequest
// @connect        *
// @run-at         document-end
// @license        MIT
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置参数 ====================
    const CONFIG = {
        checkInterval: GM_getValue('labyrinth_ws_checkInterval', 30 * 60 * 1000), // 状态检测间隔 (默认 30 分钟)
        enableAuto: GM_getValue('labyrinth_ws_enableAuto', true),
        ticketCheckInterval: 5000, // 入场券冷却检测间隔
        maxReplenishAttempts: 3, // 补充入场券最大尝试次数
        endLabyrinthWait: 10000, // 结束迷宫后等待返回主界面的最大时间
        actionPollInterval: 3000, // 行动队列轮询间隔 (毫秒)
        useWebSocket: GM_getValue('labyrinth_ws_useWebSocket', true), // 是否使用 WebSocket 模式
    };

    // ==================== WebSocket 管理器 ====================
    class WebSocketManager {
        constructor() {
            this.ws = null;
            this.isConnected = false;
            this.messageHandlers = new Map();
            this.pendingRequests = new Map();
            this.requestId = Date.now();
            this.intercepted = false;
            
            // 监听全局 WebSocket
            this.setupWebSocketInterceptor();
        }

        /**
         * 设置 WebSocket 拦截器，获取游戏现有的 WebSocket 连接
         */
        setupWebSocketInterceptor() {
            if (this.intercepted) return;
            this.intercepted = true;
            
            const self = this;
            const OriginalWebSocket = window.WebSocket;
            
            // 重写 WebSocket 构造函数
            window.WebSocket = function(url, protocols) {
                // 检查是否是游戏服务器
                if (url.includes('milkywayidle.com') && url.includes('/ws')) {
                    log(`🔌 拦截到游戏 WebSocket 连接：${url}`, 'success');
                    
                    // 创建新的 WebSocket 实例
                    const ws = new OriginalWebSocket(url, protocols);
                    
                    // 保存引用（只保存第一个游戏连接）
                    if (!self.ws) {
                        self.ws = ws;
                        self.isConnected = true;
                        
                        // 监听消息
                        ws.addEventListener('message', (event) => {
                            try {
                                const data = JSON.parse(event.data);
                                self.handleServerMessage(data);
                            } catch (e) {
                                // 忽略解析错误
                            }
                        });
                        
                        // 监听连接状态
                        ws.addEventListener('open', () => {
                            log('✅ WebSocket 已连接', 'success');
                            self.isConnected = true;
                        });
                        
                        ws.addEventListener('close', () => {
                            log('⚠️ WebSocket 已关闭', 'warn');
                            self.isConnected = false;
                        });
                        
                        ws.addEventListener('error', (e) => {
                            log('❌ WebSocket 错误', 'error');
                        });
                    }
                    
                    return ws;
                }
                
                // 非游戏服务器的连接使用原始 WebSocket
                return new OriginalWebSocket(url, protocols);
            };
            
            // 保持原型链
            window.WebSocket.prototype = OriginalWebSocket.prototype;
        }

        /**
         * 发送数据包到服务器
         */
        async send(type, data = {}) {
            if (!this.ws || !this.isConnected) {
                log('❌ WebSocket 未连接', 'error');
                return Promise.reject(new Error('WebSocket 未连接'));
            }

            const packet = {
                type: type,
                ...data,
                ts: Date.now()
            };

            log(`📤 发送 ${type}:`, 'info');
            
            return new Promise((resolve, reject) => {
                try {
                    this.ws.send(JSON.stringify(packet));
                    
                    // 设置超时
                    const timeoutId = setTimeout(() => {
                        this.pendingRequests.delete(type);
                        reject(new Error(`${type} 请求超时`));
                    }, 10000);
                    
                    // 保存回调
                    this.pendingRequests.set(type, { resolve, reject, timeoutId });
                } catch (e) {
                    reject(e);
                }
            });
        }

        /**
         * 处理服务器返回的消息
         */
        handleServerMessage(data) {
            // 处理待处理的请求响应
            if (this.pendingRequests.has(data.type)) {
                const { resolve, timeoutId } = this.pendingRequests.get(data.type);
                clearTimeout(timeoutId);
                this.pendingRequests.delete(data.type);
                resolve(data);
            }
            
            // 调用注册的处理器
            if (this.messageHandlers.has(data.type)) {
                const handlers = this.messageHandlers.get(data.type);
                handlers.forEach(handler => handler(data));
            }
        }

        /**
         * 注册消息处理器
         */
        onMessage(type, handler) {
            if (!this.messageHandlers.has(type)) {
                this.messageHandlers.set(type, []);
            }
            this.messageHandlers.get(type).push(handler);
        }

        /**
         * 获取当前 WebSocket 状态
         */
        getStatus() {
            return {
                connected: this.isConnected,
                hasWs: !!this.ws,
                intercepted: this.intercepted
            };
        }
    }

    // ==================== 游戏数据管理 ====================
    class GameDataManager {
        constructor(wsManager) {
            this.wsManager = wsManager;
            this.ticketCount = { current: 0, max: 0 };
            this.isInLabyrinth = false;
            this.isActionRunning = false;
            this.actionEndTime = 0;
            this.torches = 0;
            this.lastSyncTime = 0;
            
            // 监听游戏数据更新
            this.setupDataListeners();
        }

        /**
         * 设置数据监听器
         */
        setupDataListeners() {
            const self = this;
            
            // 监听迷宫相关消息
            this.wsManager.onMessage('labyrinth_info', (data) => {
                if (data.labyrinthData) {
                    self.updateLabyrinthState(data.labyrinthData);
                }
            });
            
            // 监听行动开始消息
            this.wsManager.onMessage('new_character_action', (data) => {
                if (data.actionData && data.actionData.actionHrid && data.actionData.actionHrid.includes('labyrinth')) {
                    self.isActionRunning = true;
                    self.isInLabyrinth = true;
                    log('✅ 迷宫行动已开始', 'success');
                    
                    // 计算结束时间
                    if (data.actionData.endTime) {
                        self.actionEndTime = data.actionData.endTime;
                    }
                }
            });
            
            // 监听行动完成/结束消息
            this.wsManager.onMessage('action_completed', (data) => {
                self.isActionRunning = false;
                log('ℹ️ 行动已完成', 'info');
            });
            
            // 监听逃出迷宫消息
            this.wsManager.onMessage('escape_labyrinth', (data) => {
                self.isInLabyrinth = false;
                self.isActionRunning = false;
                log('⚠️ 已逃出迷宫', 'warn');
            });
            
            // 监听角色数据更新
            this.wsManager.onMessage('character_data', (data) => {
                if (data.characterData) {
                    self.updateCharacterData(data.characterData);
                }
            });
            
            // 定期同步状态
            setInterval(() => {
                self.syncGameState();
            }, 5000);
        }

        /**
         * 更新迷宫状态
         */
        updateLabyrinthState(labyrinthData) {
            this.isInLabyrinth = labyrinthData.inLabyrinth || false;
            this.torches = labyrinthData.torches || 0;
            log(`🔄 迷宫状态更新：在迷宫=${this.isInLabyrinth}, 火把=${this.torches}`, 'info');
        }

        /**
         * 更新角色数据
         */
        updateCharacterData(characterData) {
            // 更新入场券数量
            if (characterData.labyrinthEntries !== undefined) {
                this.ticketCount.current = characterData.labyrinthEntries;
                this.ticketCount.max = characterData.maxLabyrinthEntries || 5;
            }
            
            // 更新火把数量
            if (characterData.currencies) {
                const torchCurrency = characterData.currencies.find(c => 
                    c.hrid && c.hrid.includes('torch')
                );
                if (torchCurrency) {
                    this.torches = torchCurrency.amount || 0;
                }
            }
            
            log(`🎫 门票：${this.ticketCount.current}/${this.ticketCount.max}, 🔥 火把：${this.torches}`, 'info');
        }

        /**
         * 同步游戏状态
         */
        syncGameState() {
            // 优先从 DOM 同步作为兜底
            this.syncFromDom();
        }

        /**
         * 从 DOM 同步状态（作为兜底方案）
         */
        syncFromDom() {
            // 入场券数量
            const ticketEl = document.querySelector('.LabyrinthPanel_chargeCount__1GDLP');
            if (ticketEl) {
                // 使用正则表达式确保格式符合"入场券： {cnt} / 5"的要求
                const match = ticketEl.textContent.match(/入场券\s*：\s*(\d+)\s*\/\s*5/);
                if (match) {
                    this.ticketCount.current = parseInt(match[1]);
                    this.ticketCount.max = 5; // 固定为5
                }
            }
            
            // 是否在迷宫中
            const statusIcon = document.querySelector('[aria-label="Icon"] use[href*="#labyrinth"]');
            this.isInLabyrinth = !!statusIcon;
            
            this.lastSyncTime = Date.now();
        }

        /**
         * 获取门票数量
         */
        getTicketCount() {
            return { ...this.ticketCount };
        }

        /**
         * 检查是否可以进入迷宫
         */
        canEnterLabyrinth() {
            return this.ticketCount.current > 0;
        }
        
        /**
         * 检查行动是否进行中
         */
        isActionInProgress() {
            if (this.actionEndTime > 0) {
                return Date.now() < this.actionEndTime;
            }
            return this.isActionRunning;
        }
    }

    // ==================== 迷宫操作管理器 ====================
    class LabyrinthActionManager {
        constructor(wsManager, gameData) {
            this.wsManager = wsManager;
            this.gameData = gameData;
        }

        /**
         * 开始迷宫（发送 start_labyrinth 包）
         */
        async startLabyrinth() {
            console.log('[迷宫自动化] 🚀 开始进入迷宫...');
            
            try {
                // 1. 发送 start_labyrinth 请求
                await this.wsManager.send('start_labyrinth', {
                    startLabyrinthData: {}
                });
                
                console.log('[迷宫自动化] ✅ 已发送 start_labyrinth 请求');
                
                // 2. 等待短暂延迟后发送 new_character_action
                await this.sleep(2000);
                
                // 3. 发送探索行动请求
                await this.wsManager.send('new_character_action', {
                    newCharacterActionData: {
                        actionHrid: '/actions/labyrinth/explore',
                        difficultyTier: 0,
                        hasMaxCount: false,
                        maxCount: 0,
                        primaryItemHash: '',
                        secondaryItemHash: '',
                        enhancingMaxLevel: 0,
                        enhancingProtectionMinLevel: 0,
                        characterLoadoutId: 0,
                        isStartNow: true
                    }
                });
                
                console.log('[迷宫自动化] ✅ 迷宫已开始运行');
                return true;
            } catch (e) {
                console.error('[迷宫自动化] ❌ 开始迷宫失败:', e.message);
                throw e;
            }
        }

        /**
         * 结束迷宫（发送 escape_labyrinth 包）
         */
        async endLabyrinth() {
            console.log('[迷宫自动化] ⏹️ 结束迷宫...');
            
            try {
                // 发送逃出迷宫请求
                await this.wsManager.send('escape_labyrinth', {});
                
                console.log('[迷宫自动化] ✅ 已发送 escape_labyrinth 请求');
                
                // 等待服务器响应和状态更新
                await this.waitForLabyrinthEnd();
                
                return true;
            } catch (e) {
                console.error('[迷宫自动化] ❌ 结束迷宫失败:', e.message);
                throw e;
            }
        }

        /**
         * 补充入场券（发送 force_refill_labyrinth_entries 包）
         */
        async replenishTickets() {
            console.log('[迷宫自动化] 🎫 补充入场券...');
            
            try {
                // 发送强制补充请求
                await this.wsManager.send('force_refill_labyrinth_entries', {});
                
                console.log('[迷宫自动化] ✅ 已发送 force_refill_labyrinth_entries 请求');
                
                // 等待数据更新
                await this.sleep(3000);
                
                // 检查是否成功
                const tickets = this.gameData.getTicketCount();
                if (tickets.current > 0) {
                    console.log(`[迷宫自动化] ✅ 补充成功，当前门票：${tickets.current}/${tickets.max}`);
                    return true;
                } else {
                    console.error('[迷宫自动化] ❌ 补充失败，门票数量未增加');
                    return false;
                }
            } catch (e) {
                console.error('[迷宫自动化] ❌ 补充入场券失败:', e.message);
                return false;
            }
        }

        /**
         * 等待迷宫结束
         */
        waitForLabyrinthEnd() {
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                const timeout = CONFIG.endLabyrinthWait;
                
                const checkInterval = setInterval(() => {
                    if (!this.gameData.isInLabyrinth) {
                        clearInterval(checkInterval);
                        console.log('[迷宫自动化] ✅ 已成功返回主界面');
                        resolve();
                    } else if (Date.now() - startTime > timeout) {
                        clearInterval(checkInterval);
                        reject(new Error('等待迷宫结束超时'));
                    }
                }, 500);
            });
        }

        /**
         * 通用睡眠函数
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    }

    // ==================== 全局实例 ====================
    let wsManager = null;
    let gameDataManager = null;

    // ==================== 选择器常量（同时使用 class 和文字内容）====================
    const SELECTORS = {
        // 进入迷宫按钮 - 通过 class 和文字内容定位
        enterLabyrinthContainer: '.LabyrinthPanel_buttonsContainer__2oY1b',
        enterLabyrinthText: '进入迷宫',
        
        // 入场券数量显示
        ticketCount: '.LabyrinthPanel_chargeCount__1GDLP',
        
        // 设置导航 - aria-label 包含 labyrinth.settings
        settingsNav: '[aria-label="navigationBar.settings"], .NavigationBar_label__1uH-y',
        
        // 补充入场券相关
        replenishTicketBtn: '.SettingsPanel_value__2nsKD button.Button_button__1Fe9z:not(.Button_disabled__wCyIq)',
        replenishTicketDisabled: '.SettingsPanel_value__2nsKD button.Button_disabled__wCyIq',
        replenishTicketText: '补充入场券',
        
        // 立即开始按钮
        startLabyrinthText: '立即开始',
        
        // 状态栏相关
        statusBar: '.Header_currentAction__3IaOm',
        labyrinthStatusIcon: '[aria-label="Icon"] use[href*="#labyrinth"]',
        labyrinthStatusText: '迷宫',
        
        // 结束迷宫按钮
        endLabyrinthEnabled: 'button.Button_warning__1-AMI:not(.Button_disabled__wCyIq)',
        endLabyrinthDisabled: 'button.Button_warning__1-AMI.Button_disabled__wCyIq',
        endLabyrinthText: '结束迷宫',
        
        // 确认弹窗
        confirmDialog: '.DialogModal_message__2utk_',
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        
        // 迷宫导航（用于返回）
        labyrinthNav: '[aria-label="navigationBar.labyrinth"], .NavigationBar_badge__3I_xZ',
        
        // 迷宫面板容器
        labyrinthPanel: '.LabyrinthPanel_buttonsContainer__2oY1b',
    };

    // ==================== 工具函数 ====================
    
    /**
     * 通过 WebSocket 发送进入迷宫请求
     */
    async function wsEnterLabyrinth() {
        if (!CONFIG.useWebSocket || !wsManager || !wsManager.isConnected) {
            throw new Error('WebSocket 不可用');
        }
        
        log('📡 通过 WebSocket 发送进入迷宫请求...', 'info');
        
        try {
            // 发送进入迷宫请求
            await wsManager.send('start_labyrinth', {});
            log('✅ 已发送进入迷宫请求', 'success');
            
            // 等待响应
            await sleep(1000);
            return true;
        } catch (e) {
            log(`❌ 发送进入迷宫请求失败：${e.message}`, 'error');
            throw e;
        }
    }

    /**
     * 通过 WebSocket 发送结束迷宫请求
     */
    async function wsEndLabyrinth() {
        if (!CONFIG.useWebSocket || !wsManager || !wsManager.isConnected) {
            throw new Error('WebSocket 不可用');
        }
        
        log('📡 通过 WebSocket 发送结束迷宫请求...', 'info');
        
        try {
            // 发送逃出迷宫请求
            await wsManager.send('escape_labyrinth', {});
            log('✅ 已发送结束迷宫请求', 'success');
            
            // 等待响应
            await sleep(1000);
            return true;
        } catch (e) {
            log(`❌ 发送结束迷宫请求失败：${e.message}`, 'error');
            throw e;
        }
    }

    /**
     * 通过 WebSocket 补充入场券
     */
    async function wsReplenishTicket() {
        if (!CONFIG.useWebSocket || !wsManager || !wsManager.isConnected) {
            throw new Error('WebSocket 不可用');
        }
        
        log('📡 通过 WebSocket 发送补充入场券请求...', 'info');
        
        try {
            await wsManager.send('replenish_labyrinth_entry', {});
            log('✅ 已发送补充入场券请求', 'success');
            await sleep(1000);
            return true;
        } catch (e) {
            log(`❌ 发送补充入场券请求失败：${e.message}`, 'error');
            throw e;
        }
    }

    function waitFor(selector, timeout = 15000) {
        return new Promise((resolve, reject) => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);
            const obs = new MutationObserver(() => {
                const e = document.querySelector(selector);
                if (e) {
                    obs.disconnect();
                    clearTimeout(tt);
                    resolve(e);
                }
            });
            obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
            const tt = setTimeout(() => {
                obs.disconnect();
                reject(new Error('timeout waiting for ' + selector));
            }, timeout);
        });
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 日志输出函数
     * @param {string} message - 日志消息
     * @param {string} type - 日志类型 (info/success/warn/error)
     */
    function log(message, type = 'info') {
        const prefix = '[迷宫自动化]';
        const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warn' ? '⚠️' : 'ℹ️';
        const logFunc = type === 'error' ? console.error : type === 'warn' ? console.warn : console.log;
        logFunc(`${prefix} ${icon} ${message}`);
    }

    /**
     * 人为延迟：模拟人类反应时间
     * @param {string|number} min - 最小延迟 (ms) 或预设类型 ('fast'/'type'/'click'/'think')
     * @param {number} max - 最大延迟 (ms)
     */
    function humanDelay(min = 150, max = 700) {
        if (typeof min === 'string') {
            const tone = min;
            switch (tone) {
                case 'fast': return sleep(50 + Math.floor(Math.random() * 80));
                case 'type': return sleep(40 + Math.floor(Math.random() * 140));
                case 'click': return sleep(80 + Math.floor(Math.random() * 220));
                case 'think': return sleep(300 + Math.floor(Math.random() * 700));
                default: return sleep(120 + Math.floor(Math.random() * 500));
            }
        }
        const ms = Math.floor(Math.random() * (max - min + 1)) + min;
        return sleep(ms);
    }

    /**
     * 拟人化点击：模拟鼠标移动轨迹和点击事件
     * @param {Element} el - 要点击的元素
     * @param {Object} options - 选项 {fast: boolean}
     */
    async function humanClick(el, options = {}) {
        if (!el) return false;
        try {
            await humanDelay(options.fast ? 'fast' : 'click');
            
            const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
            
            // 模拟鼠标移动轨迹 (2-4 步)
            const steps = options.fast ? 1 : (2 + Math.floor(Math.random() * 3));
            for (let i = 0; i < steps; i++) {
                const x = Math.floor(rect.left + (rect.width || 10) * Math.random());
                const y = Math.floor(rect.top + (rect.height || 10) * Math.random());
                el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
                await humanDelay(20, 120);
            }
            
            // 计算中心点
            const cx = Math.floor(rect.left + (rect.width || 10) / 2);
            const cy = Math.floor(rect.top + (rect.height || 10) / 2);
            
            // 触发完整鼠标事件序列
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
            await humanDelay(50, 150);
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
            await humanDelay(30, 100);
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
            
            // 尝试聚焦
            try { el.focus && el.focus(); } catch (e) {}
            
            return true;
        } catch (e) {
            console.warn('humanClick failed:', e);
            // 回退到普通点击
            try {
                el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                return true;
            } catch (e2) {
                try { el.click(); return true; } catch (e3) { return false; }
            }
        }
    }

    /**
     * 通过文字内容查找按钮
     */
    function findButtonByText(container, text) {
        if (!container) container = document;
        const buttons = container.querySelectorAll('button');
        for (let btn of buttons) {
            if (btn.textContent.trim() === text && !btn.classList.contains('Button_disabled__wCyIq')) {
                return btn;
            }
        }
        return null;
    }

    /**
     * 检查元素是否可点击（存在且不禁用）
     */
    function isElementClickable(selectorOrFn) {
        let el = null;
        if (typeof selectorOrFn === 'string') {
            el = document.querySelector(selectorOrFn);
        } else if (typeof selectorOrFn === 'function') {
            el = selectorOrFn();
        }
        return el && !el.classList.contains('Button_disabled__wCyIq') && el.offsetParent !== null;
    }

    function getTicketCount() {
        // 如果 WebSocket 管理器有最新数据，优先使用（更实时）
        if (gameDataManager && gameDataManager.ticketCount.current > 0) {
             // 简单校验一下 DOM 是否也显示有票，避免数据不同步导致的误判，但在纯 WS 模式下可能不需要
             // 这里为了保持兼容性，如果 WS 有数据且 DOM 也能对上最好，否则以 WS 为准或降级到 DOM
        }

        const el = document.querySelector(SELECTORS.ticketCount);
        if (!el) return { current: 0, max: 0 };
        
        const text = el.textContent.trim();
        // 兼容多种格式： "入场券： 3 / 5", "Entry Tickets: 3 / 5", "3 / 5" 等
        // 优先匹配带中文的格式
        let match = text.match(/入场券\s*[:：]\s*(\d+)\s*\/\s*(\d+)/);
        
        // 如果没有匹配到中文格式，尝试通用数字格式 (例如 "3 / 5")
        if (!match) {
            match = text.match(/(\d+)\s*\/\s*(\d+)/);
        }

        if (match) {
            const current = parseInt(match[1]);
            const max = parseInt(match[2]) || 5;
            return { current, max };
        }
        
        return { current: 0, max: 0 };
    }

    /**
     * 检查是否在迷宫中（通过状态栏判断）
     */
    function isInLabyrinth() {
        // 策略 1: 检查迷宫图标 - SVG use 标签的 href 包含#labyrinth
        const iconUse = document.querySelector(SELECTORS.labyrinthStatusIcon);
        if (iconUse) {
            const href = iconUse.getAttribute('href') || '';
            if (href.includes('#labyrinth')) {
                return true;
            }
        }
        
        // 策略 2: 检查状态栏文字是否包含"迷宫"
        const statusText = document.querySelector(SELECTORS.labyrinthStatusText);
        if (statusText && statusText.textContent.includes('迷宫')) {
            return true;
        }
        
        return false;
    }

    /**
     * 检查结束迷宫按钮是否可点击
     */
    function isEndLabyrinthClickable() {
        try {
            // 查找所有包含"结束迷宫"文字的按钮
            const buttons = document.querySelectorAll('button');
            for (let btn of buttons) {
                if (btn.textContent.trim() === SELECTORS.endLabyrinthText) {
                    // 检查按钮是否不禁用
                    if (!btn.classList.contains('Button_disabled__wCyIq')) {
                        return true;
                    }
                }
            }
            return false;
        } catch (e) {
            log(`检查结束按钮状态出错：${e.message}`, 'error');
            return false;
        }
    }

    /**
     * 找到包含特定文字的按钮（支持多种匹配方式）
     */
    function findButtonByClassAndText(baseSelector, text) {
        // 先找容器
        const container = document.querySelector(baseSelector);
        if (container) {
            // 在容器内查找按钮
            const btn = findButtonByText(container, text);
            if (btn) return btn;
        }
        
        // 全局查找
        return findButtonByText(document, text);
    }

    /**
     * 导航到迷宫页面
     */
    function navigateToLabyrinth() {
        log('🔍 查找迷宫导航链接...');
        
        // 策略 1: 通过 aria-label 查找
        const labyrinthIcons = document.querySelectorAll('[aria-label="navigationBar.labyrinth"]');
        if (labyrinthIcons.length > 0) {
            log(`找到 ${labyrinthIcons.length} 个迷宫图标`, 'success');
            const parentLink = labyrinthIcons[0].closest('.NavigationBar_navigationLink__3eAHA');
            if (parentLink) {
                const isActive = parentLink.classList.contains('NavigationBar_active__3R-QS');
                log(`迷宫导航链接 - ${isActive ? '已激活' : '未激活'}`);
                
                if (!isActive) {
                    log('点击迷宫导航链接...', 'success');
                    parentLink.click();
                    return true;
                }
                return true; // 已经激活
            }
        }
        
        // 策略 2: 在左侧导航栏中查找"迷宫"文字
        const navLinks = document.querySelectorAll('.NavigationBar_navigationLink__3eAHA');
        for (const link of navLinks) {
            const label = link.querySelector('.NavigationBar_label__1uH-y');
            if (label && label.textContent.trim() === '迷宫') {
                const isActive = link.classList.contains('NavigationBar_active__3R-QS');
                log(`找到导航链接："迷宫" - ${isActive ? '已激活' : '未激活'}`);
                
                if (!isActive) {
                    log('点击导航链接...', 'success');
                    link.click();
                    return true;
                }
                return true;
            }
        }
        
        // 策略 3: 通过徽章查找（有数字标记的迷宫入口）
        const labyrinthBadges = document.querySelectorAll('.NavigationBar_badge__3I_xZ');
        if (labyrinthBadges.length > 0) {
            log('通过徽章找到迷宫入口', 'success');
            const parentLink = labyrinthBadges[0].closest('.NavigationBar_navigationLink__3eAHA');
            if (parentLink) {
                const isActive = parentLink.classList.contains('NavigationBar_active__3R-QS');
                if (!isActive) {
                    parentLink.click();
                    return true;
                }
                return true;
            }
        }
        
        log('未找到迷宫导航链接', 'warn');
        return false;
    }

    /**
     * 检查是否在迷宫面板页面
     */
    function isInLabyrinthPanel() {
        const panel = document.querySelector(SELECTORS.labyrinthPanel);
        return panel !== null;
    }

    /**
     * 确保在迷宫面板页面
     */
    async function ensureInLabyrinthPanel() {
        log('🔍 检查是否在迷宫面板页面...');
        
        // 先检查并关闭离线奖励弹窗（如果有）
        closeOfflineModalIfNeeded();
        await sleep(500);
        
        // 如果已经在迷宫面板，无需操作
        if (isInLabyrinthPanel()) {
            log('✅ 已在迷宫面板页面', 'success');
            return true;
        }
        
        // 不在迷宫面板，尝试导航
        log('⚠️ 未在迷宫面板，尝试导航...', 'warn');
        if (navigateToLabyrinth()) {
            log('已点击迷宫导航，等待页面加载...');
            await sleep(2000);
            
            // 再次检查
            if (isInLabyrinthPanel()) {
                log('✅ 成功导航到迷宫面板', 'success');
                return true;
            } else {
                log('❌ 导航后仍未检测到迷宫面板', 'error');
                return false;
            }
        }
        
        return false;
    }

    // ==================== 核心功能 ====================
    
    /**
     * 补充入场券（支持 WebSocket 和 DOM 两种模式）
     */
    async function replenishTickets() {
        log('检测入场券不足，尝试补充...', 'warn');
        
        // 优先尝试 WebSocket 方式
        if (CONFIG.useWebSocket && wsManager && wsManager.isConnected) {
            try {
                log('使用 WebSocket 方式补充入场券...', 'info');
                const success = await wsReplenishTicket();
                if (success) {
                    await sleep(2000);
                    const tickets = gameDataManager ? gameDataManager.getTicketCount() : getTicketCount();
                    if (tickets.current >= 1) {
                        log('入场券补充成功!', 'success');
                        return true;
                    }
                }
            } catch (e) {
                log(`WebSocket 补充失败，回退到 DOM 方式：${e.message}`, 'warn');
            }
        }
        
        // DOM 方式（原有逻辑）
        log('使用 DOM 方式补充入场券...', 'info');
        
        // 点击设置导航
        const settingsBtn = document.querySelector(SELECTORS.settingsNav);
        if (settingsBtn) {
            await humanClick(settingsBtn);
            await humanDelay(500, 1000);
        }

        // 等待并点击补充入场券
        let attemptCount = 0;
        
        while (attemptCount < CONFIG.maxReplenishAttempts) {
            attemptCount++;
            log(`第 ${attemptCount} 次尝试补充入场券...`);
            
            // 通过文字查找按钮
            const replenishBtn = findButtonByText(document, SELECTORS.replenishTicketText);
            if (replenishBtn && !replenishBtn.classList.contains('Button_disabled__wCyIq')) {
                await humanClick(replenishBtn);
                log('已点击补充入场券', 'success');
                
                // 等待更长时间确认结果 (至少 5 秒)
                log('等待入场券补充结果...');
                await sleep(5000);
                
                // 重新检查入场券数量
                const tickets = gameDataManager ? gameDataManager.getTicketCount() : getTicketCount();
                log(`当前入场券数量：${tickets.current}/${tickets.max}`);
                
                // 如果入场券增加了，说明成功
                if (tickets.current >= 1) {
                    log('入场券补充成功!', 'success');
                    return true;
                }
                
                // 否则继续尝试
                log('入场券数量未增加，继续尝试...', 'warn');
            } else {
                // 检查是否处于冷却状态
                const disabledBtn = document.querySelector(SELECTORS.replenishTicketDisabled);
                if (disabledBtn) {
                    const parentText = disabledBtn.parentElement?.textContent || '';
                    log(`入场券补充冷却中：${parentText}`, 'error');
                    
                    // 解析冷却时间并等待
                    const cooldownMatch = parentText.match(/(\d+)h\s*(\d+)m\s*(\d+)s/);
                    if (cooldownMatch) {
                        const hours = parseInt(cooldownMatch[1]);
                        const minutes = parseInt(cooldownMatch[2]);
                        const seconds = parseInt(cooldownMatch[3]);
                        const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
                        
                        log(`需要等待 ${hours}小时${minutes}分钟${seconds}秒`, 'warn');
                        
                        // 分段等待，每 30 秒检查一次是否可点击
                        const checkInterval = 30000;
                        let remaining = totalMs;
                        
                        while (remaining > 0) {
                            const waitTime = Math.min(checkInterval, remaining);
                            log(`等待 ${Math.floor(waitTime / 1000)} 秒后检查冷却状态...`);
                            await sleep(waitTime);
                            remaining -= waitTime;
                            
                            // 检查按钮是否变为可点击
                            const newBtn = findButtonByText(document, SELECTORS.replenishTicketText);
                            if (newBtn && !newBtn.classList.contains('Button_disabled__wCyIq')) {
                                log('冷却结束！按钮已可用', 'success');
                                break;
                            }
                        }
                        
                        // 冷却结束后重试
                        continue;
                    } else {
                        log('无法解析冷却时间，放弃等待', 'error');
                        return false;
                    }
                }
                
                log('未找到可点击的补充入场券按钮', 'warn');
            }
            
            await sleep(CONFIG.ticketCheckInterval);
        }
        
        log(`尝试${CONFIG.maxReplenishAttempts}次后仍未成功补充入场券`, 'error');
        return false;
    }

    /**
     * 处理确认弹窗（可能出现两个）
     */
    async function handleConfirmDialogs() {
        log('开始处理确认弹窗...');
        
        for (let i = 0; i < 2; i++) {
            await sleep(CONFIG.confirmDialogWait);
            
            // 策略 1：查找包含特定消息的弹窗容器
            let dialogContainer = null;
            let confirmBtn = null;
            
            // 第一个弹窗："确定要逃出迷宫吗？"
            if (i === 0) {
                const dialogs = document.querySelectorAll('[role="dialog"]');
                for (const dialog of dialogs) {
                    const messageEl = dialog.querySelector('.DialogModal_message__2utk_');
                    if (messageEl && messageEl.textContent.includes('确定要逃出迷宫')) {
                        dialogContainer = dialog;
                        log(`检测到第 ${i + 1} 个弹窗：逃出迷宫确认`, 'success');
                        break;
                    }
                }
            } 
            // 第二个弹窗："你真的确定吗？"
            else if (i === 1) {
                const dialogs = document.querySelectorAll('[role="dialog"]');
                for (const dialog of dialogs) {
                    const messageEl = dialog.querySelector('.DialogModal_message__2utk_');
                    if (messageEl && messageEl.textContent.includes('你真的确定吗')) {
                        dialogContainer = dialog;
                        log(`检测到第 ${i + 1} 个弹窗：最终确认`, 'success');
                        break;
                    }
                }
            }
            
            // 如果找到了弹窗容器，在其中查找"确定"按钮
            if (dialogContainer) {
                // 在弹窗按钮容器中查找"确定"按钮（绿色成功按钮）
                const buttons = dialogContainer.querySelectorAll('button');
                for (const btn of buttons) {
                    if (btn.textContent.trim() === SELECTORS.confirmButtonText && 
                        btn.classList.contains('Button_success__6d6kU')) {
                        confirmBtn = btn;
                        break;
                    }
                }
                
                if (confirmBtn && confirmBtn.offsetParent !== null) {
                    await humanClick(confirmBtn);
                    log(`✅ 已点击第 ${i + 1} 个弹窗的"确定"按钮`, 'success');
                    await humanDelay(500, 800);
                    continue;
                } else {
                    log(`⚠️ 未找到第 ${i + 1} 个弹窗的"确定"按钮`, 'warn');
                }
            }
            
            // 策略 2：如果没找到特定弹窗，尝试通用方法
            log(`⚠️ 使用通用方法查找第 ${i + 1} 个确认弹窗...`);
            const dialog = document.querySelector(SELECTORS.confirmDialog);
            if (!dialog) {
                log(`未找到第 ${i + 1} 个确认弹窗，跳过`, 'warn');
                continue;
            }
            
            // 获取弹窗消息内容用于日志
            const message = dialog.textContent.trim();
            log(`检测到确认弹窗 ${i + 1}: ${message.substring(0, 50)}...`);
            
            // 在弹窗容器内查找"确定"按钮
            const confirmBtnFallback = findButtonByText(dialog.parentElement, SELECTORS.confirmButtonText);
            if (confirmBtnFallback && confirmBtnFallback.offsetParent !== null) {
                await humanClick(confirmBtnFallback);
                log(`已确认弹窗 ${i + 1}`, 'success');
                await humanDelay(500, 800);
            } else {
                log(`未找到第 ${i + 1} 个弹窗的确认按钮`, 'warn');
            }
        }
        
        log('确认弹窗处理完成', 'success');
    }

    /**
     * 进入迷宫（完整流程，支持 WebSocket 和 DOM 两种模式）
     */
    async function enterLabyrinth() {
        log('🔮 尝试进入迷宫...', 'info');
        
        // 优先尝试 WebSocket 方式
        if (CONFIG.useWebSocket && wsManager && wsManager.isConnected) {
            try {
                log('使用 WebSocket 方式进入迷宫...', 'info');
                
                // 检查入场券
                const tickets = gameDataManager ? gameDataManager.getTicketCount() : getTicketCount();
                log(`当前入场券数量：${tickets.current}/${tickets.max}`, 'info');
                
                if (tickets.current === 0) {
                    log('⚠️ 入场券数量为 0，先补充入场券', 'warn');
                    const success = await replenishTickets();
                    if (!success) {
                        throw new Error('入场券补充失败');
                    }
                    await sleep(1000);
                }
                
                // 发送 WebSocket 请求
                await wsEnterLabyrinth();
                await sleep(2000);
                
                // 验证是否成功
                const inLabyrinth = gameDataManager ? gameDataManager.isInLabyrinth : isInLabyrinth();
                if (inLabyrinth) {
                    log('✅ 通过 WebSocket 成功进入迷宫', 'success');
                    return;
                }
                
                log('⚠️ WebSocket 进入后未检测到状态变化，回退到 DOM 方式', 'warn');
            } catch (e) {
                log(`WebSocket 进入失败，回退到 DOM 方式：${e.message}`, 'warn');
            }
        }
        
        // DOM 方式（原有逻辑）
        log('使用 DOM 方式进入迷宫...', 'info');
        
        // 确保在迷宫面板页面
        await ensureInLabyrinthPanel();
        
        // 检查入场券数量
        const tickets = gameDataManager ? gameDataManager.getTicketCount() : getTicketCount();
        log(`当前入场券数量：${tickets.current}/${tickets.max}`, 'info');
        
        // 入场券为 0 时必须补充
        if (tickets.current === 0) {
            log('⚠️ 入场券数量为 0，必须补充才能进入迷宫', 'warn');
            const success = await replenishTickets();
            if (!success) {
                throw new Error('入场券补充失败，无法进入迷宫');
            }
            
            // 补充成功后返回迷宫页面
            log('✅ 入场券补充成功，返回迷宫页面...', 'success');
            await ensureInLabyrinthPanel();
            await sleep(1000);
        } 
        else if (tickets.current < 1) {
            log(`⚠️ 入场券不足 (${tickets.current}/${tickets.max})，需要补充`, 'warn');
            const success = await replenishTickets();
            if (!success) {
                throw new Error('入场券补充失败，无法进入迷宫');
            }
            
            log('✅ 入场券补充成功，返回迷宫页面...', 'success');
            await ensureInLabyrinthPanel();
            await sleep(1000);
        }

        // 通过 class 容器 + 文字内容找到按钮
        const enterBtn = findButtonByClassAndText(SELECTORS.enterLabyrinthContainer, SELECTORS.enterLabyrinthText);
        if (enterBtn) {
            await humanClick(enterBtn);
            log('已点击"进入迷宫"按钮', 'success');
            await humanDelay(1000, 2000);
            
            // 检查是否已在迷宫中
            const inLabyrinth = gameDataManager ? gameDataManager.isInLabyrinth : isInLabyrinth();
            if (inLabyrinth) {
                log('✅ 已成功进入迷宫', 'success');
                return;
            }
            
            // 尝试查找并点击"立即开始"按钮
            log('未检测到迷宫状态，尝试查找"立即开始"按钮...', 'warn');
            const startBtn = findButtonByText(document, SELECTORS.startLabyrinthText);
            if (startBtn) {
                await humanClick(startBtn);
                log('已点击"立即开始"按钮', 'success');
                await humanDelay(1000, 2000);
                
                if (gameDataManager ? gameDataManager.isInLabyrinth : isInLabyrinth()) {
                    log('✅ 成功进入迷宫', 'success');
                    return;
                } else {
                    log('⚠️ 点击"立即开始"后仍未检测到迷宫状态', 'warn');
                }
            } else {
                log('未找到"立即开始"按钮', 'error');
            }
            
            // 最终检查
            if (!(gameDataManager ? gameDataManager.isInLabyrinth : isInLabyrinth())) {
                log('❌ 进入迷宫流程完成但未检测到迷宫状态', 'error');
            }
        } else {
            throw new Error('未找到"进入迷宫"按钮');
        }
    }

    /**
     * 开始迷宫
     */
    async function startLabyrinth() {
        log('尝试开始迷宫...');
        
        // 通过文字查找"立即开始"按钮
        const startBtn = findButtonByText(document, SELECTORS.startLabyrinthText);
        if (startBtn) {
            await humanClick(startBtn);
            log('已开始迷宫', 'success');
            await humanDelay(1000, 2000);
        } else {
            throw new Error('未找到"立即开始"按钮');
        }
    }

    /**
     * 结束迷宫（支持 WebSocket 和 DOM 两种模式）
     */
    async function endLabyrinth() {
        log('尝试结束迷宫...', 'info');
        
        // 优先尝试 WebSocket 方式
        if (CONFIG.useWebSocket && wsManager && wsManager.isConnected) {
            try {
                log('使用 WebSocket 方式结束迷宫...', 'info');
                await wsEndLabyrinth();
                await sleep(2000);
                
                // 验证是否成功
                const inLabyrinth = gameDataManager ? gameDataManager.isInLabyrinth : isInLabyrinth();
                if (!inLabyrinth) {
                    log('✅ 通过 WebSocket 成功结束迷宫', 'success');
                    return true;
                }
                
                log('⚠️ WebSocket 结束后未检测到状态变化，回退到 DOM 方式', 'warn');
            } catch (e) {
                log(`WebSocket 结束失败，回退到 DOM 方式：${e.message}`, 'warn');
            }
        }
        
        // DOM 方式（原有逻辑）
        log('使用 DOM 方式结束迷宫...', 'info');
        
        // 通过文字查找"结束迷宫"按钮（确保可点击）
        const endBtn = findButtonByText(document, SELECTORS.endLabyrinthText);
        if (endBtn && !endBtn.classList.contains('Button_disabled__wCyIq')) {
            await humanClick(endBtn);
            await humanDelay(500, 1000);
            
            // 处理确认弹窗（可能有两个）
            await handleConfirmDialogs();
            
            log('已结束迷宫，等待返回主界面...', 'info');
            
            // 等待迷宫状态消失
            const startTime = Date.now();
            while (Date.now() - startTime < CONFIG.endLabyrinthWait) {
                await sleep(500);
                
                const inLabyrinth = gameDataManager ? gameDataManager.isInLabyrinth : isInLabyrinth();
                if (!inLabyrinth) {
                    log('已成功返回主界面', 'success');
                    await sleep(1000);
                    return true;
                }
            }
            
            log('等待返回主界面超时', 'warn');
            return false;
        }
        
        log('未找到可点击的"结束迷宫"按钮', 'warn');
        return false;
    }

    // ==================== 主循环 ====================
    class LabyrinthAutomation {
        constructor() {
            this.wsManager = new WebSocketManager();
            this.gameData = new GameDataManager(this.wsManager);
            this.actionManager = new LabyrinthActionManager(this.wsManager, this.gameData);
            
            this.autoRunning = false;
            this.stopRequested = false;
            this.enableAuto = CONFIG.enableAuto;
        }

        /**
         * 启动自动化
         */
        async start() {
            if (this.autoRunning) {
                console.warn('[迷宫自动化] ⚠️ 自动化已在运行中');
                return;
            }
            
            console.log('[迷宫自动化] 🚀 ========== 迷宫自动化启动 ==========');
            this.autoRunning = true;
            this.stopRequested = false;
            
            // 不等待WebSocket连接，直接开始主循环
            // 如果WebSocket可用则使用，否则降级使用DOM操作
            console.log('[迷宫自动化] 🔄 直接开始主循环...');
            
            // 启动主循环
            this.mainLoop();
        }

        /**
         * 停止自动化
         */
        stop() {
            console.log('[迷宫自动化] ⏹️ 停止自动化...');
            this.stopRequested = true;
            this.enableAuto = false;
        }

        /**
         * 主循环
         */
        async mainLoop() {
            console.log('[迷宫自动化] 🔄 主循环启动');
            
            while (this.enableAuto && !this.stopRequested) {
                try {
                    // 同步游戏状态
                    this.gameData.syncFromDom();
                    
                    const tickets = this.gameData.getTicketCount();
                    const isInLabyrinth = this.gameData.isInLabyrinth;
                    
                    console.log(`[迷宫自动化] 📊 当前状态：${isInLabyrinth ? '🔮 迷宫中' : '⏸️ 未进入'} | 门票：${tickets.current}/${tickets.max}`);
                    
                    // 如果不在迷宫中，尝试进入
                    if (!isInLabyrinth) {
                        console.log('[迷宫自动化] 🔍 检测到未进入迷宫，开始进入流程...');
                        
                        // 检查门票 - 在主页面检测门票数量
                        if (!this.gameData.canEnterLabyrinth()) {
                            console.log(`[迷宫自动化] ⚠️ 门票不足 (${tickets.current}/${tickets.max})，需要补充`);
                            
                            // 门票为 0 时必须补充
                            if (tickets.current === 0) {
                                console.log('[迷宫自动化] ⚠️ 门票数量为 0，必须补充才能进入迷宫');
                                
                                // 优先尝试WebSocket，如果不可用则使用DOM界面操作
                                let success = false;
                                if (CONFIG.useWebSocket && this.wsManager && this.wsManager.isConnected) {
                                    console.log('[迷宫自动化] 🌐 尝试使用WebSocket补充门票...');
                                    success = await this.actionManager.replenishTickets();
                                }
                                
                                if (!success) {
                                    console.log('[迷宫自动化] 🖥️ WebSocket不可用，尝试使用界面操作补充门票...');
                                    success = await this.attemptReplenishTicketsViaUI();
                                }
                                
                                if (!success) {
                                    console.error('[迷宫自动化] ❌ 门票补充失败，等待下次尝试');
                                    await this.sleep(CONFIG.ticketCheckInterval);
                                    continue;
                                }
                                
                                console.log('[迷宫自动化] ✅ 门票补充成功');
                            } else {
                                // 门票不足但非 0，也尝试补充
                                let success = false;
                                if (CONFIG.useWebSocket && this.wsManager && this.wsManager.isConnected) {
                                    console.log('[迷宫自动化] 🌐 尝试使用WebSocket补充门票...');
                                    success = await this.actionManager.replenishTickets();
                                }
                                
                                if (!success) {
                                    console.log('[迷宫自动化] 🖥️ WebSocket不可用，尝试使用界面操作补充门票...');
                                    success = await this.attemptReplenishTicketsViaUI();
                                }
                                
                                if (!success) {
                                    console.error('[迷宫自动化] ❌ 门票补充失败');
                                    await this.sleep(CONFIG.ticketCheckInterval);
                                    continue;
                                }
                            }
                            
                            // 重新获取门票数量
                            this.gameData.syncFromDom();
                        }
                        
                        // 优先尝试WebSocket，如果不可用则使用DOM界面操作开始迷宫
                        let success = false;
                        if (CONFIG.useWebSocket && this.wsManager && this.wsManager.isConnected) {
                            console.log('[迷宫自动化] 🌐 尝试使用WebSocket开始迷宫...');
                            success = await this.actionManager.startLabyrinth();
                        }
                        
                        if (!success) {
                            console.log('[迷宫自动化] 🖥️ WebSocket不可用，尝试使用界面操作开始迷宫...');
                            success = await this.attemptStartLabyrinthViaUI();
                        }
                        
                        if (success) {
                            console.log('[迷宫自动化] ✅ 成功开始迷宫');
                        }
                        
                        await this.sleep(5000); // 等待行动开始
                        
                        continue;
                    }
                    
                    // 在迷宫中，等待指定时间或检测结束条件
                    console.log(`[迷宫自动化] ⏱️ 迷宫运行中，${CONFIG.checkInterval / 1000 / 60}分钟后检测状态`);
                    
                    const remaining = CONFIG.checkInterval;
                    const step = 5000;
                    let labyrinthEnded = false;
                    
                    for (let i = 0; i < remaining / step && !this.stopRequested && this.enableAuto; i++) {
                        await this.sleep(Math.min(step, remaining - i * step));
                        
                        // 每 5 秒检查一次状态
                        this.gameData.syncFromDom();
                        
                        if (!this.gameData.isInLabyrinth) {
                            console.log('[迷宫自动化] 🔍 检测到迷宫已结束（状态栏无迷宫标识），准备重新开始...');
                            labyrinthEnded = true;
                            break;
                        }
                    }
                    
                    if (this.stopRequested || !this.enableAuto) break;
                    
                    // 如果检测到迷宫结束，确保完全返回主页面
                    if (labyrinthEnded) {
                        console.log('[迷宫自动化] 🎯 迷宫已结束，准备重新开始下一轮...');
                        await this.ensureReturnToMainPage();
                        await this.sleep(2000);
                        continue;
                    }
                    
                    await this.sleep(2000);
                    
                } catch (err) {
                    console.error(`[迷宫自动化] ❌ 错误：${err.message}`);
                    console.error(err.stack);
                    await this.sleep(10000); // 出错后等待 10 秒
                }
            }
            
            this.autoRunning = false;
            console.log('[迷宫自动化] ⏹️ 主循环停止');
        }
        
        /**
         * 确保完全返回到主页面
         */
        async ensureReturnToMainPage() {
            console.log('[迷宫自动化] 🔄 确保完全返回到主页面...');
            
            // 等待一段时间让页面状态稳定
            await this.sleep(3000);
            
            // 确保已经不在迷宫中
            let attempts = 0;
            const maxAttempts = 10;
            
            while (attempts < maxAttempts) {
                this.gameData.syncFromDom();
                
                if (!this.gameData.isInLabyrinth) {
                    console.log('[迷宫自动化] ✅ 已确认不在迷宫中');
                    break;
                }
                
                console.log(`[迷宫自动化] ⏳ 仍在迷宫中，等待退出... (${attempts + 1}/${maxAttempts})`);
                await this.sleep(2000);
                attempts++;
            }
            
            // 确保在迷宫面板页面
            await ensureInLabyrinthPanel();
            
            // 检查是否存在"立即开始"按钮，如果存在则点击它以确保状态正确
            const startBtn = findButtonByText(document, SELECTORS.startLabyrinthText);
            if (startBtn) {
                console.log('[迷宫自动化] 🔄 点击"立即开始"按钮以确保状态正确');
                await humanClick(startBtn);
                await this.sleep(1000);
                
                // 点击后再次检查是否在迷宫中
                this.gameData.syncFromDom();
                if (this.gameData.isInLabyrinth) {
                    console.log('[迷宫自动化] ⚠️ 点击后仍在迷宫中，等待退出...');
                    let exitAttempts = 0;
                    while (exitAttempts < 5 && this.gameData.isInLabyrinth) {
                        await this.sleep(2000);
                        this.gameData.syncFromDom();
                        exitAttempts++;
                    }
                }
            }
            
            console.log('[迷宫自动化] ✅ 已确认返回主页面');
        }

        /**
         * 尝试通过界面操作补充门票
         */
        async attemptReplenishTicketsViaUI() {
            try {
                console.log('[迷宫自动化] 🖥️ 尝试使用界面操作补充门票...');
                
                // 确保在迷宫面板
                await ensureInLabyrinthPanel();
                
                // 点击设置导航
                const settingsBtn = document.querySelector(SELECTORS.settingsNav);
                if (settingsBtn) {
                    await humanClick(settingsBtn);
                    await humanDelay(500, 1000);
                }

                // 等待并点击补充入场券
                let attemptCount = 0;
                
                while (attemptCount < CONFIG.maxReplenishAttempts) {
                    attemptCount++;
                    console.log(`[迷宫自动化] 第 ${attemptCount} 次尝试补充入场券...`);
                    
                    // 通过文字查找按钮
                    const replenishBtn = findButtonByText(document, SELECTORS.replenishTicketText);
                    if (replenishBtn && !replenishBtn.classList.contains('Button_disabled__wCyIq')) {
                        await humanClick(replenishBtn);
                        console.log('[迷宫自动化] 已点击补充入场券', 'success');
                        
                        // 等待更长时间确认结果 (至少 5 秒)
                        console.log('[迷宫自动化] 等待入场券补充结果...');
                        await sleep(5000);
                        
                        // 重新检查入场券数量
                        const tickets = this.gameData.getTicketCount();
                        console.log(`[迷宫自动化] 当前入场券数量：${tickets.current}/${tickets.max}`);
                        
                        // 如果入场券增加了，说明成功
                        if (tickets.current >= 1) {
                            console.log('[迷宫自动化] 入场券补充成功!');
                            return true;
                        }
                        
                        // 否则继续尝试
                        console.log('[迷宫自动化] 入场券数量未增加，继续尝试...');
                    } else {
                        // 检查是否处于冷却状态
                        const disabledBtn = document.querySelector(SELECTORS.replenishTicketDisabled);
                        if (disabledBtn) {
                            const parentText = disabledBtn.parentElement?.textContent || '';
                            console.log(`[迷宫自动化] 入场券补充冷却中：${parentText}`);
                            
                            // 解析冷却时间并等待
                            const cooldownMatch = parentText.match(/(\d+)h\s*(\d+)m\s*(\d+)s/);
                            if (cooldownMatch) {
                                const hours = parseInt(cooldownMatch[1]);
                                const minutes = parseInt(cooldownMatch[2]);
                                const seconds = parseInt(cooldownMatch[3]);
                                const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
                                
                                console.log(`[迷宫自动化] 需要等待 ${hours}小时${minutes}分钟${seconds}秒`);
                                
                                // 分段等待，每 30 秒检查一次是否可点击
                                const checkInterval = 30000;
                                let remaining = totalMs;
                                
                                while (remaining > 0) {
                                    const waitTime = Math.min(checkInterval, remaining);
                                    console.log(`[迷宫自动化] 等待 ${Math.floor(waitTime / 1000)} 秒后检查冷却状态...`);
                                    await sleep(waitTime);
                                    remaining -= waitTime;
                                    
                                    // 检查按钮是否变为可点击
                                    const newBtn = findButtonByText(document, SELECTORS.replenishTicketText);
                                    if (newBtn && !newBtn.classList.contains('Button_disabled__wCyIq')) {
                                        console.log('[迷宫自动化] 冷却结束！按钮已可用');
                                        break;
                                    }
                                }
                                
                                // 冷却结束后重试
                                continue;
                            } else {
                                console.log('[迷宫自动化] 无法解析冷却时间，放弃等待');
                                return false;
                            }
                        }
                        
                        console.log('[迷宫自动化] 未找到可点击的补充入场券按钮');
                    }
                    
                    await sleep(CONFIG.ticketCheckInterval);
                }
                
                console.log(`[迷宫自动化] 尝试${CONFIG.maxReplenishAttempts}次后仍未成功补充入场券`);
                return false;
            } catch (error) {
                console.error(`[迷宫自动化] 补充门票时发生错误: ${error.message}`);
                return false;
            }
        }

        /**
         * 尝试通过界面操作开始迷宫
         */
        async attemptStartLabyrinthViaUI() {
            try {
                console.log('[迷宫自动化] 🖥️ 尝试使用界面操作开始迷宫...');
                
                // 确保在迷宫面板页面
                await ensureInLabyrinthPanel();
                
                // 通过 class 容器 + 文字内容找到按钮
                const enterBtn = findButtonByClassAndText(SELECTORS.enterLabyrinthContainer, SELECTORS.enterLabyrinthText);
                if (enterBtn) {
                    await humanClick(enterBtn);
                    console.log('[迷宫自动化] 已点击"进入迷宫"按钮');
                    await humanDelay(1000, 2000);
                    
                    // 检查是否已在迷宫中
                    const inLabyrinth = this.gameData.isInLabyrinth;
                    if (inLabyrinth) {
                        console.log('[迷宫自动化] ✅ 已成功进入迷宫');
                        return true;
                    }
                    
                    // 尝试查找并点击"立即开始"按钮
                    console.log('[迷宫自动化] 未检测到迷宫状态，尝试查找"立即开始"按钮...');
                    const startBtn = findButtonByText(document, SELECTORS.startLabyrinthText);
                    if (startBtn) {
                        await humanClick(startBtn);
                        console.log('[迷宫自动化] 已点击"立即开始"按钮');
                        await humanDelay(1000, 2000);
                        
                        if (this.gameData.isInLabyrinth) {
                            console.log('[迷宫自动化] ✅ 成功进入迷宫');
                            return true;
                        } else {
                            console.log('[迷宫自动化] ⚠️ 点击"立即开始"后仍未检测到迷宫状态');
                        }
                    } else {
                        console.log('[迷宫自动化] 未找到"立即开始"按钮');
                    }
                    
                    // 最终检查
                    if (!this.gameData.isInLabyrinth) {
                        console.log('[迷宫自动化] ❌ 进入迷宫流程完成但未检测到迷宫状态');
                    }
                } else {
                    throw new Error('未找到"进入迷宫"按钮');
                }
            } catch (error) {
                console.error(`[迷宫自动化] 开始迷宫时发生错误: ${error.message}`);
                return false;
            }
        }

        /**
         * 尝试通过界面操作结束迷宫
         */
        async attemptEndLabyrinthViaUI() {
            try {
                console.log('[迷宫自动化] 🖥️ 尝试使用界面操作结束迷宫...');
                
                // 通过文字查找"结束迷宫"按钮（确保可点击）
                const endBtn = findButtonByText(document, SELECTORS.endLabyrinthText);
                if (endBtn && !endBtn.classList.contains('Button_disabled__wCyIq')) {
                    await humanClick(endBtn);
                    await humanDelay(500, 1000);
                    
                    // 处理确认弹窗（可能有两个）
                    await handleConfirmDialogs();
                    
                    console.log('[迷宫自动化] 已结束迷宫，等待返回主界面...');
                    
                    // 等待迷宫状态消失
                    const startTime = Date.now();
                    while (Date.now() - startTime < CONFIG.endLabyrinthWait) {
                        await sleep(500);
                        
                        const inLabyrinth = this.gameData.isInLabyrinth;
                        if (!inLabyrinth) {
                            console.log('[迷宫自动化] 已成功返回主界面');
                            await sleep(1000);
                            return true;
                        }
                    }
                    
                    console.log('[迷宫自动化] 等待返回主界面超时');
                    return false;
                }
                
                console.log('[迷宫自动化] 未找到可点击的"结束迷宫"按钮');
                return false;
            } catch (error) {
                console.error(`[迷宫自动化] 结束迷宫时发生错误: ${error.message}`);
                return false;
            }
        }

        /**
         * 通用睡眠函数
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    }

    // ==================== 设置面板 ====================
    function createSettingsPanel() {
        if (document.getElementById('labyrinthSettingsPanel')) return;

        const panel = document.createElement('div');
        panel.id = 'labyrinthSettingsPanel';
        panel.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            z-index: 2147483647;
            background: rgba(30, 30, 30, 0.95);
            border: 1px solid #555;
            border-radius: 8px;
            padding: 15px;
            color: #fff;
            font-size: 13px;
            min-width: 220px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;

        const title = document.createElement('div');
        title.textContent = '🌀 迷宫自动化设置';
        title.style.cssText = 'font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #555; padding-bottom: 8px; cursor: move;';
        panel.appendChild(title);

        // 启用/禁用开关
        const toggleRow = document.createElement('div');
        toggleRow.style.cssText = 'margin: 8px 0; display: flex; align-items: center; gap: 8px;';
        const toggleLabel = document.createElement('span');
        toggleLabel.textContent = '启用自动化:';
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = CONFIG.enableAuto ? 'ON' : 'OFF';
        toggleBtn.style.cssText = `
            padding: 4px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            background: ${CONFIG.enableAuto ? '#4CAF50' : '#f44336'};
            color: #fff;
            font-weight: bold;
        `;
        toggleBtn.onclick = () => {
            CONFIG.enableAuto = !CONFIG.enableAuto;
            GM_setValue('labyrinth_ws_enableAuto', CONFIG.enableAuto);
            toggleBtn.textContent = CONFIG.enableAuto ? 'ON' : 'OFF';
            toggleBtn.style.background = CONFIG.enableAuto ? '#4CAF50' : '#f44336';
            log(`自动化已${CONFIG.enableAuto ? '启用' : '禁用'}`, CONFIG.enableAuto ? 'success' : 'warn');
            
            if (!CONFIG.enableAuto) {
                if (automation) {
                    automation.stop();
                }
            } else if (automation && !automation.autoRunning) {
                automation.start();
            }
        };
        toggleRow.appendChild(toggleLabel);
        toggleRow.appendChild(toggleBtn);
        panel.appendChild(toggleRow);

        // WebSocket 模式开关
        const wsToggleRow = document.createElement('div');
        wsToggleRow.style.cssText = 'margin: 8px 0; display: flex; align-items: center; gap: 8px;';
        const wsToggleLabel = document.createElement('span');
        wsToggleLabel.textContent = 'WebSocket 模式:';
        const wsToggleBtn = document.createElement('button');
        wsToggleBtn.textContent = CONFIG.useWebSocket ? 'ON' : 'OFF';
        wsToggleBtn.style.cssText = `
            padding: 4px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            background: ${CONFIG.useWebSocket ? '#2196F3' : '#9E9E9E'};
            color: #fff;
            font-weight: bold;
        `;
        wsToggleBtn.onclick = () => {
            CONFIG.useWebSocket = !CONFIG.useWebSocket;
            GM_setValue('labyrinth_ws_useWebSocket', CONFIG.useWebSocket);
            wsToggleBtn.textContent = CONFIG.useWebSocket ? 'ON' : 'OFF';
            wsToggleBtn.style.background = CONFIG.useWebSocket ? '#2196F3' : '#9E9E9E';
            log(`WebSocket 模式已${CONFIG.useWebSocket ? '启用' : '禁用'}`, CONFIG.useWebSocket ? 'success' : 'warn');
        };
        wsToggleRow.appendChild(wsToggleLabel);
        wsToggleRow.appendChild(wsToggleBtn);
        panel.appendChild(wsToggleRow);

        // 检测间隔设置
        const intervalRow = document.createElement('div');
        intervalRow.style.cssText = 'margin: 8px 0;';
        const intervalLabel = document.createElement('span');
        intervalLabel.textContent = '检测间隔 (分钟):';
        intervalRow.appendChild(intervalLabel);
        
        const intervalInput = document.createElement('input');
        intervalInput.type = 'number';
        intervalInput.value = CONFIG.checkInterval / 1000 / 60;
        intervalInput.min = '1';
        intervalInput.max = '120';
        intervalInput.style.cssText = 'width: 60px; margin-left: 8px; padding: 4px; border-radius: 4px; border: 1px solid #555; background: #333; color: #fff;';
        intervalInput.onchange = () => {
            const minutes = parseInt(intervalInput.value) || 30;
            CONFIG.checkInterval = minutes * 60 * 1000;
            GM_setValue('labyrinth_ws_checkInterval', CONFIG.checkInterval);
            log(`检测间隔已设置为 ${minutes} 分钟`, 'success');
        };
        intervalRow.appendChild(intervalInput);
        panel.appendChild(intervalRow);

        // 状态显示
        const statusRow = document.createElement('div');
        statusRow.style.cssText = 'margin: 8px 0; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; font-family: monospace;';
        statusRow.id = 'labyrinthStatusDisplay';
        statusRow.textContent = '状态：初始化中...';
        panel.appendChild(statusRow);

        // 手动操作按钮
        const actionRow = document.createElement('div');
        actionRow.style.cssText = 'margin: 8px 0; display: flex; gap: 8px;';
        
        const enterBtn = document.createElement('button');
        enterBtn.textContent = '进入迷宫';
        enterBtn.style.cssText = 'flex: 1; padding: 6px; border: none; border-radius: 4px; cursor: pointer; background: #2196F3; color: #fff;';
        enterBtn.onclick = async () => {
            statusRow.textContent = '状态：进入迷宫中...';
            try {
                await enterLabyrinth();
                statusRow.textContent = '状态：已进入迷宫';
            } catch (e) {
                statusRow.textContent = '状态：进入失败 - ' + e.message;
            }
        };
        
        const endBtn = document.createElement('button');
        endBtn.textContent = '结束迷宫';
        endBtn.style.cssText = 'flex: 1; padding: 6px; border: none; border-radius: 4px; cursor: pointer; background: #f44336; color: #fff;';
        endBtn.onclick = async () => {
            statusRow.textContent = '状态：结束迷宫中...';
            try {
                if (automation) {
                    await automation.attemptEndLabyrinthViaUI();
                } else {
                    await endLabyrinth();
                }
                statusRow.textContent = '状态：已结束迷宫';
            } catch (e) {
                statusRow.textContent = '状态：结束失败 - ' + e.message;
            }
        };
        
        actionRow.appendChild(enterBtn);
        actionRow.appendChild(endBtn);
        panel.appendChild(actionRow);

        // 关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'position: absolute; top: 5px; right: 8px; background: none; border: none; color: #fff; cursor: pointer; font-size: 16px;';
        closeBtn.onclick = () => panel.remove();
        panel.appendChild(closeBtn);

        document.documentElement.appendChild(panel);

        // 使面板可拖动
        let dragging = false, offsetX = 0, offsetY = 0;
        title.addEventListener('mousedown', (e) => {
            dragging = true;
            offsetX = e.clientX - panel.offsetLeft;
            offsetY = e.clientY - panel.offsetTop;
            panel.style.right = 'auto';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (dragging) {
                panel.style.left = Math.max(0, e.clientX - offsetX) + 'px';
                panel.style.top = Math.max(0, e.clientY - offsetY) + 'px';
            }
        });
        
        document.addEventListener('mouseup', () => {
            dragging = false;
        });

        // 更新状态显示
        setInterval(() => {
            const statusEl = document.getElementById('labyrinthStatusDisplay');
            if (statusEl) {
                const inLabyrinth = gameDataManager ? gameDataManager.isInLabyrinth : isInLabyrinth();
                const inPanel = isInLabyrinthPanel();
                const tickets = gameDataManager ? gameDataManager.getTicketCount() : getTicketCount();
                const wsStatus = wsManager ? wsManager.getStatus() : { connected: false, hasWs: false };
                
                let wsIndicator = '';
                if (CONFIG.useWebSocket && wsStatus.connected) {
                    wsIndicator = '🟢 WS';
                } else if (CONFIG.useWebSocket) {
                    wsIndicator = '🟡 WS';
                } else {
                    wsIndicator = '🔵 DOM';
                }
                
                statusEl.textContent = `${wsIndicator} 状态：${inLabyrinth ? '🔮 迷宫中' : (inPanel ? '📋 面板页' : '⏸️ 未进入')} | 入场券：${tickets.current}/${tickets.max} | ${automation?.autoRunning ? '🔄 自动运行' : '⏹️ 已停止'}`;
            }
        }, 2000);

        log('✅ 设置面板已创建', 'success');
    }

    // ==================== 初始化 ====================
    let automation = null;

    function init() {
        console.log('[迷宫自动化] ℹ️ ========== 🚀 迷宫自动化脚本 (WebSocket 版) 初始化 ==========');
        console.log(`[迷宫自动化] ℹ️ 主目标：通过 WebSocket 发包自动运行迷宫`);
        console.log(`[迷宫自动化] ℹ️ 检测间隔：${CONFIG.checkInterval / 1000 / 60}分钟`);
        console.log(`[迷宫自动化] ℹ️ WebSocket 发包模式：${CONFIG.useWebSocket ? '启用' : '禁用 (将使用DOM界面操作)'}\n`);
        
        // 延迟初始化，确保页面已加载
        setTimeout(() => {
            try {
                automation = new LabyrinthAutomation();
                
                // 启动自动化
                if (CONFIG.enableAuto) {
                    console.log('[迷宫自动化] ✅ 开始启动自动化...');
                    automation.start(); // 直接启动，不再等待WebSocket连接
                } else {
                    console.log('[迷宫自动化] ⚠️ 自动化已禁用，需要手动启动');
                }
                
                console.log('[迷宫自动化] ✅ 初始化完成\n');
            } catch (e) {
                console.error('[迷宫自动化] ❌ 初始化失败:', e.message);
                console.error(e.stack);
            }
        }, 2000);
    }

    // DOM 加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
