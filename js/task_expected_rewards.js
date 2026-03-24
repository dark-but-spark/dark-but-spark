// ==UserScript==
// @name         任务期望奖励计算器
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  计算任务期望奖励和期望战斗次数 - 精简版
// @author       
// @license      MIT
// @match        https://www.milkywayidle.com/*
// @match        https://test.milkywayidle.com/*
// @match        https://www.milkywayidlecn.com/*
// @match        https://test.milkywayidlecn.com/*
// @icon         https://www.milkywayidle.com/favicon.svg
// @grant        none
// @run-at       document-end
// ==/UserScript==
(function() {
    'use strict';

    // 工具函数
    const Utils = {
        /**
         * 格式化价格显示
         * @param {number} price
         * @returns {string}
         */
        formatPrice(price) {
            if (price >= 1e9) return (price / 1e9).toFixed(2) + 'B';
            if (price >= 1e6) return (price / 1e6).toFixed(2) + 'M';
            if (price >= 1e3) return (price / 1e3).toFixed(2) + 'K';
            return price.toFixed(2);
        },

        /**
         * 格式化日期
         * @param {Date} date
         * @returns {string}
         */
        formatDate(date) {
            const now = new Date();
            const diff = date - now;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            
            if (hours > 24) return date.toLocaleDateString();
            if (hours > 0) return `${hours}小时${minutes}分钟`;
            if (minutes > 0) return `${minutes}分钟`;
            return '即将溢出';
        }
    };

    // 任务生成器 - 核心逻辑
    const TaskGenerator = new class {
        actionTypeList = ['milking', 'foraging', 'woodcutting', 'cheesesmithing',
            'crafting', 'tailoring', 'cooking', 'brewing', 'combat'];

        taskInfo = {};

        constructor() {
            this.initTaskInfo();
        }

        initTaskInfo() {
            // 从游戏客户端数据初始化任务信息
            const clientData = ClientData.get?.() || window.clientData;
            if (!clientData?.actionDetailMap) return;

            for (let hrid in clientData.actionDetailMap) {
                const actionType = hrid.split('/')[2];
                const info = this.getTaskInfo(actionType, hrid);
                if (!info) continue;
                (this.taskInfo[actionType] ??= {})[hrid] = info;
            }
        }

        getTaskInfo(actionType, hrid) {
            // 简化版本：返回基本的任务信息结构
            // 实际使用时需要从游戏数据中获取
            return {
                actionType: actionType,
                actionHrid: hrid,
                minLevel: 1,
                weight: 1,
                goalCount: 100,
                rewards: { coin: 1000, taskToken: 10 }
            };
        }

        getActionWeight(actionType, level) {
            if (actionType !== 'combat') return level + 50;
            return 3 * level + 300;
        }

        /**
         * 获取任务生成信息
         * @param {{ [actionType: string]: number }} skillLevel - 各技能等级
         * @param {string[]} blockList - 被阻止的任务类型列表
         * @returns {Array} 任务信息数组
         */
        getTaskGenerationInfo(skillLevel, blockList) {
            const actionTypeList = this.actionTypeList.filter(name => 
                !blockList.some(blockName => name === blockName)
            );
            
            const actionWeightTotal = actionTypeList.reduce((pre, cur) => 
                pre + this.getActionWeight(cur, skillLevel[cur]), 0
            );
            
            const actionWeight = {};
            actionTypeList.forEach(name => { 
                actionWeight[name] = this.getActionWeight(name, skillLevel[name]) / actionWeightTotal 
            });
            
            let ret = [];
            for (let [skill, weight] of Object.entries(actionWeight)) {
                const level = skillLevel[skill];
                const choices = Object.entries(this.taskInfo[skill])
                    .filter(([_, info]) => level >= info.minLevel);
                
                const totalWeight = choices.reduce((pre, cur) => pre + cur[1].weight, 0);
                choices.forEach(([_, info]) => {
                    const w = weight * info.weight / totalWeight;
                    ret.push({ ...info, weight: w });
                });
            }
            return ret;
        }
    };

    // 任务分析器 - 核心功能
    const TaskAnalyzer = new class {
        /**
         * 计算完成任务需要的战斗波数
         * @param {Object} task - 任务对象
         * @returns {{ total: number, rest: number }} total: 总波数，rest: 剩余波数
         */
        computeCombatTaskWaves(task) {
            if (!task.monsterHrid || !BattleData?.monsterInfo) {
                return { total: task.goalCount || 0, rest: (task.goalCount || 0) - (task.currentCount || 0) };
            }

            const monsterHrid = task.monsterHrid;
            const info = BattleData.monsterInfo[task.monsterHrid];
            
            if (!info || !BattleData.mapData) {
                return { total: task.goalCount || 0, rest: (task.goalCount || 0) - (task.currentCount || 0) };
            }

            const mapHrid = info.mapHrid;
            const spawnInfo = BattleData.mapData[mapHrid]?.spawnInfo;
            
            if (!spawnInfo) {
                return { total: task.goalCount || 0, rest: (task.goalCount || 0) - (task.currentCount || 0) };
            }

            const spawns = spawnInfo.expectedSpawns;
            const bossWave = spawnInfo.bossWave || 0;

            const compute = (count) => {
                if (spawns && spawns[monsterHrid]) {
                    const normalCount = Math.ceil(count / spawns[monsterHrid]);
                    const bossCount = bossWave ? Math.floor((normalCount - 1) / (bossWave - 1)) : 0;
                    return normalCount + bossCount;
                }
                return count * (bossWave || 1);
            };

            return {
                total: compute(task.goalCount || 0),
                rest: compute((task.goalCount || 0) - (task.currentCount || 0))
            };
        }

        /**
         * 计算每个地图分别需要打多少波怪完成所有任务
         * @param {Map<number, Task>} tasks - 任务列表
         * @returns {Object<string, { total: number, rest: number }>} key: 地图 Hrid, value: {total, rest}
         */
        computeAllCombatTaskWaves(tasks = TaskData.tasks) {
            /** @type {Object<string, Object<string,{ total: number, rest: number }>>} */
            const grouped = {};
            
            if (!tasks) return {};

            tasks.forEach(task => {
                if (task.type !== 'monster' || !task.monsterHrid) return;
                
                const info = BattleData.monsterInfo?.[task.monsterHrid];
                if (!info) return;
                
                const mapHrid = info.mapHrid;
                const current = this.computeCombatTaskWaves(task);
                
                (grouped[mapHrid] ??= {})[task.monsterHrid] ??= { total: 0, rest: 0 };
                grouped[mapHrid][task.monsterHrid].total += current.total;
                grouped[mapHrid][task.monsterHrid].rest += current.rest;
            });

            /** @type {Object<string, { total: number, rest: number }>} */
            const ret = {};
            for (const key in grouped) {
                ret[key] = Object.values(grouped[key]).reduce((pre, cur) => {
                    return {
                        total: Math.max(pre.total, cur.total),
                        rest: Math.max(pre.rest, cur.rest),
                    };
                }, { total: 0, rest: 0 });
            }
            return ret;
        }

        /**
         * 计算任务溢出时间
         * @returns {Date}
         */
        computeOverflowDate() {
            const charaInfo = TaskData.charaInfo;
            if (!charaInfo) return new Date();

            const currentTaskCount = TaskData.tasks?.size || 0;
            const taskCooldown = charaInfo.taskCooldownHours * 3.6e6;
            const taskCount = (charaInfo.unreadTaskCount || 0) + currentTaskCount;
            const availTaskCount = (charaInfo.taskSlotCap || 10) - taskCount;
            const lastTaskDate = new Date(charaInfo.lastTaskTimestamp).getTime();
            
            const overflowDate = new Date(lastTaskDate + (availTaskCount + 1) * taskCooldown);
            return overflowDate;
        }

        /**
         * 获取任务期望奖励
         * @param {{ [actionType: string]: number }} skillLevel - 各技能等级
         * @param {string[]} blockList - 被阻止的任务类型列表
         * @returns {{ coin: number, taskToken: number, price: number }}
         */
        getTaskExpectedRewards(skillLevel, blockList) {
            const ret = { coin: 0, taskToken: 0, price: 0 };
            const taskInfo = TaskGenerator.getTaskGenerationInfo(skillLevel, blockList);
            
            for (let info of taskInfo) {
                ret.coin += info.weight * info.rewards.coin;
                ret.taskToken += info.weight * info.rewards.taskToken;
            }
            
            // 计算任务代币价值
            const taskTokenPrice = (Market.getPriceByName?.("Task Token") || 0) + 
                                   (Market.getPriceByName?.("Purple's Gift") || 0) / 50;
            
            ret.price = ret.coin + ret.taskToken * taskTokenPrice;
            return ret;
        }

        /**
         * 打印完整统计信息到控制台
         * @param {{ [actionType: string]: number }} skillLevel
         * @param {string[]} blockList
         */
        printFullStatistics(skillLevel, blockList) {
            const rewards = this.getTaskExpectedRewards(skillLevel, blockList);
            const overflowDate = this.computeOverflowDate();
            const mapRunCount = this.computeAllCombatTaskWaves();

            console.log('%c[任务统计]%c', 'color: green; font-weight: bold', 'color: black');
            console.log(`  任务溢出时间：${Utils.formatDate(overflowDate)}`);
            console.log(`  期望奖励:`);
            console.log(`    - 总价值：${Utils.formatPrice(rewards.price)}`);
            console.log(`    - 金币：${Utils.formatPrice(rewards.coin)}`);
            console.log(`    - 任务代币：${rewards.taskToken.toFixed(2)}`);
            console.log(`  期望战斗次数:`);
            
            Object.entries(mapRunCount).forEach(([hrid, cnt]) => {
                const mapIndex = BattleData.mapData?.[hrid]?.info?.mapIndex || '?';
                console.log(`    - 图 ${mapIndex}: ${cnt.total} 次 (剩 ${cnt.rest} 次)`);
            });
        }
    };

    // UI 组件（可选）
    const TaskAnalyzerUi = new class {
        constructor() {
            this.panelVisible = false;
            this.panelElement = null;
            this.updateInterval = null;
        }

        /**
         * 创建小型悬浮 UI 面板
         */
        createMiniPanel() {
            if (this.panelElement) return;

            const panel = document.createElement('div');
            panel.className = 'lll_taskAnalyzer_mini_panel';
            panel.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: rgba(0, 0, 0, 0.9);
                border: 2px solid #4CAF50;
                border-radius: 8px;
                padding: 12px;
                z-index: 9999;
                color: white;
                min-width: 280px;
                max-width: 350px;
                font-size: 13px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            `;

            // 标题栏
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                padding-bottom: 8px;
                border-bottom: 1px solid #4CAF50;
            `;
            
            const title = document.createElement('span');
            title.textContent = '📊 任务统计';
            title.style.cssText = 'font-weight: bold; color: #4CAF50;';
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: #ff6b6b;
                cursor: pointer;
                font-size: 18px;
                padding: 0;
                width: 24px;
                height: 24px;
                line-height: 1;
            `;
            closeBtn.onmouseover = () => closeBtn.style.color = '#ff5252';
            closeBtn.onmouseout = () => closeBtn.style.color = '#ff6b6b';
            closeBtn.onclick = () => this.hidePanel();
            
            header.appendChild(title);
            header.appendChild(closeBtn);
            panel.appendChild(header);

            // 内容区域
            const content = document.createElement('div');
            content.id = 'lll_taskAnalyzer_content';
            content.style.cssText = 'line-height: 1.6;';
            panel.appendChild(content);

            document.body.appendChild(panel);
            this.panelElement = panel;

            // 初始更新内容
            this.updatePanelContent();
            
            // 每 5 秒自动更新一次数据
            this.startAutoUpdate();
        }

        /**
         * 更新面板内容
         */
        updatePanelContent() {
            const contentDiv = document.getElementById('lll_taskAnalyzer_content');
            if (!contentDiv) return;

            const overflowDate = TaskAnalyzer.computeOverflowDate();
            const mapRunCount = [];
            
            Object.entries(TaskAnalyzer.computeAllCombatTaskWaves()).forEach(([hrid, cnt]) => {
                if (BattleData?.mapData?.[hrid]?.info?.mapIndex) {
                    mapRunCount.push([BattleData.mapData[hrid].info.mapIndex, cnt]);
                }
            });
            mapRunCount.sort((a, b) => a[0] - b[0]);
            
            const rewards = TaskAnalyzer.getTaskExpectedRewards(
                CharacterData.skillLevel || {}, 
                TaskData.blockedTypes || []
            );

            let html = '';
            
            // 期望奖励部分
            html += `<div style="margin-bottom: 10px; padding: 8px; background: rgba(76, 175, 80, 0.1); border-radius: 4px;">
                <div style="color: #4CAF50; font-weight: bold; margin-bottom: 5px;">💰 期望奖励</div>
                <div style="padding-left: 10px;">
                    <div>总价值：<span style="color: #FFD700; font-weight: bold;">${Utils.formatPrice(rewards.price)}</span></div>
                    <div>金币：<span style="color: #FFA500;">${Utils.formatPrice(rewards.coin)}</span></div>
                    <div>任务代币：<span style="color: #DDA0DD;">${rewards.taskToken.toFixed(2)}</span></div>
                </div>
            </div>`;
            
            // 任务溢出时间
            html += `<div style="margin-bottom: 10px; padding: 5px 8px; background: rgba(255, 193, 7, 0.1); border-radius: 4px;">
                <div style="color: #FFC107; font-weight: bold; margin-bottom: 3px;">⏰ 任务溢出时间</div>
                <div style="padding-left: 10px; color: #FFE082;">${Utils.formatDate(overflowDate)}</div>
            </div>`;
            
            // 期望战斗次数部分
            if (mapRunCount.length > 0) {
                html += `<div style="padding: 8px; background: rgba(33, 150, 243, 0.1); border-radius: 4px;">
                    <div style="color: #2196F3; font-weight: bold; margin-bottom: 5px;">⚔️ 期望战斗次数</div>
                    <div style="padding-left: 10px;">`;
                
                mapRunCount.forEach(([id, cnt]) => {
                    html += `<div style="margin-bottom: 3px;">
                        <span style="color: #64B5F6;">图 ${id}:</span>
                        <span style="color: #BBDEFB;">${cnt.total} 次</span>
                        <span style="color: #90CAF9; font-size: 12px;">(剩 ${cnt.rest} 次)</span>
                    </div>`;
                });
                
                html += `</div></div>`;
            }

            contentDiv.innerHTML = html;
        }

        /**
         * 启动自动更新
         */
        startAutoUpdate() {
            if (this.updateInterval) return;
            
            this.updateInterval = setInterval(() => {
                if (this.panelVisible && this.panelElement) {
                    this.updatePanelContent();
                }
            }, 5000); // 每 5 秒更新一次
        }

        /**
         * 停止自动更新
         */
        stopAutoUpdate() {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
        }

        /**
         * 显示面板
         */
        showPanel() {
            if (!this.panelElement) {
                this.createMiniPanel();
            }
            if (this.panelElement) {
                this.panelElement.style.display = 'block';
                this.panelVisible = true;
                this.startAutoUpdate();
            }
        }

        /**
         * 隐藏面板
         */
        hidePanel() {
            if (this.panelElement) {
                this.panelElement.style.display = 'none';
                this.panelVisible = false;
                this.stopAutoUpdate();
            }
        }

        /**
         * 切换面板显示状态
         */
        togglePanel() {
            if (this.panelVisible) {
                this.hidePanel();
            } else {
                this.showPanel();
            }
        }

        /**
         * 添加按钮到游戏界面
         */
        addButton() {
            // 尝试找到游戏的标签容器
            const tabsContainer = document.querySelector('.TabsComponent_tabsContainer__3BDUp');
            if (!tabsContainer) return;
            
            const referenceTab = tabsContainer.children[1];
            if (!referenceTab) return;
            
            if (tabsContainer.querySelector('.lll_btn_taskAnalyzer')) return;
            
            const baseClassName = referenceTab.className;
            let button = document.createElement('div');
            button.className = baseClassName + ' lll_btn_taskAnalyzer';
            button.textContent = '📊 任务';
            button.title = '点击查看任务期望奖励和战斗次数统计';
            
            button.onclick = () => this.togglePanel();
            
            const lastTab = tabsContainer.children[tabsContainer.children.length - 1];
            tabsContainer.insertBefore(button, lastTab.nextSibling);
            
            console.log('%c[任务统计面板已加载]%c 点击 "📊 任务" 标签查看详细信息', 
                'color: blue; font-weight: bold', 'color: black');
        }
    };

    // 导出到全局作用域
    window.TaskExpectedRewards = {
        analyzer: TaskAnalyzer,
        generator: TaskGenerator,
        utils: Utils,
        ui: TaskAnalyzerUi,
        
        /**
         * 快捷方法：获取当前角色的任务期望奖励
         * @returns {{ coin: number, taskToken: number, price: number }}
         */
        getCurrentExpectedRewards() {
            const skillLevel = CharacterData.skillLevel || {};
            const blockedTypes = TaskData.blockedTypes || [];
            return TaskAnalyzer.getTaskExpectedRewards(skillLevel, blockedTypes);
        },

        /**
         * 快捷方法：获取当前角色的期望战斗次数
         * @returns {Object<string, { total: number, rest: number }>}
         */
        getCurrentExpectedEpochs() {
            return TaskAnalyzer.computeAllCombatTaskWaves();
        },

        /**
         * 快捷方法：打印完整统计信息
         */
        printFullStatistics() {
            const skillLevel = CharacterData.skillLevel || {};
            const blockedTypes = TaskData.blockedTypes || [];
            TaskAnalyzer.printFullStatistics(skillLevel, blockedTypes);
        },

        /**
         * 快捷方法：显示/隐藏 UI 面板
         */
        togglePanel() {
            TaskAnalyzerUi.togglePanel();
        },

        /**
         * 快捷方法：显示 UI 面板
         */
        showPanel() {
            TaskAnalyzerUi.showPanel();
        },

        /**
         * 快捷方法：隐藏 UI 面板
         */
        hidePanel() {
            TaskAnalyzerUi.hidePanel();
        }
    };

    // 自动添加 UI 按钮
    setTimeout(() => {
        TaskAnalyzerUi.addButton();
    }, 2000);

    console.log('%c[任务期望计算器已加载]%c', 
        'color: blue; font-weight: bold', 'color: black');
    console.log('使用方法:');
    console.log('  - 点击 "📊 任务统计" 按钮查看 UI 面板');
    console.log('  - 控制台调用: TaskExpectedRewards.printFullStatistics()');
    console.log('  - 获取期望奖励: TaskExpectedRewards.getCurrentExpectedRewards()');
    console.log('  - 获取期望次数: TaskExpectedRewards.getCurrentExpectedEpochs()');

})();
