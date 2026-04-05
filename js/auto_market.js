(function() {
    const TARGET_TAB = '牛铃商店'; // 一级目标：牛铃商店标签
    const SUB_TARGET = '购买牛铃'; // 二级目标：购买牛铃 tab（如果未自动选中）
    let lastClickTime = 0;
    const CLICK_COOLDOWN = 1000;
    let hasClickedMainTab = false; // 是否已点击主标签
    let debugMode = true;

    function log(message, type = 'info') {
        if (!debugMode) return;
        const prefix = '[Auto Market]';
        const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warn' ? '⚠️' : 'ℹ️';
        console.log(`${prefix} ${icon} ${message}`);
    }

    function closeOfflineModal() {
        log('🔍 检查是否需要关闭离线奖励弹窗...');
        
        // 查找离线奖励弹窗
        const offlineModal = document.querySelector('.OfflineProgressModal_modal__2W5xv');
        if (offlineModal) {
            log('检测到离线奖励弹窗', 'warn');
            
            // 策略 1: 点击"关闭"按钮
            const closeButton = offlineModal.querySelector('button.Button_button__1Fe9z');
            if (closeButton && closeButton.textContent.trim() === '关闭') {
                log('点击"关闭"按钮...', 'success');
                closeButton.click();
                return true;
            }
            
            // 策略 2: 点击右上角 X 按钮
            const xCloseButton = offlineModal.querySelector('.OfflineProgressModal_closeButton__3g3Y2');
            if (xCloseButton) {
                log('点击右上角 X 按钮...', 'success');
                xCloseButton.click();
                return true;
            }
            
            // 策略 3: 任意位置点击（作为最后手段）
            log('使用策略 3：点击弹窗任意位置...', 'warn');
            offlineModal.click();
            return true;
        }
        
        log('无需关闭离线奖励弹窗');
        return false;
    }

    function analyzePageElements() {
        log('=== 📊 开始分析页面元素 ===');
        
        // 0. 检查离线奖励弹窗
        const offlineModal = document.querySelector('.OfflineProgressModal_modal__2W5xv');
        if (offlineModal) {
            log('⚠️ 离线奖励弹窗存在，需要先关闭', 'warn');
            const modalText = offlineModal.querySelector('.OfflineProgressModal_header__3HqPY');
            if (modalText) {
                log(`弹窗标题："${modalText.textContent.trim()}"`);
            }
        } else {
            log('✅ 无离线奖励弹窗阻挡');
        }
        
        // 1. 查找所有 tab 按钮
        const tabButtons = document.querySelectorAll('button[role="tab"]');
        log(`找到 ${tabButtons.length} 个 tab 按钮`);
        
        tabButtons.forEach((btn, index) => {
            const text = btn.textContent.trim();
            const isSelected = btn.classList.contains('Mui-selected') || btn.getAttribute('aria-selected') === 'true';
            const hasStorePanel = btn.closest('.CowbellStorePanel_tabsComponentContainer__PeY9P') !== null;
            log(`Tab #${index + 1}: "${text}" - ${isSelected ? '【已选中】' : '未选中'} ${hasStorePanel ? '(牛铃商店内)' : '(主导航)'}`);
        });

        // 2. 检查牛铃商店容器是否存在
        const storeContainers = document.querySelectorAll('.CowbellStorePanel_buyCowbellsTab__3TZNk, .CowbellStorePanel_mooPassTab__2Wy-7, .CowbellStorePanel_upgradesTab__g3WOG');
        log(`找到 ${storeContainers.length} 个牛铃商店子面板`);
        
        if (storeContainers.length > 0) {
            log('✅ 牛铃商店已打开', 'success');
            // 检查哪个子 tab 是激活的
            storeContainers.forEach((container, idx) => {
                const isVisible = !container.classList.contains('TabPanel_hidden__26UM3');
                log(`子面板 #${idx + 1} (${container.className.split(' ').find(c => c.includes('Tab__'))}): ${isVisible ? '【可见】' : '隐藏'}`);
            });
        } else {
            log('⚠️ 牛铃商店尚未打开', 'warn');
        }

        log('=== 页面元素分析完成 ===\n');
    }

    function findAndClickMainTab() {
        log('🔍 查找主标签："牛铃商店"...');
        
        // 策略 1: 在左侧导航栏中查找"牛铃商店"链接
        const navLinks = document.querySelectorAll('.NavigationBar_navigationLink__3eAHA');
        log(`找到 ${navLinks.length} 个导航链接`);
        
        for (const link of navLinks) {
            const label = link.querySelector('.NavigationBar_label__1uH-y');
            if (label && label.textContent.trim() === TARGET_TAB) {
                const isActive = link.classList.contains('NavigationBar_active__3R-QS');
                log(`找到导航链接："${TARGET_TAB}" - ${isActive ? '已激活' : '未激活'}`);
                
                if (!isActive) {
                    log('点击导航链接...', 'success');
                    link.click();
                    return true;
                } else {
                    log('导航链接已是激活状态', 'success');
                    return true;
                }
            }
        }
        
        // 策略 2: 查找包含 aria-label="navigationBar.cowbellStore" 的元素
        const cowbellStoreIcons = document.querySelectorAll('[aria-label="navigationBar.cowbellStore"]');
        if (cowbellStoreIcons.length > 0) {
            log(`找到 ${cowbellStoreIcons.length} 个牛铃商店图标`, 'success');
            // 向上查找最近的导航链接容器
            const parentLink = cowbellStoreIcons[0].closest('.NavigationBar_navigationLink__3eAHA');
            if (parentLink) {
                log('通过 icon 找到导航链接并点击...', 'success');
                parentLink.click();
                return true;
            }
        }
        
        // 策略 3: 遍历所有 button 和可点击元素查找
        const allButtons = document.querySelectorAll('button, div[onclick], a');
        for (const btn of allButtons) {
            const text = btn.textContent.trim();
            if (text === TARGET_TAB || text.includes('牛铃商店')) {
                log(`通过文本找到目标："${text}"`, 'success');
                btn.click();
                return true;
            }
        }
        
        log('未找到"牛铃商店"主标签', 'error');
        return false;
    }

    function checkAndClickSubTab() {
        log('🔍 检查是否需要点击"购买牛铃"子标签...');
        
        // 检查"购买牛铃"tab 是否已激活
        const subTabs = document.querySelectorAll('button[role="tab"]');
        for (const tab of subTabs) {
            const text = tab.textContent.trim();
            if (text === SUB_TARGET) {
                const isSelected = tab.classList.contains('Mui-selected') || tab.getAttribute('aria-selected') === 'true';
                const isInStorePanel = tab.closest('.CowbellStorePanel_tabsComponentContainer__PeY9P') !== null;
                
                if (isInStorePanel) {
                    log(`找到子标签："${text}" - ${isSelected ? '【已选中】' : '未选中'}`, isSelected ? 'success' : 'info');
                    
                    if (!isSelected) {
                        log('点击"购买牛铃"子标签...', 'success');
                        tab.click();
                        return true;
                    }
                    return true; // 已经选中，无需操作
                }
            }
        }
        
        log('未在牛铃商店中找到"购买牛铃"子标签', 'warn');
        return false;
    }

    function attemptClick(force = false) {
        const now = Date.now();
        
        if (now - lastClickTime < CLICK_COOLDOWN && !force) {
            log(`冷却时间中`);
            return false;
        }

        // 步骤 0: 先检查并关闭离线奖励弹窗
        if (closeOfflineModal()) {
            log('已关闭离线奖励弹窗，等待重试...', 'success');
            lastClickTime = now;
            return true;
        }

        // 步骤 1: 检查牛铃商店是否已打开
        const storeContainers = document.querySelectorAll('.CowbellStorePanel_buyCowbellsTab__3TZNk');
        
        if (storeContainers.length === 0) {
            // 牛铃商店未打开，需要点击主标签
            log('牛铃商店未打开，尝试点击主标签...', 'info');
            if (findAndClickMainTab()) {
                hasClickedMainTab = true;
                lastClickTime = now;
                return true;
            }
        } else {
            // 牛铃商店已打开，检查子标签
            log('牛铃商店已打开，检查子标签...', 'info');
            if (checkAndClickSubTab()) {
                lastClickTime = now;
                return true;
            }
        }
        
        return false;
    }

    function init() {
        log('========== 🚀 自动点击脚本初始化 ==========');
        log(`主目标：点击"${TARGET_TAB}"`);
        log(`子目标：确保"${SUB_TARGET}"被选中`);
        log(`调试模式：开启\n`);
        
        // 立即分析并执行
        setTimeout(() => {
            analyzePageElements();
            attemptClick();
        }, 200);

        // 多次重试
        [800, 1500, 3000, 6000].forEach((delay, i) => {
            setTimeout(() => {
                log(`\n⏰ 重试 #${i + 1} (${delay}ms)`);
                analyzePageElements();
                attemptClick(true);
            }, delay);
        });

        // DOM 变化监听
        const observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const el = node;
                            // 检测离线奖励弹窗出现
                            if (el.classList && el.classList.contains('OfflineProgressModal_modal__2W5xv')) {
                                log('🎁 检测到离线奖励弹窗，准备关闭');
                                setTimeout(() => closeOfflineModal(), 100);
                            }
                            // 检测牛铃商店容器出现
                            if (el.classList && (
                                el.classList.contains('CowbellStorePanel_tabsComponentContainer__PeY9P') ||
                                el.classList.contains('CowbellStorePanel_buyCowbellsTab__3TZNk') ||
                                el.querySelector('.CowbellStorePanel_buyCowbellsTab__3TZNk')
                            )) {
                                log('📦 检测到牛铃商店组件加载');
                                shouldCheck = true;
                            }
                        }
                    }
                }
            }
            
            if (shouldCheck) {
                setTimeout(() => {
                    analyzePageElements();
                    checkAndClickSubTab();
                }, 100);
            }
        });

        observer.observe(document, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });

        log('👁️ MutationObserver 已启动');

        // 网络重连监听
        window.addEventListener('online', () => {
            log('🌐 网络重连', 'success');
            hasClickedMainTab = false;
            setTimeout(() => {
                analyzePageElements();
                attemptClick(true);
            }, 500);
        });

        // 定期检查
        setInterval(() => {
            log('\n🔄 定期巡检');
            analyzePageElements();
            attemptClick();
        }, 15000);

        log('\n✅ 初始化完成\n');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();