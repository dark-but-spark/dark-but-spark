// ==UserScript==
// @name         [银河奶牛]装备强化轻松+20（测试服专用）
// @version      2.3.4
// @namespace    http://tampermonkey.net/
// @description  1.选择强化物品和基底等级对，根据库存物品强化等级及数量自动计算+20所需基底数量并批量添加强化任务；2.根据库存物品强化等级计算合成+20的强化任务序列，批量添加使用贤者之镜的强化任务。
// @author       sunrishe
// @website      https://greasyfork.org/zh-CN/scripts/567954
// @website      https://gf.qytechs.cn/zh-CN/scripts/567954
// @match        https://test.milkywayidle.com/*
// @match        https://test.milkywayidlecn.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=milkywayidle.com
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// @run-at       document-body
// @license      MIT
// @reference    脚本设计思路参考 https://greasyfork.org/zh-CN/scripts/560117
// @reference    部分工具方法参考 https://greasyfork.org/zh-CN/scripts/538797
// @downloadURL https://updategf.qytechs.cn/scripts/567954/%5B%E9%93%B6%E6%B2%B3%E5%A5%B6%E7%89%9B%5D%E8%A3%85%E5%A4%87%E5%BC%BA%E5%8C%96%E8%BD%BB%E6%9D%BE%2B20%EF%BC%88%E6%B5%8B%E8%AF%95%E6%9C%8D%E4%B8%93%E7%94%A8%EF%BC%89.user.js
// @updateURL https://updategf.qytechs.cn/scripts/567954/%5B%E9%93%B6%E6%B2%B3%E5%A5%B6%E7%89%9B%5D%E8%A3%85%E5%A4%87%E5%BC%BA%E5%8C%96%E8%BD%BB%E6%9D%BE%2B20%EF%BC%88%E6%B5%8B%E8%AF%95%E6%9C%8D%E4%B8%93%E7%94%A8%EF%BC%89.meta.js
// ==/UserScript==

