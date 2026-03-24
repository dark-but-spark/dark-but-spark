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

    // 调试输出函数
    const dbg = console.log.bind(null, '%c[任务统计]%c', 'color:green', 'color:black');
    const out = console.log.bind(null, '%c[任务统计]%c', 'color:green', 'color:black');

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

    // UI 辅助函数（简化版）
    const Ui = {
        div(className, content) {
            const div = document.createElement('div');
            if (className) div.className = className;
            if (content) {
                if (typeof content === 'string') div.innerHTML = content;
                else if (Array.isArray(content)) content.forEach(c => div.appendChild(c));
                else div.appendChild(content);
            }
            return div;
        }
    };

    // Tooltip 辅助函数（简化版）
    const Tooltip = {
        attach(element, description) {
            element.title = typeof description === 'string' ? description : '';
            element.style.cursor = 'help';
        },
        description(title, content) {
            return content;
        }
    };

    // 语言配置
    const isCN = !['en'].some(lang => localStorage.getItem("i18nextLng")?.toLowerCase()?.startsWith(lang));
    let language = isCN ? 'zh' : 'en';

    // UI 文本配置（你选中的部分）
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

    // TaskGenerator - 任务生成器（完整版）
    const TaskGenerator = new class {
        actionTypeList = ['milking', 'foraging', 'woodcutting', 'cheesesmithing',
            'crafting', 'tailoring', 'cooking', 'brewing', 'combat'];

        taskInfo = {};

        // 数据表（从原始脚本提取）
        gatheringGoalCountTable = {
            1: 90.4,
            10: 219.9,
            20: 274.9,
            35: 474.7,
            50: 774.4,
            65: 1113.3,
            80: 1454.6,
        };
        
        productionGoalCountTable = {
            'Cheese Boots': 11.666666666666666,
            'Cheese Gauntlets': 11.5,
            'Cheese Sword': 5.333333333333333,
            'Cheese Brush': 9.11111111111111,
            'Cheese Hatchet': 8.833333333333334,
            'Cheese Shears': 9.428571428571429,
            'Cheese Spear': 8.875,
            'Cheese Chisel': 13.75,
            'Cheese Hammer': 14.272727272727273,
            'Cheese Needle': 14,
            'Cheese Pot': 14.714285714285714,
            'Cheese Spatula': 14.875,
            'Cheese Mace': 13.2,
            'Cheese Alembic': 20.333333333333332,
            'Cheese Buckler': 24.6,
            'Cheese Enhancer': 20.88888888888889,
            'Cheese Helmet': 27.571428571428573,
            'Cheese Bulwark': 13.222222222222221,
            'Cheese Plate Legs': 26.5,
            'Cheese Plate Body': 28.4,
            'Verdant Boots': 12.5,
            'Verdant Gauntlets': 13.9,
            'Verdant Sword': 5.454545454545454,
            'Verdant Brush': 8,
            'Verdant Hatchet': 8,
            'Verdant Shears': 8.571428571428571,
            'Verdant Spear': 7.125,
            'Verdant Chisel': 9.9,
            'Verdant Hammer': 9.76923076923077,
            'Verdant Needle': 9.6,
            'Verdant Pot': 9.8,
            'Verdant Spatula': 9.714285714285714,
            'Verdant Mace': 8.571428571428571,
            'Verdant Alembic': 11.5,
            'Verdant Buckler': 13.5,
            'Verdant Enhancer': 12,
            'Verdant Helmet': 16.6,
            'Verdant Bulwark': 7.769230769230769,
            'Verdant Plate Legs': 13.833333333333334,
            'Verdant Plate Body': 13.88888888888889,
        };

        brewingGoalCountTable = {}; // 需要从游戏数据初始化

        constructor() {
            setTimeout(() => this.initTaskInfo(), 1000);
        }

        initTaskInfo() {
            const clientData = window.ClientData?.get?.() || window.clientData;
            if (!clientData?.actionDetailMap) {
                console.warn('[任务统计] 客户端数据未准备好，稍后重试...');
                setTimeout(() => this.initTaskInfo(), 1000);
                return;
            }

            // 初始化酿造目标数量表
            this.initBrewingGoalCountTable(clientData);

            for (let hrid in clientData.actionDetailMap) {
                const actionType = hrid.split('/')[2];
                const info = this.getTaskInfo(actionType, hrid);
                if (!info) continue;
                (this.taskInfo[actionType] ??= {})[hrid] = info;
            }
            out('任务生成信息已初始化');
        }

        initBrewingGoalCountTable(clientData) {
            // 根据游戏中的配方数据初始化酿造任务的目标数量
            const recipeMap = clientData?.recipeMap || {};
            for (const hrid in recipeMap) {
                const recipe = recipeMap[hrid];
                if (recipe.actionType === 'brewing' && recipe.outputItem) {
                    const itemName = recipe.outputItem.name;
                    // 简单估算：基于输出数量和复杂度
                    this.brewingGoalCountTable[itemName] = 100;
                }
            }
        }

        matchFilter(name, filters) {
            for (let i = 0; i < filters.length; i++) {
                if (typeof filters[i] === 'function' && filters[i](name)) {
                    return i;
                }
                if (filters[i] === 'otherwise') {
                    return i;
                }
            }
            return filters.length - 1;
        }

        getGatheringTaskInfo(detail) {
            const level = detail.levelRequirement.level;
            return {
                weight: 1,
                goalCount: this.gatheringGoalCountTable[level],
                taskToken: 0.1 * level + 2,
                coin: Math.pow(level + 20, 2.4),
            };
        }

        getCheesesmithingTaskInfo(detail) {
            const name = detail.name;
            const filters = [
                name => name.endsWith('Cheese'),
                name => name.includes('Cheese') || name.includes('Verdant') || name.includes('Azure') || name.includes('Burble')
                    || name.includes('Crimson') || name.includes('Rainbow') || name.includes('Holy'),
                'otherwise',
            ];
            const rarity = this.matchFilter(name, filters);
            const level = detail.levelRequirement.level;
            if (rarity === 0) return this.getGatheringTaskInfo(detail);
            if (rarity === 2) return {
                weight: 1 / 42,
                goalCount: 1,
                taskToken: 0.2 * level + 4,
                coin: Math.pow(1.34 * level + 26.5, 2.4),
            };
            return {
                weight: 0.1,
                goalCount: this.productionGoalCountTable[name] || 10,
                taskToken: 0.1 * level + 2,
                coin: Math.pow(level + 20, 2.4),
            };
        }

        getCraftingTaskInfo(detail) {
            const name = detail.name;
            if (name.includes('Task Badge') || name.includes('Key')) return null;
            const filters = [
                name => name.includes('Lumber'),
                name => name.includes('Wooden') || name.includes('Birch') || name.includes('Cedar') || name.includes('Purpleheart')
                    || name.includes('Ginkgo') || name.includes('Redwood') || name.includes('Arcane'),
                'otherwise',
            ];
            const rarity = this.matchFilter(name, filters);
            const level = detail.levelRequirement.level;
            if (rarity === 0) return this.getGatheringTaskInfo(detail);
            if (rarity === 2) return {
                weight: 0.07,
                goalCount: 1,
                taskToken: 0.2 * level + 4,
                coin: Math.pow(1.34 * level + 26.5, 2.4),
            }
            return {
                weight: 1 / 3,
                goalCount: this.productionGoalCountTable[name] || 10,
                taskToken: 0.1 * level + 2,
                coin: Math.pow(level + 20, 2.4),
            };
        }

        getTailoringTaskInfo(detail) {
            const name = detail.name;
            const filters = [
                name => name.includes('Leather') || name.includes('Fabric'),
                name => name.includes('Cotton') || name.includes('Linen') || name.includes('Bamboo') || name.includes('Silk') || name.includes('Radiant')
                    || name.includes('Rough') || name.includes('Reptile') || name.includes('Gobo') || name.includes('Beast') || name.includes('Umbral'),
                'otherwise',
            ];
            const rarity = this.matchFilter(name, filters);
            const level = detail.levelRequirement.level;
            if (rarity === 0) return {
                weight: 1,
                goalCount: {
                    1: 96.2,
                    15: 256.1,
                    35: 490.4,
                    55: 852.5,
                    75: 1447.0,
                }[level] || 100,
                taskToken: 0.1 * level + 2,
                coin: Math.pow(level + 20, 2.4),
            }
            if (rarity === 2) return {
                weight: 5 / 58,
                goalCount: 1,
                taskToken: 0.2 * level + 4,
                coin: Math.pow(1.34 * level + 26.5, 2.4),
            }
            return {
                weight: 0.4,
                goalCount: this.productionGoalCountTable[name] || 10,
                taskToken: 0.1 * level + 2,
                coin: Math.pow(level + 20, 2.4),
            };
        }

        getCookingTaskInfo(detail) {
            const level = detail.levelRequirement.level;
            return {
                weight: 1,
                goalCount: {
                    1: 76.2,
                    10: 188.2,
                    20: 225.4,
                    35: 392.1,
                    50: 649.6,
                    65: 1110.3,
                    80: 1526.0,
                }[level] || 100,
                taskToken: 0.1 * level + 2,
                coin: Math.pow(level + 20, 2.4),
            };
        }

        getBrewingTaskInfo(detail) {
            const name = detail.name;
            const filters = [
                name => !name.includes('Super') && !name.includes('Ultra'),
                'otherwise'
            ];
            const rarity = this.matchFilter(name, filters);
            const level = detail.levelRequirement.level;
            if (rarity === 0) return {
                weight: 1,
                goalCount: this.brewingGoalCountTable[name] || 100,
                taskToken: 0.1 * level + 2,
                coin: Math.pow(level + 20, 2.4),
            };
            return {
                weight: 0.1,
                goalCount: this.brewingGoalCountTable[name] || 100,
                taskToken: 0.2 * level + 4,
                coin: Math.pow(1.34 * level + 26.5, 2.4),
            };
        }

        getCombatTaskInfo(detail) {
            const battleData = window.BattleData;
            if (!battleData?.mapData?.[detail.hrid]) return null;
            
            const mapData = battleData.mapData[detail.hrid];
            if (mapData.info.eliteTier >= 1) return null;
            
            if (mapData.info.type === 'group') {
                const id = Math.min(mapData.info.mapIndex, 6) - 2;
                if (id < 0) return null;
                const hrid = Object.keys(mapData.bossDrops || {})[0];
                const monsterDetail = window.ClientData?.get?.()?.combatMonsterDetailMap?.[hrid];
                const level = monsterDetail?.combatDetails?.combatLevel || 50;
                return {
                    weight: 1 / 60,
                    monsterLevel: level,
                    goalCount: [5, 6.3, 8.6, 9.4, 10][id] || 10,
                    taskToken: [10, 12.5, 17, 18.5, 20][id] || 20,
                    coin: [25653, 60834, 138242, 170250, 216800][id] || 200000,
                };
            }
            const hrid = Object.keys(mapData.monsterDrops || {})[0];
            const monsterDetail = window.ClientData?.get?.()?.combatMonsterDetailMap?.[hrid];
            const level = monsterDetail?.combatDetails?.combatLevel || 50;
            return {
                weight: 1,
                monsterLevel: level,
                goalCount: 0.5 * level + 50,
                taskToken: 0.036 * level + 2.78,
                coin: Math.pow(0.4 * level + 20, 2.4),
            };
        }

        getTaskInfo(actionType, actionHrid) {
            const clientData = window.ClientData?.get?.() || window.clientData;
            if (!clientData?.actionDetailMap?.[actionHrid]) return null;
            
            const detail = clientData.actionDetailMap[actionHrid];
            const formatTaskInfo = info => {
                if (!info) return null;
                let level;
                if (actionType === 'combat') {
                    level = Math.min(Math.ceil(Math.pow(info.monsterLevel, 0.862)), 90);
                } else level = detail.levelRequirement?.level || 1;
                
                return {
                    actionType: actionType,
                    actionHrid: detail.hrid,
                    minLevel: level,
                    weight: info.weight,
                    goalCount: info.goalCount,
                    rewards: {
                        taskToken: info.taskToken,
                        coin: info.coin,
                    },
                };
            };
            
            switch (actionType) {
                case 'milking': return formatTaskInfo(this.getGatheringTaskInfo(detail));
                case 'foraging': return formatTaskInfo(this.getGatheringTaskInfo(detail));
                case 'woodcutting': return formatTaskInfo(this.getGatheringTaskInfo(detail));
                case 'cheesesmithing': return formatTaskInfo(this.getCheesesmithingTaskInfo(detail));
                case 'crafting': return formatTaskInfo(this.getCraftingTaskInfo(detail));
                case 'tailoring': return formatTaskInfo(this.getTailoringTaskInfo(detail));
                case 'cooking': return formatTaskInfo(this.getCookingTaskInfo(detail));
                case 'brewing': return formatTaskInfo(this.getBrewingTaskInfo(detail));
                case 'combat': return formatTaskInfo(this.getCombatTaskInfo(detail));
                default: return null;
            }
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
                const choices = Object.entries(this.taskInfo[skill] || {})
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
            const charaInfo = window.TaskData?.charaInfo;
            if (!charaInfo) return new Date();

            const currentTaskCount = window.TaskData?.tasks?.size || 0;
            const taskCooldown = charaInfo.taskCooldownHours * 3.6e6;
            const taskCount = (charaInfo.unreadTaskCount || 0) + currentTaskCount;
            const availTaskCount = (charaInfo.taskSlotCap || 10) - taskCount;
            const lastTaskDate = new Date(charaInfo.lastTaskTimestamp).getTime();
            
            const overflowDate = new Date(lastTaskDate + (availTaskCount + 1) * taskCooldown);
            return overflowDate;
        }

        computeCombatTaskWaves(task) {
            if (!task.monsterHrid) {
                return { 
                    total: task.goalCount || 0, 
                    rest: (task.goalCount || 0) - (task.currentCount || 0) 
                };
            }

            const battleData = window.BattleData;
            if (!battleData?.monsterInfo?.[task.monsterHrid]) {
                return { 
                    total: task.goalCount || 0, 
                    rest: (task.goalCount || 0) - (task.currentCount || 0) 
                };
            }

            const info = battleData.monsterInfo[task.monsterHrid];
            const mapData = battleData.mapData?.[info.mapHrid];
            
            if (!mapData?.spawnInfo) {
                return { 
                    total: task.goalCount || 0, 
                    rest: (task.goalCount || 0) - (task.currentCount || 0) 
                };
            }

            const spawns = mapData.spawnInfo.expectedSpawns;
            const bossWave = mapData.spawnInfo.bossWave || 0;

            const compute = (count) => {
                if (spawns && spawns[task.monsterHrid]) {
                    const normalCount = Math.ceil(count / spawns[task.monsterHrid]);
                    const bossCount = bossWave ? Math.floor((normalCount - 1) / (bossWave - 1)) : 0;
                    return normalCount + bossCount;
                }
                return count * (bossWave || 1);
            };

            return {
                total: compute(task.goalCount),
                rest: compute(task.goalCount - task.currentCount),
            };
        }

        computeAllCombatTaskWaves(tasks) {
            if (!tasks) tasks = window.TaskData?.tasks;
            if (!tasks) return {};

            const grouped = {};
            tasks.forEach(task => {
                if (task.type !== 'monster' || !task.monsterHrid) return;
                
                const info = window.BattleData?.monsterInfo?.[task.monsterHrid];
                if (!info) return;
                
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

        getTaskExpectedRewards(skillLevel, blockList) {
            const ret = { coin: 0, taskToken: 0, price: 0 };
            const taskInfo = TaskGenerator.getTaskGenerationInfo(skillLevel, blockList);
            
            for (let info of taskInfo) {
                ret.coin += info.weight * info.rewards.coin;
                ret.taskToken += info.weight * info.rewards.taskToken;
            }
            
            // 计算任务代币价值
            const market = window.Market;
            const taskTokenPrice = (market?.getPriceByName?.("Task Token") || 0) + 
                                   (market?.getPriceByName?.("Purple's Gift") || 0) / 50;
            
            ret.price = ret.coin + ret.taskToken * taskTokenPrice;
            return ret;
        }
    };

    // TaskAnalyzerUi - UI 组件
    const TaskAnalyzerUi = new class {
        constructor() {
            setInterval(() => { this.addButton(); }, 500);
        }

        constructTooltip() {
            const locale = UiLocale.taskAnalyzer.tooltip;

            const overflowDate = TaskAnalyzer.computeOverflowDate();
            const mapRunCount = [];
            
            Object.entries(TaskAnalyzer.computeAllCombatTaskWaves()).forEach(([hrid, cnt]) => {
                const mapIndex = window.BattleData?.mapData?.[hrid]?.info?.mapIndex;
                if (mapIndex) {
                    mapRunCount.push([mapIndex, cnt]);
                }
            });
            mapRunCount.sort((a, b) => a[0] - b[0]);
            
            const rewards = TaskAnalyzer.getTaskExpectedRewards(
                window.CharacterData?.skillLevel || {}, 
                window.TaskData?.blockedTypes || []
            );

            const descDiv = Ui.div(null, [
                Ui.div(null, `${locale.overflowTime[language]}: ${Utils.formatDate(overflowDate)}`),
                Ui.div(null, locale.expectedRewards[language](
                    Utils.formatPrice(rewards.price), 
                    Utils.formatPrice(rewards.coin), 
                    rewards.taskToken.toFixed(2)
                )),
                Ui.div(null, `${locale.expectedEpochs[language]}:`)
            ]);
            
            mapRunCount.forEach(([id, cnt]) => {
                descDiv.appendChild(Ui.div(null, locale.mapRunCount[language](id, cnt.total, cnt.rest)));
            });
            
            return descDiv;
        }

        addButton() {
            var tabsContainer = document.querySelector('.TabsComponent_tabsContainer__3BDUp');
            if (!tabsContainer) return;
            
            var referenceTab = tabsContainer.children[1];
            if (!referenceTab) return;
            
            if (tabsContainer.querySelector('.lll_btn_taskAnalyzer')) return;
            
            const baseClassName = referenceTab.className;
            let button = document.createElement('div');
            button.className = baseClassName + ' lll_btn_taskAnalyzer';
            button.setAttribute('script_translatedfrom', 'New Action');
            button.textContent = UiLocale.taskAnalyzer.btnLabel[language];
            
            const tooltip = this.constructTooltip();
            Tooltip.attach(button, Tooltip.description(
                UiLocale.taskAnalyzer.tooltip.tabLabel[language], 
                tooltip
            ));

            let lastTab = tabsContainer.children[tabsContainer.children.length - 1];
            tabsContainer.insertBefore(button, lastTab.nextSibling);
            
            out('任务统计按钮已添加');
        }
    };

    // 导出到全局作用域
    window.TaskStatistics = {
        generator: TaskGenerator,
        analyzer: TaskAnalyzer,
        utils: Utils,
        
        getCurrentExpectedRewards() {
            return TaskAnalyzer.getTaskExpectedRewards(
                window.CharacterData?.skillLevel || {}, 
                window.TaskData?.blockedTypes || []
            );
        },

        getCurrentExpectedEpochs() {
            return TaskAnalyzer.computeAllCombatTaskWaves();
        },

        printStatistics() {
            const rewards = this.getCurrentExpectedRewards();
            const epochs = this.getCurrentExpectedEpochs();
            const overflowDate = TaskAnalyzer.computeOverflowDate();

            console.log('%c[任务统计]%c', 'color: green; font-weight: bold', 'color: black');
            console.log(`  任务溢出时间：${Utils.formatDate(overflowDate)}`);
            console.log(`  期望奖励:`);
            console.log(`    - 总价值：${Utils.formatPrice(rewards.price)}`);
            console.log(`    - 金币：${Utils.formatPrice(rewards.coin)}`);
            console.log(`    - 任务代币：${rewards.taskToken.toFixed(2)}`);
            console.log(`  期望战斗次数:`);
            
            Object.entries(epochs).forEach(([hrid, cnt]) => {
                const mapIndex = window.BattleData?.mapData?.[hrid]?.info?.mapIndex || '?';
                console.log(`    - 图 ${mapIndex}: ${cnt.total} 次 (剩 ${cnt.rest} 次)`);
            });
        }
    };

    // 初始化 UI
    new TaskAnalyzerUi();

    console.log('%c[任务期望统计已加载]%c', 
        'color: blue; font-weight: bold', 'color: black');
    console.log('使用方法:');
    console.log('  - 点击 "统计" 按钮查看工具提示');
    console.log('  - 控制台调用：TaskStatistics.printStatistics()');
    console.log('  - 获取期望奖励：TaskStatistics.getCurrentExpectedRewards()');
    console.log('  - 获取期望次数：TaskStatistics.getCurrentExpectedEpochs()');

})();
