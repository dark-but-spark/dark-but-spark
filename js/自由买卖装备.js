// ==UserScript==
// @name         [银河奶牛]自由买卖装备
// @version      1.3.0
// @namespace    http://tampermonkey.net/
// @description  支持双账号批量物品转移：账号A挂高价买单，账号B以指定价格出售填单，实现物品快速转移
// @author       dark-but-spark
// @match        https://test.milkywayidle.com/*
// @match        https://test.milkywayidlecn.com/*
// @match        https://milkywayidle.com/*
// @match        https://milkywayidlecn.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=milkywayidle.com
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// @run-at       document-body
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // ==================== 配置参数 ====================
    const CONFIG = {
        retry: 3,
        wsReceiveTimeout: 120 * 1000,
        reqSpamProtecTimeout: 5000,
        sleepMinTime: 2500,  // 最小延迟2.5秒
        sleepMaxTime: 3500,  // 最大延迟3.5秒（均值3秒）
        MAX_LEVEL: 20,
        DEFAULT_TRANSFER_PRICE: 12000000, // 默认转移价格
    };

    let ws = null;
    let taskStatus = 0; // 0:空闲, 1:挂买单中, 2:填单出售中, -1:停止中

    // ==================== SweetAlert2 样式 ====================
    GM_addStyle(`
        .diy-swal2-container .swal2-popup {
            border: 1px solid #d0d0d0;
            border-radius: 0.25rem;
            box-shadow: 0 0 4px 4px hsla(0, 0%, 81.6%, 0.28);
            padding: 0.5rem;
            width: 25rem;
        }
        .diy-swal2-container .swal2-toast {
            padding: 0.25rem 0.5rem;
        }
        .diy-swal2-container .swal2-title {
            padding: 0;
            font-size: 1.25rem;
            text-align: left;
        }
        .diy-swal2-container .swal2-html-container {
            padding: 0;
            margin: 0.5rem 0 0;
            font-size: 1rem;
            text-align: left;
        }
        .diy-swal2-container .swal2-actions {
            padding: 0;
            margin: 0.5rem 0 0 0;
        }
        .diy-swal2-container .swal2-actions .swal2-styled {
            height: 2rem;
            line-height: 100%;
            padding: 0 0.625rem;
        }
    `);

    // ==================== 模态对话框 ====================
    const swal2Base = {
        customClass: {container: 'diy-swal2-container'},
        heightAuto: false,
        draggable: true,
        color: '#e7e7e7',
        background: '#131419',
        backdrop: 'rgba(25,26,36,0.8)',
        confirmButtonColor: '#4357af',
        denyButtonColor: '#ee9a1d',
        cancelButtonColor: '#db3333',
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonText: '确认',
        denyButtonText: '拒绝',
        cancelButtonText: '取消',
    };

    const modal = {
        _toast: null,
        _toastify(text) {
            if (!window.Swal) return;
            if (!this._toast) {
                this._toast = Swal.mixin({
                    position: 'top',
                    toast: true,
                    timer: 3000,
                    showConfirmButton: false,
                    customClass: {container: 'diy-swal2-container'},
                    color: '#e7e7e7',
                    background: 'rgba(53, 69, 139, 0.9)',
                    didOpen: (toast) => {
                        toast.onmouseenter = Swal.stopTimer;
                        toast.onmouseleave = Swal.resumeTimer;
                    },
                });
            }
            this._toast.fire({text});
        },
        _swal(options) {
            return Swal.fire({...swal2Base, ...options});
        },
        alert(text, title) {
            if (!text || !window.Swal) return;
            this._swal({title: title || '', html: text.replace(/\r?\n/g, '<br/>')});
        },
        confirm(text, title) {
            if (!text || !window.Swal) return Promise.resolve(true);
            return this._swal({title: title || '', html: text.replace(/\r?\n/g, '<br/>'), showCancelButton: true})
                .then((r) => !!r.isConfirmed);
        },
        prompt(text, title) {
            if (!text || !window.Swal) return Promise.resolve('');
            return this._swal({
                title: title || '',
                html: text.replace(/\r?\n/g, '<br/>'),
                showCancelButton: true,
                input: 'text',
                inputAttributes: {autocomplete: 'off'},
            }).then((r) => (r.isConfirmed ? r.value : null));
        },
        toast(text) {
            if (!text) return;
            this._toastify(text);
        },
    };

    // ==================== 工具函数 ====================
    const utils = {
        // 缓存 characterItemMap
        _characterItemMapCache: null,
        _characterItemMapCacheTime: 0,
        _characterItemMapCacheTimeout: 5000,

        async sleep(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
        },
        async sleepRandom(min = CONFIG.sleepMinTime, max = CONFIG.sleepMaxTime) {
            const delay = Math.floor(Math.random() * (max - min + 1)) + min;
            return this.sleep(delay);
        },
        getShowTime(startTime) {
            const time = (new Date().getTime() - startTime) / 1000.0;
            return time > 60 ? `${(time / 60).toFixed(1)}分钟` : `${time.toFixed(1)}秒`;
        },
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
                console.warn('[自由买卖] 获取 characterItemMap 失败:', error);
                return null;
            }
        },
        clearItemMapCache() {
            this._characterItemMapCache = null;
            this._characterItemMapCacheTime = 0;
        },
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
                console.warn('[自由买卖] 获取物品数量失败:', error);
            }
            return 0;
        },
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
                console.warn('[自由买卖] 获取装备信息失败:', error);
                return null;
            }
        },
        getEquipmentLevelDistribution(itemId) {
            const items = [];
            for (let level = 1; level <= 19; level++) {
                const count = this.getCountById(itemId, level);
                if (count > 0) {
                    items.push({ level, count });
                }
            }
            return items;
        },
        formatLevelDistribution(items) {
            if (items.length === 0) {
                return '无库存';
            }
            return items.map(item => `+${item.level}:${item.count}`).join(', ');
        },
        parsePurchaseInput(input) {
            const items = [];
            const regex = /([a-zA-Z0-9_]+):(\d+)(?::(\d+))?/g;
            let match;
            while ((match = regex.exec(input)) !== null) {
                items.push({
                    itemHrid: `/items/${match[1]}`,
                    itemName: match[1],
                    quantity: parseInt(match[2]),
                    price: match[3] ? parseInt(match[3]) : null
                });
            }
            return items;
        },
        createMarketOrderMessage(isBuy, itemHrid, enhancementLevel, quantity, price, isInstant) {
            return {
                ts: Date.now(),
                type: 'post_market_order',
                postMarketOrderData: {
                    isSell: !isBuy,  // 游戏API使用isSell参数，true=卖单，false=买单
                    itemHrid: itemHrid,
                    enhancementLevel: enhancementLevel,
                    quantity: quantity,
                    price: price,
                    isInstantOrder: isInstant,  // 游戏API使用isInstantOrder
                    confirmedMisprice: false
                }
            };
        },
        sendMarketOrder(ws, message, timeout = CONFIG.wsReceiveTimeout) {
            if (ws?.readyState !== window.WebSocket.OPEN) {
                return Promise.reject(new Error('WebSocket 未连接'));
            }
            try {
                ws.send(JSON.stringify(message));
            } catch (e) {
                return Promise.reject(e);
            }
            const st = new Date().getTime();
            return new Promise((resolve, reject) => {
                const handleReceipt = async (event) => {
                    const receipt = JSON.parse(event.data);
                    const successMessages = [
                        'infoNotification.buyListingProgress',
                        'infoNotification.buyOrderCompleted',
                        'infoNotification.sellListingProgress',
                        'infoNotification.sellOrderCompleted'
                    ];
                    if (receipt.type === 'info' && successMessages.includes(receipt.message)) {
                        cleanUp();
                        resolve(receipt);
                    } else if (receipt.type === 'error') {
                        cleanUp();
                        reject(new Error(receipt.message || '操作失败'));
                    }
                };
                const handleError = (error) => {
                    cleanUp();
                    reject(new Error(error.message || '发送失败'));
                };
                const timeoutTimer = setTimeout(() => {
                    cleanUp();
                    reject(new Error(`超时，已等待${utils.getShowTime(st)}`));
                }, timeout);
                const intervalTimer = setInterval(() => {
                    if (taskStatus === -1) {
                        cleanUp();
                        reject(new Error('用户中止任务'));
                    }
                }, 100);
                const cleanUp = () => {
                    clearTimeout(timeoutTimer);
                    clearInterval(intervalTimer);
                    ws.removeEventListener('error', handleError);
                    ws.removeEventListener('close', handleError);
                    ws.removeEventListener('message', handleReceipt);
                };
                ws.addEventListener('error', handleError);
                ws.addEventListener('close', handleError);
                ws.addEventListener('message', handleReceipt);
            });
        },
        async getMarketData(itemHrid) {
            return new Promise((resolve, reject) => {
                const fullItemHrid = itemHrid.startsWith('/items/') ? itemHrid : `/items/${itemHrid}`;
                const cached = window.marketDataCache?.get(fullItemHrid);
                if (cached && Date.now() - cached.timestamp < 60000) {
                    resolve(cached.data);
                    return;
                }
                const timeout = setTimeout(() => {
                    ws.removeEventListener('message', handler);
                    reject(new Error('获取市场数据超时'));
                }, 8000);
                const handler = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'market_item_order_books_updated' && 
                            data.marketItemOrderBooks?.itemHrid === fullItemHrid) {
                            clearTimeout(timeout);
                            ws.removeEventListener('message', handler);
                            if (!window.marketDataCache) window.marketDataCache = new Map();
                            window.marketDataCache.set(fullItemHrid, {
                                data: data.marketItemOrderBooks,
                                timestamp: Date.now()
                            });
                            resolve(data.marketItemOrderBooks);
                        }
                    } catch (e) {}
                };
                ws.addEventListener('message', handler);
                if (window.PGE?.core?.handleGetMarketItemOrderBooks) {
                    window.PGE.core.handleGetMarketItemOrderBooks(fullItemHrid);
                }
            });
        },
        analyzeBidPrice(marketData) {
            const bids = marketData.orderBooks?.[0]?.bids;
            if (!bids?.length) return null;
            return bids[0].price;
        },
    };

    // ==================== UI 组件 ====================
    const ui = {
        container: null,
        placeBuyOrdersBtn: null,
        fillSellOrdersBtn: null,
        stopBtn: null,
        infoEle: null,

        init(mwiButtonsContainer) {
            if (mwiButtonsContainer.querySelector('#free-trade-place-buy-btn')) return;
            
            const btnBase = 'width: 100%; height: 2.25rem; font-size: 0.875rem; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 0.5rem;';
            
            // 账号A：创建接收订单（挂买单）
            const placeBuyOrdersBtn = document.createElement('button');
            placeBuyOrdersBtn.id = 'free-trade-place-buy-btn';
            placeBuyOrdersBtn.className = 'free-trade-component';
            placeBuyOrdersBtn.style.cssText = `${btnBase} background: #4357af;`;
            placeBuyOrdersBtn.textContent = '📥 账号A：创建接收订单';
            placeBuyOrdersBtn.onclick = () => this.clickPlaceBuyOrdersBtn();

            // 账号B：执行物品转移（填单出售）
            const fillSellOrdersBtn = document.createElement('button');
            fillSellOrdersBtn.id = 'free-trade-fill-sell-btn';
            fillSellOrdersBtn.className = 'free-trade-component';
            fillSellOrdersBtn.style.cssText = `${btnBase} background: #2fc4a7;`;
            fillSellOrdersBtn.textContent = '📤 账号B：执行物品转移';
            fillSellOrdersBtn.onclick = () => this.clickFillSellOrdersBtn();

            const stopBtn = document.createElement('button');
            stopBtn.id = 'free-trade-stop-btn';
            stopBtn.className = 'free-trade-component';
            stopBtn.style.cssText = `${btnBase} background: #db3333;`;
            stopBtn.textContent = '⏹️ 停止任务';
            stopBtn.onclick = () => this.clickStopBtn();

            mwiButtonsContainer.appendChild(placeBuyOrdersBtn);
            mwiButtonsContainer.appendChild(fillSellOrdersBtn);
            mwiButtonsContainer.appendChild(stopBtn);

            this.placeBuyOrdersBtn = placeBuyOrdersBtn;
            this.fillSellOrdersBtn = fillSellOrdersBtn;
            this.stopBtn = stopBtn;
        },

        initInfo() {
            if (document.querySelector('#free-trade-info-wrap')) return;
            const infoContainer = document.querySelector('.EnhancingPanel_enhancingAction__2GJtD .SkillActionDetail_info__3umoI');
            if (!infoContainer) return;

            const wrap = document.createElement('div');
            wrap.id = 'free-trade-info-wrap';
            wrap.className = 'free-trade-info-wrap';
            wrap.style.cssText = 'display: flex; grid-gap: 0.5rem; gap: 0.5rem; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #333;';

            const label = document.createElement('div');
            label.className = 'SkillActionDetail_label__1mGQJ';
            label.textContent = '📊 装备等级分布';
            label.style.cssText = 'min-width: 100px; color: #2fc4a7; font-weight: bold;';

            const value = document.createElement('div');
            value.className = 'SkillActionDetail_value__dQjYH';
            value.style.cssText = 'flex: 1; display: flex; align-items: center; gap: 0.5rem;';

            const infoEle = document.createElement('div');
            infoEle.id = 'free-trade-level-info';
            infoEle.style.cssText = 'font-size: 0.85rem; line-height: 1.6; color: #aaa; word-break: break-all; flex: 1;';
            infoEle.textContent = '选择装备后自动显示...';

            const copyBtn = document.createElement('button');
            copyBtn.id = 'free-trade-copy-btn';
            copyBtn.className = 'free-trade-copy-btn';
            copyBtn.style.cssText = 'padding: 0.25rem 0.5rem; font-size: 0.75rem; background: #4357af; color: white; border: none; border-radius: 3px; cursor: pointer; white-space: nowrap;';
            copyBtn.textContent = '📋 复制';
            copyBtn.onclick = () => this.copyLevelInfo();

            value.appendChild(infoEle);
            value.appendChild(copyBtn);
            wrap.appendChild(label);
            wrap.appendChild(value);
            infoContainer.appendChild(wrap);

            this.infoEle = infoEle;
            this.copyBtn = copyBtn;
        },

        copyLevelInfo() {
            if (!this.infoEle) return;
            
            const text = this.infoEle.textContent;
            if (!text || text === '选择装备后自动显示...' || text === '⚠️ 未检测到装备') {
                modal.toast('ℹ️ 没有可复制的内容');
                return;
            }

            navigator.clipboard.writeText(text).then(() => {
                modal.toast('✅ 已复制到剪贴板');
            }).catch(err => {
                console.error('复制失败:', err);
                modal.toast('❌ 复制失败');
            });
        },

        updateLevelInfo() {
            if (!this.infoEle) return;
            
            const equipment = utils.getCurrentEquipment();
            if (!equipment || !equipment.itemId) {
                this.infoEle.textContent = '⚠️ 未检测到装备';
                return;
            }

            utils.clearItemMapCache();
            const levelDist = utils.getEquipmentLevelDistribution(equipment.itemId);
            const output = utils.formatLevelDistribution(levelDist);
            this.infoEle.textContent = output;
            this.infoEle.style.color = '#e7e7e7';
        },

        async clickPlaceBuyOrdersBtn() {
            // 账号A：创建接收订单（挂买单）
            if (taskStatus !== 0) {
                modal.toast('⚠️ 任务执行中，请等待');
                return;
            }
            if (!ws) {
                modal.toast('❌ WebSocket 未连接！请先手动操作一次市场再试');
                return;
            }

            const equipment = utils.getCurrentEquipment();
            if (!equipment || !equipment.itemId) {
                modal.toast('❌ 未检测到装备，请先在强化页面选择装备');
                return;
            }

            const tips = `【账号A】创建接收订单\n\n当前装备: ${equipment.itemName}\n\n作用：为账号B创建出售目标\n流程：\n1. 账号A挂出买单\n2. 账号B以相同价格填单\n3. 物品从B转移到A\n\n注意：所有订单将使用统一价格 ${CONFIG.DEFAULT_TRANSFER_PRICE} 金币`;
            
            if (!(await modal.confirm(tips, '账号A：创建接收订单'))) return;

            const useInfo = '请输入每个等级的接收数量\n格式：等级:数量\n示例：1:10, 2:5, 3:8\n说明：所有等级将使用统一价格 ' + CONFIG.DEFAULT_TRANSFER_PRICE + ' 金币\n留空则所有等级各接收1个';
            const input = await modal.prompt(useInfo, '账号A：创建接收订单');
            
            // 解析输入
            let orders = [];
            if (!input || input.trim() === '') {
                // 默认所有等级各接收1个，使用默认价格
                const levelDist = utils.getEquipmentLevelDistribution(equipment.itemId);
                orders = levelDist.map(item => ({
                    level: item.level,
                    quantity: 1,
                    price: CONFIG.DEFAULT_TRANSFER_PRICE
                }));
            } else {
                const regex = /(\d+):(\d+)/g;
                let match;
                while ((match = regex.exec(input)) !== null) {
                    orders.push({
                        level: parseInt(match[1]),
                        quantity: parseInt(match[2]),
                        price: CONFIG.DEFAULT_TRANSFER_PRICE
                    });
                }
            }

            if (orders.length === 0) {
                modal.toast('❌ 输入格式错误，请使用：等级:数量');
                return;
            }

            const st = new Date().getTime();
            try {
                taskStatus = 1;
                let successCount = 0;
                let failCount = 0;
                let totalCost = 0;

                for (let i = 0; i < orders.length; i++) {
                    if (taskStatus === -1) {
                        modal.alert(`🚫 创建订单中止！\n成功: ${successCount}, 失败: ${failCount}\n总花费: ${totalCost} 金币\n耗时: ${utils.getShowTime(st)}`, '账号A：创建订单');
                        return;
                    }

                    const order = orders[i];
                    let retryCnt = 0;
                    let success = false;

                    while (retryCnt++ <= CONFIG.retry) {
                        try {
                            const itemHrid = `/items/${equipment.itemId}`;
                            const message = utils.createMarketOrderMessage(true, itemHrid, order.level, order.quantity, order.price, false);
                            await utils.sendMarketOrder(ws, message);
                            
                            const cost = order.quantity * order.price;
                            totalCost += cost;
                            modal.toast(`✅ +${order.level} x${order.quantity} @ ${order.price} 接收订单已创建（冻结${cost}金币）`);
                            success = true;
                            successCount++;
                            break;
                        } catch (err) {
                            if (retryCnt > CONFIG.retry) {
                                modal.toast(`❌ +${order.level} 创建失败: ${err.message}`);
                                failCount++;
                                break;
                            }
                            modal.toast(`⚠️ +${order.level} 重试第${retryCnt}次: ${err.message}`);
                            await utils.sleep(1000);
                        }
                    }

                    if (i < orders.length - 1 && taskStatus > 0) {
                        // 模拟人类点击间隔，均值3秒（1.5-4.5秒随机）
                        await utils.sleepRandom();
                        modal.toast(`⏳ 等待 ${(CONFIG.sleepMinTime + CONFIG.sleepMaxTime) / 2000} 秒后继续...`);
                    }
                }

                modal.alert(`✅ 账号A创建接收订单完成！\n成功: ${successCount}, 失败: ${failCount}\n总冻结资金: ${totalCost} 金币\n\n现在切换到账号B执行物品转移`, '账号A：创建订单');
            } catch (err) {
                console.error(err);
                modal.alert(`❌ 创建订单出现异常: ${err.message}\n耗时: ${utils.getShowTime(st)}`, '账号A：创建订单');
            } finally {
                taskStatus = 0;
            }
        },

        async clickFillSellOrdersBtn() {
            // 账号B：执行物品转移（填单出售）
            if (taskStatus !== 0) {
                modal.toast('⚠️ 任务执行中，请等待');
                return;
            }
            if (!ws) {
                modal.toast('❌ WebSocket 未连接！请先手动操作一次市场再试');
                return;
            }

            const equipment = utils.getCurrentEquipment();
            if (!equipment || !equipment.itemId) {
                modal.toast('❌ 未检测到装备，请先在强化页面选择装备');
                return;
            }

            utils.clearItemMapCache();
            const levelDist = utils.getEquipmentLevelDistribution(equipment.itemId);
            
            if (levelDist.length === 0) {
                modal.toast('❌ 当前装备无库存，无法转移');
                return;
            }

            const levelInfo = utils.formatLevelDistribution(levelDist);
            const tips = `【账号B】执行物品转移\n\n当前装备: ${equipment.itemName}\n等级分布: ${levelInfo}\n\n作用：将物品以 ${CONFIG.DEFAULT_TRANSFER_PRICE} 金币的价格出售给账号A\n流程：\n1. 使用统一价格 ${CONFIG.DEFAULT_TRANSFER_PRICE} 直接挂卖单\n2. 账号A的买单会自动匹配成交\n3. 物品立即转移到账号A\n\n注意：确保账号A已创建对应价格和等级的买单`;
            
            if (!(await modal.confirm(tips, '账号B：执行物品转移'))) return;

            const useInfo = '请选择要转移的等级:\n1. 输入 "all" 转移所有等级\n2. 输入等级范围如 "1-5"\n3. 输入具体等级如 "1,3,5"\n4. 留空默认转移所有等级';
            const input = await modal.prompt(useInfo, '账号B：执行物品转移');
            
            // 解析出售等级
            let levelsToTransfer = [];
            if (!input || input.trim() === '' || input.trim().toLowerCase() === 'all') {
                levelsToTransfer = levelDist.map(item => item.level);
            } else if (input.includes('-')) {
                const range = input.split('-').map(n => parseInt(n.trim()));
                if (range.length === 2 && !isNaN(range[0]) && !isNaN(range[1])) {
                    levelsToTransfer = levelDist.filter(item => item.level >= range[0] && item.level <= range[1]).map(item => item.level);
                }
            } else {
                const specificLevels = input.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                levelsToTransfer = levelDist.filter(item => specificLevels.includes(item.level)).map(item => item.level);
            }

            if (levelsToTransfer.length === 0) {
                modal.toast('❌ 未选择有效等级');
                return;
            }

            const st = new Date().getTime();
            try {
                taskStatus = 2;
                let successCount = 0;
                let failCount = 0;
                let totalQuantity = 0;
                let totalIncome = 0;

                for (const level of levelsToTransfer) {
                    if (taskStatus === -1) {
                        modal.alert(`🚫 物品转移中止！\n成功: ${successCount}, 失败: ${failCount}\n总数量: ${totalQuantity}\n总收入: ${totalIncome} 金币\n耗时: ${utils.getShowTime(st)}`, '账号B：物品转移');
                        return;
                    }

                    const quantity = utils.getCountById(equipment.itemId, level);
                    if (quantity <= 0) {
                        modal.toast(`⚠️ +${level} 库存为0，跳过`);
                        continue;
                    }

                    totalQuantity += quantity;
                    let retryCnt = 0;
                    let success = false;

                    while (retryCnt++ <= CONFIG.retry) {
                        try {
                            const itemHrid = `/items/${equipment.itemId}`;
                            // 使用配置的默认价格挂出卖单（左填单模式）
                            // isInstant=false 表示挂在卖单列表，等待系统自动匹配账号A的买单
                            const sellPrice = CONFIG.DEFAULT_TRANSFER_PRICE;
                            
                            // 挂单模式（isInstant=false），创建卖单等待匹配
                            // isBuy=false → isSell=!false=true → 卖单
                            const message = utils.createMarketOrderMessage(false, itemHrid, level, quantity, sellPrice, false);
                            
                            // 调试日志：打印实际发送的消息
                            console.log('[自由买卖-账号B] 发送订单消息:', JSON.stringify(message, null, 2));
                            console.log('[自由买卖-账号B] isSell参数值:', message.postMarketOrderData.isSell, '(true=卖单)');
                            console.log('[自由买卖-账号B] 装备ID:', equipment.itemId, '等级:', level, '数量:', quantity, '价格:', sellPrice);
                            
                            await utils.sendMarketOrder(ws, message);
                            
                            const income = quantity * sellPrice;
                            totalIncome += income;
                            modal.toast(`✅ +${level} x${quantity} @ ${sellPrice} 已挂出卖单（左填单，等待账号A买单匹配）`);
                            success = true;
                            successCount++;
                            break;
                        } catch (err) {
                            if (retryCnt > CONFIG.retry) {
                                modal.toast(`❌ +${level} 转移失败: ${err.message}`);
                                failCount++;
                                break;
                            }
                            modal.toast(`⚠️ +${level} 重试第${retryCnt}次: ${err.message}`);
                            await utils.sleep(1000);
                        }
                    }

                    if (levelsToTransfer.indexOf(level) < levelsToTransfer.length - 1 && taskStatus > 0) {
                        // 模拟人类点击间隔，均值3秒（1.5-4.5秒随机）
                        await utils.sleepRandom();
                        modal.toast(`⏳ 等待 ${(CONFIG.sleepMinTime + CONFIG.sleepMaxTime) / 2000} 秒后继续...`);
                    }
                }

                modal.alert(`✅ 账号B物品转移完成！\n成功: ${successCount}个等级, 失败: ${failCount}个等级\n总转移数量: ${totalQuantity}\n账号B获得: ${totalIncome} 金币\n账号A花费: ${totalIncome} 金币\n\n物品已成功从账号B转移到账号A！`, '账号B：物品转移');
            } catch (err) {
                console.error(err);
                modal.alert(`❌ 物品转移出现异常: ${err.message}\n耗时: ${utils.getShowTime(st)}`, '账号B：物品转移');
            } finally {
                taskStatus = 0;
            }
        },

        clickStopBtn() {
            if (taskStatus > 0) {
                taskStatus = -1;
                modal.toast('⚠️ 正在停止任务...');
            } else {
                modal.toast('ℹ️ 当前没有运行中的任务');
            }
        },
    };

    // ==================== Hook WebSocket ====================
    const origDataGet = Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'data').get;
    Object.defineProperty(MessageEvent.prototype, 'data', {
        get: function () {
            const data = origDataGet.call(this);
            const socket = this.currentTarget;
            if (
                socket instanceof WebSocket &&
                (socket.url.includes('milkywayidle.com/ws') || socket.url.includes('milkywayidlecn.com/ws')) &&
                socket.readyState === 1
            ) {
                ws = socket;
            }
            return data;
        },
        configurable: true,
    });

    // ==================== 监控页面变化 ====================
    let observeScanId = null;
    const observer = new MutationObserver((mutationsList) => {
        // 判断是否在强化页面
        const mwiEnhanceBtn = document.querySelector('.EnhancingPanel_enhancingAction__2GJtD .Button_success__6d6kU');
        if (!mwiEnhanceBtn) {
            document.querySelectorAll('.free-trade-component, .free-trade-info-wrap')?.forEach(el => el.remove());
            return;
        }

        // 初始化按钮组件
        const mwiButtonsContainer = mwiEnhanceBtn.parentNode;
        ui.init(mwiButtonsContainer);

        // 初始化信息显示
        ui.initInfo();

        // 监听装备选择变化
        const itemContainer = document.querySelector(
            '.EnhancingPanel_enhancingAction__2GJtD .SkillActionDetail_primaryItemSelectorContainer__nrvNW'
        );
        if (itemContainer) {
            for (const mutation of mutationsList) {
                const isTargetAffected =
                    mutation.target === itemContainer ||
                    itemContainer.contains(mutation.target);
                if (isTargetAffected) {
                    if (!observeScanId) {
                        observeScanId = setTimeout(() => {
                            utils.clearItemMapCache();
                            ui.updateLevelInfo();
                            observeScanId = null;
                        }, 100);
                    }
                    break;
                }
            }
        }
    });

    observer.observe(document.body, {childList: true, subtree: true, attributes: true, characterData: true});

    // 页面卸载时断开 observer
    window.addEventListener('beforeunload', () => {
        observer.disconnect();
        if (observeScanId) clearTimeout(observeScanId);
    });

    console.log('🎯 [银河奶牛]自由买卖装备脚本已加载 v1.3.0 - 支持批量物品转移');
})();