(function () {
    'use strict';
    const urlParams = new URLSearchParams(window.location.search);
    const characterId = urlParams.get('characterId');
    let ws = null;

    // 允许修改的参数
    const retry = 3; // 添加队列时失败最大重试次数
    const wsReceiveTimeout = 120 * 1000; // 添加队列时等待回执的超时时间
    const addQueueSleepMinTime = 1000; // 添加队列成功后的最小等待时间
    const addQueueSleepMaxTime = 2000; // 添加队列成功后的最大等待时间

    // 引入SweetAlert2自定义样式
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

        .diy-swal2-container .swal2-toast .swal2-html-container {
            padding: 0.5rem;
            margin: 0;
            text-align: left;
        }

        .diy-swal2-container .swal2-input {
            height: 1.5rem;
            padding: 0.25rem;
            margin: 0.5rem 0 0;
            font-size: 0.875rem;
        }

        .diy-swal2-container .swal2-actions {
            padding: 0;
            margin: 0.5rem 0 0 0;
        }

        .diy-swal2-container .swal2-actions .swal2-styled {
            height: 2rem;
            line-height: 100%;
            padding: 0 0.625rem;
            margin-top: 0;
            margin-bottom: 0;
        }
    `);

    // 模态对话框
    const modal = {
        useSweetAlert2: true, // 是否启用SweetAlert2对话框组件
        get native() {
            return !(this.useSweetAlert2 && window.Swal);
        },
        swal2DefaultOptions: {
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
        },
        swal2Toast: null,
        alert(text, title) {
            if (!text) return;
            if (this.native) {
                alert(text);
                return;
            }
            Swal.fire({
                ...this.swal2DefaultOptions,
                title: title || '',
                html: text.replace(/\r?\n/g, '<br/>'),
            });
        },
        confirm(text, title) {
            return new Promise((resolve) => {
                if (!text) return;
                if (this.native) {
                    if (confirm(text)) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                    return;
                }
                Swal.fire({
                    ...this.swal2DefaultOptions,
                    title: title || '',
                    html: text.replace(/\r?\n/g, '<br/>'),
                    showCancelButton: true,
                }).then((result) => {
                    if (result.isConfirmed) {
                        resolve(true);
                    } else if (!result.isDeny) {
                        resolve(false);
                    }
                });
            });
        },
        prompt(text, title) {
            return new Promise((resolve) => {
                if (!text) return;
                if (this.native) {
                    resolve(prompt(text));
                    return;
                }
                Swal.fire({
                    ...this.swal2DefaultOptions,
                    title: title || '',
                    html: text.replace(/\r?\n/g, '<br/>'),
                    showCancelButton: true,
                    input: 'text',
                    inputAttributes: {
                        autocomplete: 'off',
                        max: 1000,
                    },
                }).then((result) => {
                    if (result.isConfirmed) {
                        resolve(result.value);
                    }
                });
            });
        },
        toast(text) {
            if (!text) return;
            if (this.native) {
                return;
            }
            if (!this.swal2Toast) {
                this.swal2Toast = Swal.mixin({
                    position: 'top',
                    toast: true,
                    timer: 3000,
                    // timerProgressBar: true,
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
            this.swal2Toast.fire({
                text: text,
            });
        },
    };

    // ==================== 工具函数 ====================
    const utils = {
        // 异步 sleep，支持随机延迟
        async sleep(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
        },
        async sleepRandom(min = 800, max = 1400) {
            const delay = Math.floor(Math.random() * (max - min + 1)) + min;
            return this.sleep(delay);
        },
        getShowTime(startTime) {
            const time = (new Date().getTime() - startTime) / 1000.0;
            return time > 60 ? `${(time / 60).toFixed(1)}分钟` : `${time.toFixed(1)}秒`;
        },
        // 获取物品库存数量
        getCountById(itemId, level = 0) {
            try {
                const headerElement = document.querySelector('.Header_header__1DxsV');
                const reactKey = Reflect.ownKeys(headerElement).find((key) => key.startsWith('__reactProps'));
                const characterItemMap = headerElement[reactKey]?.children?.[0]?._owner?.memoizedProps?.characterItemMap;
                if (!characterItemMap) return 0;
                const searchSuffix = `::/item_locations/inventory::/items/${itemId}::${level}`;
                for (let [key, value] of characterItemMap) {
                    if (key.endsWith(searchSuffix)) {
                        return value?.count || 0;
                    }
                }
                return 0;
            } catch {
                return 0;
            }
        },
        /**
         * 创建强化任务的WebSocket消息
         * @param {*} hrid 物品ItemId
         * @param {*} curLevel 选中的物品等级
         * @param {*} maxLevel 目标等级
         * @param {*} loadoutId 配装ID
         * @param {*} isProtec true使用保护之镜，false使用贤者之镜
         * @returns  {Object} 返回消息体
         */
        createEnhanceMessage(hrid, curLevel, maxLevel, loadoutId, isProtec = true) {
            return {
                ts: new Date().getTime(),
                type: 'new_character_action',
                newCharacterActionData: {
                    actionHrid: '/actions/enhancing/enhance',
                    characterLoadoutId: parseInt(loadoutId),
                    difficultyTier: 0,
                    enhancingMaxLevel: parseInt(maxLevel),
                    enhancingProtectionMinLevel: 2,
                    hasMaxCount: false,
                    isStartNow: false,
                    maxCount: 0,
                    primaryItemHash: `${characterId}::/item_locations/inventory::/items/${hrid}::${curLevel}`,
                    secondaryItemHash: `${characterId}::/item_locations/inventory::/items/${isProtec ? 'mirror_of_protection' : 'philosophers_mirror'}::0`,
                    shouldClearQueue: false,
                },
            };
        },
        sendEnhanceTask(ws, message, timeout = wsReceiveTimeout) {
            // 检查连接是否可用
            if (ws?.readyState !== window.WebSocket.OPEN) {
                return Promise.reject(new Error('WebSocket 未连接，无法发送消息'));
            }
            // 发送消息
            try {
                ws.send(JSON.stringify(message));
            } catch (e) {
                // 捕获 send() 同步报错（如参数非法）
                return Promise.reject(e);
            }
            // 返回 Promise 用于后续判断最终结果
            const st = new Date().getTime();
            return new Promise((resolve, reject) => {
                // 监听服务端回执
                const handleReceipt = (event) => {
                    const receipt = JSON.parse(event.data);
                    // 匹配回执的消息内容
                    if (receipt.type === 'actions_updated' && receipt.endCharacterActions?.length === 1) {
                        const respData = receipt.endCharacterActions[0];
                        const sendData = message.newCharacterActionData;
                        if (
                            respData.isDone === false &&
                            respData.actionHrid === sendData.actionHrid &&
                            respData.enhancingMaxLevel === sendData.enhancingMaxLevel &&
                            respData.primaryItemHash === sendData.primaryItemHash &&
                            respData.secondaryItemHash === sendData.secondaryItemHash
                        ) {
                            cleanUp();
                            resolve(receipt);
                        }
                    }
                };

                // 监听发送失败的事件
                const handleError = (error) => {
                    cleanUp();
                    reject(new Error(`消息发送失败: ${error.message}`));
                };

                // 超时器，避免无限等待
                const timeoutTimer = setTimeout(() => {
                    cleanUp();
                    reject(new Error(`消息发送超时，已等待${utils.getShowTime(st)}`));
                }, timeout);

                // 监听停止信号
                const intervalTimer = setInterval(() => {
                    if (components.taskStatus === -1) {
                        cleanUp();
                        reject(new Error(`用户中止任务`));
                    }
                }, 100);

                // 清理事件监听（避免内存泄漏）
                const cleanUp = () => {
                    clearTimeout(timeoutTimer);
                    clearInterval(intervalTimer);
                    ws.removeEventListener('error', handleError);
                    ws.removeEventListener('close', handleError);
                    ws.removeEventListener('message', handleReceipt);
                };

                // 监听错误/关闭事件（代表发送失败）
                ws.addEventListener('error', handleError);
                ws.addEventListener('close', handleError);
                ws.addEventListener('message', handleReceipt);
            });
        },
        /**
         * 计算升级到指定目标需要的强化数量
         * @param {Number} targetLevel 目标等级
         * @param {Number} minLevel  最小等级
         * @param {Number[]} levelCount 当前0~targetLevel的所有数量
         * @return {Number[]} 强化到targetLevel需要的0~targetLevel的数量
         */
        calcEnhanceCount(targetLevel, minLevel, levelCount) {
            const calc = (targetLevel, minLevel, levelCount, enhanceCount) => {
                // 检查目标等级是否已存在
                if (levelCount[targetLevel] > enhanceCount[targetLevel]) {
                    enhanceCount[targetLevel] += 1;
                    return;
                }
                // 接近最小等级则无需继续往下计算
                if (targetLevel === minLevel + 1 || targetLevel === minLevel) {
                    enhanceCount[targetLevel] += 1;
                    return;
                }
                const levelDown1 = targetLevel - 1,
                    levelDown2 = targetLevel - 2;
                // 先合成level-1
                calc(levelDown1, minLevel, levelCount, enhanceCount);
                // 再合成level-2
                calc(levelDown2, minLevel, levelCount, enhanceCount);
            };
            const enhanceCount = new Array(targetLevel + 1).fill(0);
            calc(targetLevel, minLevel, levelCount, enhanceCount);
            return enhanceCount;
        },
        /**
         * 根据所有等级的数量计算强化任务
         * @param {Number[]} levelCount 当前0~targetLevel的所有数量
         * @param {Number[]} enhanceCount 强化到targetLevel需要的0~targetLevel的数量
         * @returns {Object} 返回对象，0表示缺少的空白底子，其他表示对应等级需要使用什么等级来强化
         */
        calcEnhanceTask(levelCount, enhanceCount) {
            const enhanceTask = {},
                _enhanceCount = [...enhanceCount];
            // 计算
            const length = Math.max(levelCount.length, _enhanceCount.length);
            for (let i = 0; i < length; i++) {
                const min = Math.min(levelCount[i], _enhanceCount[i]);
                levelCount[i] -= min;
                _enhanceCount[i] -= min;
            }
            for (let i = 0; i < _enhanceCount.length; i++) {
                while (_enhanceCount[i]-- > 0) {
                    for (let j = i; j >= 0; j--) {
                        if (levelCount[j] > 0) {
                            if (i > j) {
                                enhanceTask[i] = enhanceTask[i] || [];
                                enhanceTask[i].push(j);
                            }
                            levelCount[j]--;
                            break;
                        } else if (j === 0) {
                            enhanceTask[i] = enhanceTask[i] || [];
                            enhanceTask[i].push(j);
                            enhanceTask[0] = (enhanceTask[0] || 0) + 1;
                            break;
                        }
                    }
                }
            }
            return enhanceTask;
        },
        /**
         * 计算合成到targetLevel所需的步骤
         * @param {Number} targetLevel 目标等级
         * @param {Number[]} levelCount 当前0~targetLevel的所有数量
         * @return {Number[]} mergeTask 合成任务
         */
        calcMergeTask(targetLevel, levelCount) {
            const calc = (targetLevel, levelCount, mergeTask) => {
                // 检查目标等级是否已存在
                if (levelCount[targetLevel] > 0) {
                    return;
                }
                // 等级小于2的无法合成
                if (targetLevel < 2) {
                    return;
                }
                const levelDown1 = targetLevel - 1,
                    levelDown2 = targetLevel - 2;
                // 先合成level-1
                if (levelCount[levelDown1] < 1) {
                    calc(levelDown1, levelCount, mergeTask);
                }
                // 再合成level-2
                if (levelCount[levelDown2] < 1) {
                    calc(levelDown2, levelCount, mergeTask);
                }
                // 添加合成任务
                if (levelCount[levelDown1] < 1 || levelCount[levelDown2] < 1) {
                    throw new Error(`合成+${targetLevel}物品不足`);
                } else {
                    mergeTask.push(levelDown1);
                    levelCount[targetLevel] += 1;
                    levelCount[levelDown1] -= 1;
                    levelCount[levelDown2] -= 1;
                }
            };
            const mergeTask = [],
                _levelCount = [...levelCount];
            calc(targetLevel, _levelCount, mergeTask);
            return mergeTask;
        },
        /**
         * 计算合成到targetLevel所需的最短步骤
         * @param {Number} targetLevel 目标等级
         * @param {Number[]} levelCount 当前0~targetLevel的所有数量
         * @return {Number[][]} 合成任务
         */
        calcMinMergeTask(mergeTask) {
            const result = [];
            for (let i = 0; i < mergeTask.length; i++) {
                const cur = mergeTask[i];
                let added = false;
                for (let j = result.length - 1; j >= 0; j--) {
                    if (result[j][1] === cur) {
                        result[j][1] = cur + 1;
                        added = true;
                        break;
                    }
                }
                if (!added) {
                    let ii = -1;
                    for (let j = 0; j < result.length; j++) {
                        if (cur > result[j][0]) {
                            ii = j;
                        } else {
                            break;
                        }
                    }
                    result.splice(ii + 1, 0, [cur, cur + 1]);
                }
            }
            return result;
        },
    };

    // ================== 插件核心函数 ==================
    const components = {
        observeScanId: null,
        taskStatus: 0,
        freedomBtn: null,
        selectBtn: null,
        enhanceBtn: null,
        mergeBtn: null,
        stopBtn: null,
        infoEle: null,

        init(mwiButtonsContainer) {
            // 自由强化按钮
            const freedomBtn = document.createElement('button');
            freedomBtn.textContent = '自由强化';
            freedomBtn.id = 'easy20-freedom-btn';
            freedomBtn.className = 'easy20-component';
            freedomBtn.style.cssText = `
                width: 100%;
                height: 2.25rem;
                font-size: 0.875rem;
                background: #a272e4;
                /* background: #ac8fd4; */
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            `;

            // 自由强化按钮点击逻辑
            freedomBtn.onclick = async () => this.clickFreedomBtn();

            // 下拉选择基底等级对
            const selectBtn = document.createElement('select');
            selectBtn.id = 'easy20-select-btn';
            selectBtn.className = 'easy20-component';
            selectBtn.style.cssText =
                'width: 100%; height: 2.25rem; padding: 0 10px; font-size: 0.875rem; border-radius: 4px; text-align: center;';
            for (let low = 1; low <= 18; low++) {
                const option = document.createElement('option');
                option.value = low.toString();
                option.textContent = `(${low}, ${low + 1}) → +20`;
                if (low === 9) option.selected = true; // 默认选中 (9,10)
                selectBtn.appendChild(option);
            }

            selectBtn.onchange = () => this.changeSelectBtn();

            // 批量强化基底按钮
            const enhanceBtn = document.createElement('button');
            enhanceBtn.textContent = '批量强化+20基底';
            enhanceBtn.id = 'easy20-enhance-btn';
            selectBtn.className = 'easy20-component';
            enhanceBtn.style.cssText = `
                width: 100%;
                height: 2.25rem;
                font-size: 0.875rem;
                background: #4357af;
                /* background: #546ddb; */
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            `;

            // 批量强化基底按钮点击逻辑
            enhanceBtn.onclick = async () => this.clickEnhanceBtn();

            // 批量合成按钮
            const mergeBtn = document.createElement('button');
            mergeBtn.textContent = '批量合成+20';
            mergeBtn.id = 'easy20-merge-btn';
            mergeBtn.className = 'easy20-component';
            mergeBtn.style.cssText = `
                width: 100%;
                height: 2.25rem;
                font-size: 0.875rem;
                background: #2fc4a7;
                /* background: #59d0b9; */
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            `;

            // 批量合成按钮点击逻辑
            mergeBtn.onclick = async () => this.clickMergeBtn();

            // 停止按钮
            const stopBtn = document.createElement('button');
            stopBtn.textContent = '停止任务';
            stopBtn.id = 'easy20-stop-btn';
            stopBtn.className = 'easy20-component';
            stopBtn.style.cssText = `
                width: 100%;
                height: 2.25rem;
                font-size: 0.875rem;
                background: #db3333;
                /* background: #eb3f3f; */
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            `;

            stopBtn.onclick = () => this.clickStopBtn();

            // 添加提示信息区域
            const infoEle = document.createElement('div');
            infoEle.id = 'easy20-info-wrap';
            infoEle.className = 'easy20-component';
            infoEle.style.cssText = 'width: 100%; height: 2.25rem; font-size: 0.875rem;';

            // 插入控件（下拉菜单在上，按钮在下）
            mwiButtonsContainer.appendChild(freedomBtn);
            mwiButtonsContainer.appendChild(selectBtn);
            mwiButtonsContainer.appendChild(enhanceBtn);
            mwiButtonsContainer.appendChild(mergeBtn);
            mwiButtonsContainer.appendChild(stopBtn);
            mwiButtonsContainer.appendChild(infoEle);

            // 存储组件
            this.freedomBtn = freedomBtn;
            this.selectBtn = selectBtn;
            this.enhanceBtn = enhanceBtn;
            this.mergeBtn = mergeBtn;
            this.stopBtn = stopBtn;
            this.infoEle = infoEle;

            // 触发函数
            this.changeSelectBtn();
        },

        getBaseInfo() {
            const itemUse = document.querySelector(
                '.EnhancingPanel_enhancingAction__2GJtD .SkillActionDetail_primaryItemSelectorContainer__nrvNW use',
            );
            const itemId = itemUse?.getAttribute('href')?.split('#')[1] ?? null;
            return {
                // 物品ID
                itemId: itemId,
                // 配装ID
                get loadoutId() {
                    const loadoutInput = document.querySelector(
                        '.EnhancingPanel_enhancingAction__2GJtD .SkillActionDetail_loadoutDropdown__1wt-0 .MuiSelect-nativeInput',
                    );
                    return parseInt(loadoutInput?.value || 0);
                },
                // 基底等级
                low: parseInt(this.selectBtn?.value),
                // 强化等级0~20的物品数量
                get levelCount() {
                    if (!this.itemId) return new Array(21).fill(0);
                    // 获取0到20强化等级的物品数量
                    const levelCount = [];
                    for (let i = 0; i <= 20; i++) {
                        let cnt = utils.getCountById(this.itemId, i);
                        levelCount.push(cnt);
                    }
                    return levelCount;
                },
            };
        },

        checkTaskBefore(baseInfo) {
            if (!ws) {
                throw new Error('❌ WebSocket 未连接！请先手动点一次强化操作再试');
            }

            if (!baseInfo?.itemId) {
                throw new Error('❌ 未获取到物品信息！请确认已选择物品');
            }

            // 检查执行状态
            if (this.taskStatus === -1) {
                throw new Error('⚠️ 批量任务停止中，请稍等');
            } else if (this.taskStatus === 1) {
                throw new Error('⚠️ 批量强化基底任务执行中，请等待执行完成后再试');
            } else if (this.taskStatus === 2) {
                throw new Error('⚠️ 批量合成+20任务执行中，请等待执行完成后再试');
            } else if (this.taskStatus === 3) {
                throw new Error('⚠️ 自由强化任务执行中，请等待执行完成后再试');
            } else if (this.taskStatus > 0) {
                throw new Error('⚠️ 批量任务执行中，请等待执行完成后再试');
            }
        },

        async clickFreedomBtn() {
            const baseInfo = this.getBaseInfo();
            try {
                this.checkTaskBefore(baseInfo);
            } catch (e) {
                modal.toast(e.message);
                return;
            }
            const itemId = baseInfo.itemId;
            const loadoutId = baseInfo.loadoutId;

            // 自由强化提示信息
            const tips =
                // '自由强化提示\n' +
                '1. 【极其重要】强化等级对应的物品必须存在，否则发起任务无响应页面假死，可以点击停止任务中止；\n' +
                '2. 【重要】不会检测库存，添加任务时请确保基础物品及强化资源足够，否则强化任务会提前结束；\n' +
                '3. 保护之镜强化会读取页面选择的配装方案，贤者之镜强化则使用无配装；\n' +
                '4. 不建议使用福气茶，会出现预估外的物品；\n' +
                '5. 不建议添加过多队列，否则等待时间会很长。';
            if (!(await modal.confirm(tips, '自由强化提示'))) return;

            const useInfo =
                '保护之镜强化0到m共300次，m:300\n' +
                '保护之镜强化n到m共300次，n-m:300\n' +
                '贤者之镜强化n到m共300次，+n-m:300\n' +
                '请输入自由强化信息，多个任务用逗号隔开';
            const input = (await modal.prompt(useInfo, '自由强化')) || '';

            const st = new Date().getTime();
            try {
                // 发送强化指令
                this.taskStatus = 3;
                let count = 0,
                    round = 0;
                const regex = /(?<=(?:^|[,，]))\s*(?:(?:(\+)?([0-9]|1[1-9])-)?([0-9]|1[1-9]|20))\s*[:：]\s*(\d{1,4})\s*([,，]|$)/g;
                let result = null;
                while ((result = regex.exec(input)) !== null) {
                    round++;
                    const isProtec = result[1] !== '+';
                    const start = result[2] || 0;
                    const target = result[3];
                    const repeat = result[4];
                    const info = `第${round}轮，${isProtec ? '普通强化' : '贤者之镜合成'}+${start}到+${target}`;
                    console.log(`自由强化，匹配内容：${result[0]}，${info}`);
                    for (let i = 0; i < repeat; i++) {
                        let retryCnt = 0;
                        while (retryCnt++ <= retry) {
                            try {
                                if (this.taskStatus === -1) {
                                    modal.alert(
                                        `🚫 自由强化中止！\n共发起 ${round} 轮 ${count} 次强化任务，耗时${utils.getShowTime(st)}`,
                                        '自由强化',
                                    );
                                    return;
                                }
                                const message = utils.createEnhanceMessage(itemId, start, target, isProtec ? loadoutId : 0, isProtec);
                                const result = await utils.sendEnhanceTask(ws, message);
                                const msg = `♻️ 自由强化，${info}，执行${i + 1}/${repeat}任务成功`;
                                console.log(msg, message, result);
                                modal.toast(msg);
                                count++;
                                if (this.taskStatus > 0) await utils.sleepRandom(addQueueSleepMinTime, addQueueSleepMaxTime);
                                break;
                            } catch (err) {
                                if (retryCnt > retry) throw err;
                                const msg = `⚠️ 自由强化，${info}，执行${i + 1}/${repeat}任务失败，重试第${retryCnt}次。${err.message || ''}`;
                                console.log(msg);
                                modal.toast(msg);
                            }
                        }
                    }
                }

                modal.alert(`✅ 自由强化完成！\n共发起 ${round} 轮 ${count} 次强化任务，耗时${utils.getShowTime(st)}`, '自由强化');
            } catch (err) {
                console.error(err);
                modal.alert(`❌ 自由强化任务出现异常，耗时${utils.getShowTime(st)}。${err.message || ''}`, '自由强化');
            } finally {
                this.taskStatus = 0;
            }
        },

        changeSelectBtn() {
            const baseInfo = this.getBaseInfo();
            const itemId = baseInfo.itemId;
            const low = baseInfo.low; // 选中的基底等级

            if (!itemId) {
                this.infoEle.textContent = '';
                return;
            }

            // 获取0到20强化等级的物品数量
            const levelCount = baseInfo.levelCount;
            // 已存在+20的则忽略
            levelCount[20] = 0;
            // 获取强化所需数量
            const enhanceCount = utils.calcEnhanceCount(20, low, levelCount);

            // 生成提示信息
            let lackSum = 0;
            let infoArr = [];
            for (let i = enhanceCount.length - 1; i >= 0; i--) {
                const need = enhanceCount[i];
                if (need > 0) {
                    const exist = levelCount[i] ?? 0;
                    const lack = need - exist;
                    let msg = `+${i}: ${exist}/${need}`;
                    if (lack > 0) {
                        lackSum += lack;
                        msg += `缺${lack}`;
                    } else if (lack < 0) {
                        msg += `多${lack * -1}`;
                    }
                    infoArr.push(msg);
                }
            }
            if (lackSum > 0) {
                infoArr.push(`需强化${lackSum}个底子`);
            }
            // 判读是否满足合成条件
            try {
                const mergeTask = utils.calcMergeTask(20, levelCount);
                if (mergeTask.length > 0) {
                    const minMergeTask = utils.calcMinMergeTask(mergeTask);
                    infoArr.push(`========`);
                    infoArr.push(`恭喜，合成+20底子已足够`);
                    infoArr.push(`需要${mergeTask.length}个贤者之镜`);
                    infoArr.push(`需执行${minMergeTask.length}次合成任务`);
                }
            } catch (e) {}
            // 写入提示信息
            this.infoEle.innerHTML = infoArr.join('<br/>');
        },
        async clickEnhanceBtn() {
            const baseInfo = this.getBaseInfo();
            try {
                this.checkTaskBefore(baseInfo);
            } catch (e) {
                modal.toast(e.message);
                return;
            }
            const itemId = baseInfo.itemId;
            const loadoutId = baseInfo.loadoutId;
            const low = baseInfo.low; // 选中的基底等级

            // 获取0到20强化等级的物品数量
            const levelCount = baseInfo.levelCount;
            // 已存在+20的则忽略
            levelCount[20] = 0;
            // 获取强化所需数量
            const enhanceCount = utils.calcEnhanceCount(20, low, levelCount);
            const sumEnhanceCount = enhanceCount.reduce((pv, cv) => pv + cv, 0);

            if (sumEnhanceCount > 5000) {
                modal.toast(
                    `❌ 当前选择 (${low},${low + 1}) 需要 ${sumEnhanceCount} 次强化，超过安全上限 5000 次！\n建议选择更高等级对（如 (15,16) 以上）。`,
                );
                return;
            }

            if (sumEnhanceCount === 0) {
                modal.toast('❌ 计算待强化次数为0，请检查选择');
                return;
            }

            // 获取强化队列
            const enhanceTask = utils.calcEnhanceTask(levelCount, enhanceCount);
            if ((enhanceTask[0] ?? 0) > 0) {
                modal.toast(`❌ 还缺少${enhanceTask[0]}个+0物品`);
                return;
            }

            // 获取待强化的物品等级
            const enhanceTaskKeys = Object.keys(enhanceTask).sort((a, b) => a - b);

            if (enhanceTaskKeys.length === 0) {
                modal.toast(`✅ 恭喜，基底强化完成`);
                return;
            }

            // 弹出提示信息
            const tips =
                // '批量强化+20基底提示\n' +
                '1. 【重要】请准备充足的强化材料，否则强化任务会提前结束，后续强化队列清空；\n' +
                '2. 自动检测库存中物品是否充足，不足时会给出提示，不会检测已经装备的物品；\n' +
                '3. 计算强化队列会减掉库存内高于基底等级的物品数量；\n' +
                '4. 添加基底强化任务会使用页面选择的配装方案；\n' +
                '5. 不会检测任务队列，使用插件前建议先清空任务队列，否则会合成超过所需数量的物品；\n' +
                '6. 不建议使用福气茶，会出现预估外的物品；\n' +
                '7. 不要选择精物品进行强化，因为精物品强化需要普通物品升级，可以通过【炼金-解精炼】去掉精炼。';
            if (!(await modal.confirm(tips, '批量强化+20基底提示'))) return;

            console.log(`批量强化基底，enhanceCount, enhanceTask`, enhanceCount, enhanceTask);

            const st = new Date().getTime();
            try {
                // 发送强化指令
                this.taskStatus = 1;
                let count = 0;
                for (const key in enhanceTaskKeys) {
                    const value = enhanceTaskKeys[key];
                    const level = parseInt(value);
                    const childTask = enhanceTask[value];
                    for (let i = 0; i < childTask.length; i++) {
                        let retryCnt = 0;
                        while (retryCnt++ <= retry) {
                            try {
                                if (this.taskStatus === -1) {
                                    modal.alert(
                                        `🚫 批量强化基底中止！\n使用 (${low}, ${low + 1}) 基底对，共发起 ${count} 次强化任务，耗时${utils.getShowTime(st)}`,
                                        '批量强化+20基底',
                                    );
                                    return;
                                }
                                const message = utils.createEnhanceMessage(itemId, childTask[i], level, loadoutId);
                                const result = await utils.sendEnhanceTask(ws, message);
                                const msg = `♻️ 批量强化基底，执行+${level}: ${i + 1}/${childTask.length}任务成功`;
                                console.log(msg, message, result);
                                modal.toast(msg);
                                count++;
                                if (this.taskStatus > 0) await utils.sleepRandom(addQueueSleepMinTime, addQueueSleepMaxTime);
                                break;
                            } catch (err) {
                                if (retryCnt > retry) throw err;
                                const msg = `⚠️ 批量强化基底，执行+${level}: ${i + 1}/${childTask.length}任务失败，重试第${retryCnt}次。${err.message || ''}`;
                                console.log(msg);
                                modal.toast(msg);
                            }
                        }
                    }
                }

                modal.alert(
                    `✅ 批量强化基底完成！\n使用 (${low}, ${low + 1}) 基底对，共发起 ${count} 次强化任务，耗时${utils.getShowTime(st)}`,
                    '批量强化+20基底',
                );
            } catch (err) {
                console.error(err);
                modal.alert(`❌ 执行基底强化任务出现异常，耗时${utils.getShowTime(st)}。${err.message || ''}`, '批量强化+20基底');
            } finally {
                this.taskStatus = 0;
            }
        },
        async clickMergeBtn() {
            const baseInfo = this.getBaseInfo();
            try {
                this.checkTaskBefore(baseInfo);
            } catch (e) {
                modal.toast(e.message);
                return;
            }
            const itemId = baseInfo.itemId;
            const loadoutId = 0; // 合成使用无配装，避免配装影响合成

            // 获取0到20强化等级的物品数量
            const levelCount = baseInfo.levelCount;
            // 已存在+20的则忽略，使用低等级继续合成
            levelCount[20] = 0;
            try {
                // 获取合成任务
                const mergeTask = utils.calcMergeTask(20, levelCount);
                const minMergeTask = utils.calcMinMergeTask(mergeTask);

                // 弹出提示信息
                const tips =
                    // '批量合成+20提示\n' +
                    '1. 【重要】请准备充足的贤者之镜；\n' +
                    '2. 贤者之镜强化使用无配装，因为配装方案的自动使用高等级和福气茶可能导致合成失败；\n' +
                    '3. 不要选择精物品进行合成；\n' +
                    '4. 不要使用福气茶，会出现预估外的物品，导致合成失败；\n' +
                    '5. 合成队列添加失败可以等待现有队列执行完成后，再次点击合成按钮，会根据已有物品重新计算合成队列。';
                if (!(await modal.confirm(tips, '批量合成+20提示'))) return;

                console.log(`批量合成+20，levelCount, mergeTask, minMergeTask`, levelCount, mergeTask, minMergeTask);

                const st = new Date().getTime();
                try {
                    // 发送强化指令
                    this.taskStatus = 2;
                    let count = 0;
                    for (let i = 0; i < minMergeTask.length; i++) {
                        let retryCnt = 0;
                        while (retryCnt++ <= retry) {
                            const level = minMergeTask[i][0],
                                maxLevel = minMergeTask[i][1];
                            try {
                                if (this.taskStatus === -1) {
                                    modal.alert(
                                        `🚫 批量合成+20中止！\n共发起 ${count} 次强化任务，耗时${utils.getShowTime(st)}`,
                                        '批量合成+20',
                                    );
                                    return;
                                }
                                const message = utils.createEnhanceMessage(itemId, level, maxLevel, loadoutId, false);
                                const result = await utils.sendEnhanceTask(ws, message);
                                const msg = `♻️ 批量合成+20，执行${i + 1}/${minMergeTask.length}任务成功，${level}→${maxLevel}`;
                                console.log(msg, message, result);
                                modal.toast(msg);
                                count++;
                                if (this.taskStatus > 0) await utils.sleepRandom(addQueueSleepMinTime, addQueueSleepMaxTime);
                                break;
                            } catch (err) {
                                if (retryCnt > retry) throw err;
                                const msg = `⚠️ 批量合成+20，执行${i + 1}/${minMergeTask.length}任务失败，${level}→${maxLevel}，重试第${retryCnt}次。${err.message || ''}`;
                                console.log(msg);
                                modal.toast(msg);
                            }
                        }
                    }

                    modal.alert(`✅ 批量合成+20任务完成！\n共发起 ${count} 次强化任务，耗时${utils.getShowTime(st)}`, '批量合成+20');
                } catch (err) {
                    console.error(err);
                    modal.alert(`❌ 执行批量合成+20任务出现异常，耗时${utils.getShowTime(st)}。${err.message || ''}`, '批量合成+20');
                } finally {
                    this.taskStatus = 0;
                }
            } catch (err) {
                console.error(err);
                modal.toast('❌ 执行批量合成+20任务失败，请检查物品数量是否充足');
            }
        },
        clickStopBtn() {
            // 存在任务执行中则修改为停止状态
            if (this.taskStatus > 0) {
                this.taskStatus = -1;
            }
        },
    };

    // Hook WebSocket（支持所有域名）
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

    // 监控页面变化，添加自定义控件
    const observer = new MutationObserver((mutationsList) => {
        // 任务执行中，禁用行动队列提示框显示
        if (components.taskStatus !== 0 && document.querySelector('.QueuedActions_queuedActionsEditMenu__3OoQH')) {
            document.querySelector('.QueuedActions_queuedActions__2xerL')?.click();
        }

        // 判断是否是在强化页面
        const mwiEnhanceBtn = document.querySelector('.EnhancingPanel_enhancingAction__2GJtD .Button_success__6d6kU');
        if (!mwiEnhanceBtn) return;

        // 初始化按钮组件
        const mwiButtonsContainer = mwiEnhanceBtn.parentNode;
        if (!mwiButtonsContainer.querySelector('#easy20-enhance-btn')) {
            components.init(mwiButtonsContainer);
        }

        // 获取选中的物品itemId
        const itemContainer = document.querySelector(
            '.EnhancingPanel_enhancingAction__2GJtD .SkillActionDetail_primaryItemSelectorContainer__nrvNW',
        );
        if (itemContainer) {
            for (const mutation of mutationsList) {
                const isTargetAffected =
                    // 变化的节点是目标节点本身
                    mutation.target === itemContainer ||
                    // 变化的节点是目标节点的后代（如需仅监控自身可去掉此判断）
                    itemContainer.contains(mutation.target);
                if (isTargetAffected) {
                    if (!components.observeScanId) {
                        components.observeScanId = setTimeout(() => {
                            components.changeSelectBtn();
                            components.observeScanId = null;
                        }, 100);
                    }
                    break;
                }
            }
        }
    });

    observer.observe(document.body, {childList: true, subtree: true, attributes: true, characterData: true});
    console.log('🎯 [银河奶牛]装备强化轻松+20（测试服专用）脚本已加载');
})();
