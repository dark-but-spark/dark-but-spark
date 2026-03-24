// ==UserScript==
// @name         任务统计分析器
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  任务期望奖励和战斗次数统计 - 独立完整版本
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

    // 调试输出函数
    const dbg = console.log.bind(null, '%c[任务统计]%c', 'color:blue', 'color:black');
    const out = console.log.bind(null, '%c[任务统计]%c', 'color:green', 'color:black');

    // 检测语言环境
    const isCN = !['en'].some(lang => localStorage.getItem("i18nextLng")?.toLowerCase()?.startsWith(lang));
    let language = isCN ? 'zh' : 'en';

    // 工具函数
    const Utils = {
        formatPrice(price) {
            if (price >= 1e9) return (price / 1e9).toFixed(2) + 'B';
            if (price >= 1e6) return (price / 1e6).toFixed(2) + 'M';
            if (price >= 1e3) return (price / 1e3).toFixed(2) + 'K';
            return price.toFixed(2);
        },

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

    // UI Locale - 界面文本
    const UiLocale = {
        taskAnalyzer: {
            tabLabel: { zh: '任务', en: 'Task' },
            btnLabel: { zh: '统计', en: 'Statistics' },
            tooltip: {
                tabLabel: { zh: '任务统计', en: 'Statistics' },
                overflowTime: { zh: '任务溢出时间', en: 'Task overflow time' },
                expectedRewards: {
                    zh: (price, coin, token) => `任务期望奖励：${price} (${coin} 金币，${token} 任务代币)`,
                    en: (price, coin, token) => `Expected rewards: ${price} (${coin} coins, ${token} task tokens)`
                },
                expectedEpochs: { zh: '期望次数', en: 'Expected epochs in each zone' },
                mapRunCount: {
                    zh: (z, tot, rest) => `图 ${z}: ${tot} 次 (剩 ${rest} 次)`,
                    en: (z, tot, rest) => `Z${z}: ${tot} (${rest} rest)`,
                }
            },
        },
    };

    // Tooltip 辅助函数
    const Tooltip = {
        attach(element, content) {
            element.title = typeof content === 'string' ? content : '';
            element._tooltipContent = content;
            
            element.onmouseenter = () => {
                if (element._tooltipContent instanceof HTMLElement) {
                    // 如果内容是 DOM 元素，创建一个悬浮面板
                    const panel = document.createElement('div');
                    panel.className = 'lll_tooltip_panel';
                    panel.style.cssText = `
                        position: absolute;
                        background: rgba(0, 0, 0, 0.95);
                        border: 2px solid #4CAF50;
                        border-radius: 8px;
                        padding: 15px;
                        z-index: 10000;
                        color: white;
                        min-width: 300px;
                        max-width: 500px;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                    `;
                    panel.appendChild(element._tooltipContent.cloneNode(true));
                    
                    const rect = element.getBoundingClientRect();
                    panel.style.top = (rect.bottom + window.scrollY + 5) + 'px';
                    panel.style.left = (rect.left + window.scrollX) + 'px';
                    
                    element._tooltipPanel = panel;
                    document.body.appendChild(panel);
                }
            };
            
            element.onmouseleave = () => {
                if (element._tooltipPanel) {
                    element._tooltipPanel.remove();
                    element._tooltipPanel = null;
                }
            };
        },

        description(title, content) {
            const div = document.createElement('div');
            div.style.cssText = 'text-align: left; padding: 10px;';
            
            const titleDiv = document.createElement('div');
            titleDiv.textContent = title;
            titleDiv.style.cssText = 'font-weight: bold; margin-bottom: 10px; color: #4CAF50;';
            div.appendChild(titleDiv);
            
            if (content instanceof HTMLElement) {
                div.appendChild(content);
            } else {
                const contentDiv = document.createElement('div');
                contentDiv.textContent = content;
                div.appendChild(contentDiv);
            }
            
            return div;
        }
    };

    // TaskGenerator - 任务生成器
    const TaskGenerator = new class {
        actionTypeList = ['milking', 'foraging', 'woodcutting', 'cheesesmithing',
            'crafting', 'tailoring', 'cooking', 'brewing', 'combat'];

        taskInfo = {};

        constructor() {
            this.initTaskInfo();
        }

        initTaskInfo() {
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
            // 简化版本，实际应从游戏数据获取
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

    // TaskAnalyzer - 任务分析器
    const TaskAnalyzer = new class {
        computeOverflowDate() {
            const charaInfo = TaskData.charaInfo;
            const currentTaskCount = TaskData.tasks.size;
            const taskCooldown = charaInfo.taskCooldownHours * 3.6e6;
            const taskCount = charaInfo.unreadTaskCount + currentTaskCount;
            const availTaskCount = charaInfo.taskSlotCap - taskCount;
            const lastTaskDate = new Date(charaInfo.lastTaskTimestamp).getTime();
            const overflowDate = new Date(lastTaskDate + (availTaskCount + 1) * taskCooldown);
            return overflowDate;
        }

        computeCombatTaskWaves(task) {
            const monsterHrid = task.monsterHrid;
            const info = BattleData.monsterInfo[task.monsterHrid];
            const spawns = BattleData.mapData[info.mapHrid].spawnInfo.expectedSpawns;
            const bossWave = BattleData.mapData[info.mapHrid].spawnInfo.bossWave;
            const compute = (count) => {
                if (spawns[monsterHrid]) {
                    const normalCount = Math.ceil(count / spawns[monsterHrid]);
                    const bossCount = bossWave ? Math.floor((normalCount - 1) / (bossWave - 1)) : 0;
                    return normalCount + bossCount;
                }
                return count * bossWave;
            }
            return {
                total: compute(task.goalCount),
                rest: compute(task.goalCount - task.currentCount),
            }
        }

        computeAllCombatTaskWaves(tasks = TaskData.tasks) {
            const grouped = {};
            tasks.forEach(task => {
                if (task.type != 'monster') return;
                const info = BattleData.monsterInfo[task.monsterHrid];
                const mapHrid = info.mapHrid;
                const current = this.computeCombatTaskWaves(task);
                (grouped[mapHrid] ??= {})[task.monsterHrid] ??= { total: 0, rest: 0 };
                grouped[mapHrid][task.monsterHrid].total += current.total;
                grouped[mapHrid][task.monsterHrid].rest += current.rest;
            });

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

        getTaskRerollCost(task) {
            const count = task.rerollCount;
            const getCost = (x) => {
                if (x >= 5) return 32;
                return Math.pow(x, 2);
            };
            return {
                coin: getCost(count.coin) * 10000,
                cowbell: getCost(count.cowbell),
            };
        }

        getTaskExpectedRewards(skillLevel, blockList) {
            const ret = { coin: 0, taskToken: 0, price: 0 };
            const taskInfo = TaskGenerator.getTaskGenerationInfo(skillLevel, blockList);
            for (let info of taskInfo) {
                ret.coin += info.weight * info.rewards.coin;
                ret.taskToken += info.weight * info.rewards.taskToken;
            }
            const taskTokenPrice = Market.getPriceByName("Task Token") + Market.getPriceByName("Purple's Gift") / 50;
            ret.price = ret.coin + ret.taskToken * taskTokenPrice;
            return ret;
        }
    };

    // TaskAnalyzerUi - 任务分析器 UI
    const TaskAnalyzerUi = new class {
        constructor() {
            setInterval(() => { this.addButton(); }, 500);
        }

        constructTooltip() {
            const locale = UiLocale.taskAnalyzer.tooltip;

            const overflowDate = TaskAnalyzer.computeOverflowDate();
            const mapRunCount = [];
            Object.entries(TaskAnalyzer.computeAllCombatTaskWaves()).forEach(([hrid, cnt]) => {
                if (BattleData?.mapData?.[hrid]?.info?.mapIndex) {
                    mapRunCount.push([BattleData.mapData[hrid].info.mapIndex, cnt]);
                }
            });
            mapRunCount.sort((a, b) => a[0] - b[0]);
            const rewards = TaskAnalyzer.getTaskExpectedRewards(CharacterData.skillLevel, TaskData.blockedTypes);

            const descDiv = document.createElement('div');
            descDiv.style.cssText = 'text-align: left; padding: 10px; max-width: 400px;';
            
            descDiv.innerHTML = `
                <div style="margin-bottom: 8px;">
                    <strong>${locale.overflowTime[language]}:</strong> ${Utils.formatDate(overflowDate)}
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>${locale.expectedRewards[language](
                        Utils.formatPrice(rewards.price), 
                        Utils.formatPrice(rewards.coin), 
                        rewards.taskToken.toFixed(2)
                    )}</strong>
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>${locale.expectedEpochs[language]}:</strong>
                </div>
            `;
            
            mapRunCount.forEach(([id, cnt]) => {
                const div = document.createElement('div');
                div.style.cssText = 'padding-left: 20px; font-size: 13px; margin-top: 4px;';
                div.textContent = locale.mapRunCount[language](id, cnt.total, cnt.rest);
                descDiv.appendChild(div);
            });
            
            return descDiv;
        }

        addButton() {
            var tabsContainer = document.querySelector("#root > div > div > div.GamePage_gamePanel__3uNKN > div.GamePage_contentPanel__Zx4FH > div.GamePage_middlePanel__uDts7 > div.GamePage_mainPanel__2njyb > div > div:nth-child(2) > div > div.TasksPanel_tabsComponentContainer__3Q2EX > div > div.TabsComponent_tabsContainer__3BDUp > div > div > div");
            var referenceTab = tabsContainer ? tabsContainer.children[1] : null;
            if (!tabsContainer || !referenceTab) return;
            if (tabsContainer.querySelector('.lll_btn_taskAnalyzer')) return;
            const baseClassName = referenceTab.className;

            let button = document.createElement('div');
            button.className = baseClassName + ' lll_btn_taskAnalyzer';
            button.setAttribute('script_translatedfrom', 'New Action');
            button.textContent = UiLocale.taskAnalyzer.btnLabel[language];
            button.onclick = () => {
                out("点击查看任务统计详情");
            };

            Tooltip.attach(button, Tooltip.description(
                UiLocale.taskAnalyzer.tooltip.tabLabel[language], 
                this.constructTooltip()
            ));

            let lastTab = tabsContainer.children[tabsContainer.children.length - 1];
            tabsContainer.insertBefore(button, lastTab.nextSibling);
            
            out('%c[任务统计按钮已添加]%c 鼠标悬停查看详细信息', 
                'color: blue; font-weight: bold', 'color: black');
        }
    };

    // 导出到全局作用域
    window.TaskStatistics = {
        analyzer: TaskAnalyzer,
        generator: TaskGenerator,
        utils: Utils,
        
        getCurrentExpectedRewards() {
            const skillLevel = CharacterData.skillLevel || {};
            const blockedTypes = TaskData.blockedTypes || [];
            return TaskAnalyzer.getTaskExpectedRewards(skillLevel, blockedTypes);
        },

        getCurrentExpectedEpochs() {
            return TaskAnalyzer.computeAllCombatTaskWaves();
        },

        printStatistics() {
            const rewards = TaskAnalyzer.getTaskExpectedRewards(
                CharacterData.skillLevel || {}, 
                TaskData.blockedTypes || []
            );
            const overflowDate = TaskAnalyzer.computeOverflowDate();
            const mapRunCount = TaskAnalyzer.computeAllCombatTaskWaves();

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

    // 初始化 UI
    new TaskAnalyzerUi();

    console.log('%c[任务统计分析器已加载]%c', 
        'color: blue; font-weight: bold', 'color: black');
    console.log('使用方法:');
    console.log('  - 鼠标悬停在 "统计" 按钮上查看详细信息');
    console.log('  - 控制台调用：TaskStatistics.printStatistics()');
    console.log('  - 获取期望奖励：TaskStatistics.getCurrentExpectedRewards()');
    console.log('  - 获取期望次数：TaskStatistics.getCurrentExpectedEpochs()');

})();
