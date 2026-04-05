// ==UserScript==
// @name         [银河奶牛]装备等级数量提取器
// @version      1.0.2
// @namespace    http://tampermonkey.net/
// @description  在强化面板显示当前选中装备的各强化等级数量，位于"+20 合成"信息下方，只显示数量大于0的等级
// @author       sunrishe
// @match        https://test.milkywayidle.com/*
// @match        https://test.milkywayidlecn.com/*
// @match        https://milkywayidle.com/*
// @match        https://milkywayidlecn.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=milkywayidle.com
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // ==================== 配置参数 ====================
    const CONFIG = {
        // 最大强化等级
        MAX_LEVEL: 20,
        // 刷新延迟 (毫秒)
        REFRESH_DELAY: 300,
        // Toast 显示时间 (毫秒)
        TOAST_DURATION: 2000,
    };

    // ==================== 工具函数 ====================
    const utils = {
        // 缓存 characterItemMap
        _characterItemMapCache: null,
        _characterItemMapCacheTime: 0,
        _characterItemMapCacheTimeout: 5000, // 缓存 5 秒

        /**
         * 获取缓存的 characterItemMap
         * @returns {Map|null} characterItemMap 或 null
         */
        getCharacterItemMap() {
            const now = Date.now();
            if (this._characterItemMapCache && now - this._characterItemMapCacheTime < this._characterItemMapCacheTimeout) {
                return this._characterItemMapCache;
            }
            try {
                const headerElement = document.querySelector('.Header_header__1DxsV');
                if (!headerElement) return null;
                
                const reactKey = Reflect.ownKeys(headerElement).find((key) => key.startsWith('__reactProps'));
                if (!reactKey) return null;
                
                const characterItemMap = headerElement[reactKey]?.children?.[0]?._owner?.memoizedProps?.characterItemMap;
                this._characterItemMapCache = characterItemMap || null;
                this._characterItemMapCacheTime = now;
                return this._characterItemMapCache;
            } catch (error) {
                console.warn('[装备提取器] 获取 characterItemMap 失败:', error);
                return null;
            }
        },

        /**
         * 清除缓存
         */
        clearItemMapCache() {
            this._characterItemMapCache = null;
            this._characterItemMapCacheTime = 0;
        },

        /**
         * 获取物品库存数量
         * @param {string} itemId - 物品 ID
         * @param {number} level - 强化等级
         * @returns {number} 物品数量
         */
        getCountById(itemId, level = 0) {
            try {
                const characterItemMap = this.getCharacterItemMap();
                if (!characterItemMap) return 0;
                
                const searchSuffix = `::/item_locations/inventory::/items/${itemId}::${level}`;
                for (let [key, value] of characterItemMap) {
                    if (key.endsWith(searchSuffix)) {
                        return value?.count || 0;
                    }
                }
            } catch (error) {
                console.warn('[装备提取器] 获取物品数量失败:', error);
            }
            return 0;
        },

        /**
         * 格式化输出结果，只显示数量大于0的等级
         * @param {Object[]} items - 物品信息数组 [{level, count}]
         * @returns {string} 格式化后的字符串
         */
        formatOutput(items) {
            // 只显示数量大于0的等级
            const nonZeroItems = items.filter(item => item.count > 0);
            if (nonZeroItems.length === 0) {
                return '所有等级数量均为0';
            }
            return nonZeroItems.map(item => `+${item.level}:${item.count}`).join(', ');
        },

        /**
         * 复制文本到剪贴板
         * @param {string} text - 要复制的文本
         */
        copyToClipboard(text) {
            if (typeof GM_setClipboard !== 'undefined') {
                GM_setClipboard(text);
            } else {
                navigator.clipboard.writeText(text).catch(err => {
                    console.error('[装备提取器] 复制失败:', err);
                });
            }
        },
    };

    // ==================== UI 组件 ====================
    const ui = {
        container: null,
        resultDiv: null,
        copyBtn: null,
        observeScanId: null,

        /**
         * 初始化 UI 容器 - 集成到强化面板信息区域
         */
        init() {
            // 检查是否已初始化
            if (document.querySelector('#equipment-level-extractor-wrap')) return;

            // 查找强化面板信息容器
            const infoContainer = document.querySelector('.EnhancingPanel_enhancingAction__2GJtD .SkillActionDetail_info__3umoI');
            if (!infoContainer) {
                console.log('[装备提取器] 未找到信息容器，等待页面加载...');
                return false;
            }

            // 创建包装容器
            const wrap = document.createElement('div');
            wrap.id = 'equipment-level-extractor-wrap';
            wrap.className = 'easy20-info-wrap';
            wrap.style.cssText = `
                display: flex;
                grid-gap: 0.5rem;
                gap: 0.5rem;
                margin-top: 0.5rem;
                padding-top: 0.5rem;
                border-top: 1px solid #333;
            `;

            // 标签
            const label = document.createElement('div');
            label.className = 'SkillActionDetail_label__1mGQJ';
            label.textContent = '📊 装备等级分布';
            label.style.cssText = 'min-width: 100px; color: #2fc4a7; font-weight: bold;';

            // 值容器
            const value = document.createElement('div');
            value.className = 'SkillActionDetail_value__dQjYH';
            value.style.cssText = 'flex: 1;';

            // 结果显示区域
            const resultDiv = document.createElement('div');
            resultDiv.id = 'equipment-level-result';
            resultDiv.style.cssText = `
                font-size: 0.85rem;
                line-height: 1.6;
                color: #aaa;
                word-break: break-all;
                min-height: 20px;
            `;
            resultDiv.textContent = '选择装备后自动显示...';

            // 复制按钮
            const copyBtn = document.createElement('button');
            copyBtn.textContent = '📋 复制';
            copyBtn.style.cssText = `
                margin-top: 6px;
                padding: 4px 10px;
                background: #4357af;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
                transition: background 0.2s;
            `;
            copyBtn.onmouseover = () => copyBtn.style.background = '#5a6dcf';
            copyBtn.onmouseout = () => copyBtn.style.background = '#4357af';
            copyBtn.onclick = () => this.handleCopy();

            value.appendChild(resultDiv);
            value.appendChild(copyBtn);
            wrap.appendChild(label);
            wrap.appendChild(value);
            infoContainer.appendChild(wrap);

            // 保存引用
            this.container = wrap;
            this.resultDiv = resultDiv;
            this.copyBtn = copyBtn;

            console.log('✅ [装备提取器] UI 初始化完成');
            return true;
        },

        /**
         * 更新结果显示
         * @param {string} text - 显示的文本
         * @param {boolean} isError - 是否为错误信息
         */
        updateResult(text, isError = false) {
            if (!this.resultDiv) return;
            
            this.resultDiv.textContent = text;
            this.resultDiv.style.color = isError ? '#db3333' : '#e7e7e7';
        },

        /**
         * 处理复制操作
         */
        handleCopy() {
            const text = this.resultDiv.textContent;
            if (!text || text === '选择装备后自动显示...' || text.startsWith('❌') || text.startsWith('⚠️') || text === '所有等级数量均为0') {
                this.showToast('❌ 没有可复制的内容', true);
                return;
            }

            utils.copyToClipboard(text);
            this.showToast('✅ 已复制到剪贴板!');
            console.log('[装备提取器] 已复制:', text);
        },

        /**
         * 显示 Toast 提示
         * @param {string} message - 提示信息
         * @param {boolean} isError - 是否为错误信息
         */
        showToast(message, isError = false) {
            // 移除已存在的 toast
            const existingToast = document.querySelector('.equipment-level-toast');
            if (existingToast) existingToast.remove();

            const toast = document.createElement('div');
            toast.className = 'equipment-level-toast';
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: ${isError ? 'rgba(219, 51, 51, 0.9)' : 'rgba(47, 196, 167, 0.9)'};
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 13px;
                z-index: 10000;
                animation: fadeInOut ${CONFIG.TOAST_DURATION}ms ease-in-out;
            `;
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => toast.remove(), CONFIG.TOAST_DURATION);
        },
    };

    // ==================== 核心逻辑 ====================
    const extractor = {
        currentItemId: null,

        /**
         * 获取当前选中的装备信息
         * @returns {{itemId: string|null, itemName: string}|null}
         */
        getCurrentEquipment() {
            try {
                const itemContainer = document.querySelector(
                    '.EnhancingPanel_enhancingAction__2GJtD .SkillActionDetail_primaryItemSelectorContainer__nrvNW'
                );
                
                if (!itemContainer) return null;

                const useElement = itemContainer.querySelector('use');
                if (!useElement) return null;

                const href = useElement.getAttribute('href');
                if (!href) return null;

                const itemId = href.split('#')[1];
                const itemName = itemContainer.parentNode.getAttribute('aria-label') || '未知装备';

                return { itemId, itemName };
            } catch (error) {
                console.warn('[装备提取器] 获取装备信息失败:', error);
                return null;
            }
        },

        /**
         * 提取并显示装备等级数量
         */
        async extractAndDisplay() {
            try {
                // 清除缓存，确保数据最新
                utils.clearItemMapCache();

                // 获取当前装备
                const equipment = this.getCurrentEquipment();
                if (!equipment || !equipment.itemId) {
                    ui.updateResult('⚠️ 未检测到装备');
                    this.currentItemId = null;
                    return;
                }

                // 如果装备没有变化，则跳过
                if (this.currentItemId === equipment.itemId) {
                    return;
                }

                this.currentItemId = equipment.itemId;
                console.log('[装备提取器] 开始提取装备:', equipment.itemName);

                // 提取各等级数量 (1-19 级，排除 0 级和 20 级)
                const items = [];
                for (let level = 1; level <= 19; level++) {
                    const count = utils.getCountById(equipment.itemId, level);
                    items.push({ level, count });
                }

                // 格式化输出（只显示数量大于 0 的等级）
                const output = utils.formatOutput(items);
                ui.updateResult(output);
                
                console.log('[装备提取器] 提取结果:', output);
            } catch (error) {
                console.error('[装备提取器] 提取失败:', error);
                ui.updateResult('❌ 提取失败', true);
            }
        },

        /**
         * 设置页面监听
         */
        setupObserver() {
            const observer = new MutationObserver((mutations) => {
                // 检查是否在强化页面
                const enhancePage = document.querySelector('.EnhancingPanel_enhancingAction__2GJtD');
                if (!enhancePage) {
                    // 不在强化页面，隐藏容器
                    if (ui.container) ui.container.style.display = 'none';
                    return;
                }

                // 在强化页面，显示容器
                if (ui.container) ui.container.style.display = 'flex';

                // 检测装备选择变化
                const itemContainer = document.querySelector(
                    '.EnhancingPanel_enhancingAction__2GJtD .SkillActionDetail_primaryItemSelectorContainer__nrvNW'
                );

                if (itemContainer && !this.observeScanId) {
                    for (const mutation of mutations) {
                        const isTargetAffected = 
                            mutation.target === itemContainer ||
                            itemContainer.contains(mutation.target);
                        
                        if (isTargetAffected) {
                            this.observeScanId = setTimeout(() => {
                                this.extractAndDisplay();
                                this.observeScanId = null;
                            }, CONFIG.REFRESH_DELAY);
                            break;
                        }
                    }
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true,
            });

            console.log('[装备提取器] 页面监听器已设置');

            // 页面卸载时清理
            window.addEventListener('beforeunload', () => {
                observer.disconnect();
                if (this.observeScanId) clearTimeout(this.observeScanId);
            });
        },

        /**
         * 初始化
         */
        init() {
            console.log('🎯 [装备提取器] 脚本已加载');
            
            // 添加 CSS 动画
            const style = document.createElement('style');
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                    20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                }
            `;
            document.head.appendChild(style);

            // 延迟初始化，确保页面完全加载
            const initCheck = setInterval(() => {
                if (ui.init()) {
                    clearInterval(initCheck);
                    this.setupObserver();
                    
                    // 初始提取一次
                    setTimeout(() => this.extractAndDisplay(), 500);
                }
            }, 500);

            // 最多尝试 10 次
            let attempts = 0;
            const maxAttempts = 10;
            const timeoutCheck = setInterval(() => {
                attempts++;
                if (attempts >= maxAttempts) {
                    clearInterval(timeoutCheck);
                    console.warn('[装备提取器] 初始化超时，放弃');
                }
            }, 1000);
        },
    };

    // ==================== 启动脚本 ====================
    extractor.init();
})();