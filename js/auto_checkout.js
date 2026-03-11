// ==UserScript==
// @name           MWI 自动倾家荡产
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动完成结账流程
// @author       dark-but-spark
// @match        https://test.milkywayidle.com/*
// @match        https://test.milkywayidlecn.com/*
// @match        https://checkout.stripe.com/c/pay/cs_test*
// @grant        none
// @license MIT
// @run-at       document-start
// ==/UserScript==
 
// 自动化结账脚本 — 在结账页面的控制台中粘贴运行
(async function(){
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

  // 持续监测数量选择器，当按钮出现时触发自动化流程（带运行锁）
  const targetSelector = 'button[data-testid="line-item-adjustable-qty"], button.AdjustableQuantitySelector';
  const clickElement = (el) => {
    if (!el) return false;
    try {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    } catch (e) {
      try { el.click(); return true; } catch (e) { return false; }
    }
  };

  // 更积极的“继续” modal 检测：MutationObserver + 轮询，带去重与日志
  (function aggressiveContinueDetector() {
    const clicked = new WeakSet();
    const isVisible = (el) => {
      if (!el) return false;
      try {
        const s = window.getComputedStyle(el);
        return s && s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null && !el.disabled;
      } catch (e) { return false; }
    };

    function tryDetect() {
      try {
        // 1) 找到可能包含“继续购买”文字的容器
        const containers = Array.from(document.querySelectorAll('div')).filter(d => (d.innerText||'').includes('继续购买') || (d.innerText||'').includes('继续'));
        for (const c of containers) {
          if (clicked.has(c)) continue;
          // 在容器内查找按钮文本包含“继续”的可见按钮
          const btns = Array.from(c.querySelectorAll('button'));
          for (const b of btns) {
            const txt = (b.innerText||'').trim();
            if (/继续/.test(txt) && isVisible(b)) {
              console.log('aggressiveDetector: 找到继续按钮，尝试点击，文本=', txt);
              if (clickElement(b)) {
                clicked.add(c);
                return true;
              }
            }
          }
        }

        // 2) 全局范围查找严格文本为“继续”的可见按钮
        const global = Array.from(document.querySelectorAll('button'));
        for (const b of global) {
          const txt = (b.innerText||'').trim();
          if (/^继续$/.test(txt) && isVisible(b)) {
            const p = b.closest('div') || b;
            if (clicked.has(p)) continue;
            console.log('aggressiveDetector: 全局找到继续按钮，尝试点击');
            if (clickElement(b)) { clicked.add(p); return true; }
          }
        }
      } catch (e) {
        console.warn('aggressiveDetector error', e);
      }
      return false;
    }

    // MutationObserver：记录新增节点并尝试检测
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          // 尝试立即检测
          if (tryDetect()) return;
        }
      }
    });
    obs.observe(document.documentElement || document.body, { childList: true, subtree: true });

    // 定时轮询作为补充（每 700ms，长期运行但轻量），在脚本卸载前持续运行
    const iv = setInterval(() => { tryDetect(); }, 700);
    // 避免内存泄漏：在页面卸载时清理
    window.addEventListener('beforeunload', () => { obs.disconnect(); clearInterval(iv); });
  })();

  let running = false;

  async function automate(triggerBtn) {
    // 防止并发运行
    if (running) return;
    running = true;
    try {
      const qtyBtn = triggerBtn || await waitFor(targetSelector, 10000);

      // 确保 modal 打开 — 重试点击最多 3 次
      clickElement(qtyBtn);
      let modalOpen = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await waitFor('.AdjustQuantityModal-modal, .ModalContent.AdjustQuantityModal-modal, .Modal-Portal', 2000);
          modalOpen = true;
          break;
        } catch (e) {
          console.warn('modal 未出现，重试点击量选择器', attempt+1);
          clickElement(qtyBtn);
          await new Promise(r => setTimeout(r, 500));
        }
      }
      if (!modalOpen) console.warn('未检测到弹窗；后续将尝试在全局查找输入框');

      // 以下为原自动化逻辑（在 modal 内设置数量、更新并提交）
      await waitFor('.AdjustQuantityModal-modal, .ModalContent.AdjustQuantityModal-modal, .Modal-Portal', 10000).catch(() => null);
      // 优先在弹窗内查找输入框
      let qtyInput = null;
      const modalSelectors = [
        '.AdjustQuantityModal-modal input#adjustQuantity',
        '.AdjustQuantityModal-modal input[name="adjustQuantity"]',
        '.ModalContent input#adjustQuantity',
        '.ModalContent input[name="adjustQuantity"]'
      ];
      for (const sel of modalSelectors) {
        try {
          qtyInput = await waitFor(sel, 3000);
          if (qtyInput) break;
        } catch (e) {
          // ignore and try next
        }
      }
      // 回退到全局查找
      if (!qtyInput) qtyInput = await waitFor('#adjustQuantity, input[name="adjustQuantity"]', 10000);
      qtyInput.focus();
      // 使用原生 setter 更新值（React / 框架友好），并派发 input 事件
      const setNativeValue = (el, value) => {
        const proto = Object.getPrototypeOf(el);
        const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (valueSetter) {
          valueSetter.call(el, String(value));
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      };

      let applied = false;
      try {
        applied = setNativeValue(qtyInput, '99');
      } catch (e) { applied = false; }
      // 回退：逐字符模拟输入（更慢但更可靠）
      if (!applied) {
        console.warn('原生 setter 无效，使用逐字符输入回退');
        qtyInput.value = '';
        const chars = String('99').split('');
        for (const ch of chars) {
          qtyInput.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
          qtyInput.value = qtyInput.value + ch;
          qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
          qtyInput.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true }));
          await new Promise(r => setTimeout(r, 80));
        }
        qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      qtyInput.blur();
      console.log('已尝试设置输入值；applied=', applied, 'current=', qtyInput.value);

      // 3) 点击“更新”按钮
      let updateBtn = null;
      try {
        updateBtn = await waitFor('.AdjustQuantityFooter-btn[type="submit"], .AdjustQuantityFooter button[type="submit"]', 10000);
      } catch (e) {
        updateBtn = document.querySelector('.AdjustQuantityFooter-btn[type="submit"], .AdjustQuantityFooter button[type="submit"]');
      }
      if (!updateBtn) throw new Error('未找到“更新”按钮');
      updateBtn.click();

      // 等待数量真实生效：等待输入框消失或值变为 '99'，或数量按钮文本反映 99
      function waitUntil(predicate, timeout = 10000, interval = 200) {
        return new Promise((resolve, reject) => {
          const start = Date.now();
          (function check() {
            try {
              if (predicate()) return resolve(true);
            } catch (e) {}
            if (Date.now() - start > timeout) return reject(new Error('waitUntil timeout'));
            setTimeout(check, interval);
          })();
        });
      }

      await waitUntil(() => {
        const input = document.querySelector('#adjustQuantity') || document.querySelector('input[name="adjustQuantity"]');
        if (!input) return true; // modal closed
        if (input.value === '99') return true; // value applied
        const btn = document.querySelector('button[data-testid="line-item-adjustable-qty"], button.AdjustableQuantitySelector');
        if (btn && /99/.test(btn.innerText)) return true;
        return false;
      }, 10000).catch(() => console.warn('等待数量更新超时，继续下一步'));

      // 小幅延迟，保证 UI 完全更新
      await new Promise(r => setTimeout(r, 500));

      // 4) 等待并点击“支付 / 提交”按钮（确认可见且未被禁用）
      async function waitForVisible(selector, timeout = 15000) {
        const el = await waitFor(selector, timeout);
        await waitUntil(() => {
          try {
            const s = window.getComputedStyle(el);
            const visible = s && s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null && !el.disabled;
            return visible;
          } catch (e) { return false; }
        }, timeout);
        return el;
      }

      const submitBtn = await waitForVisible('button[data-testid="hosted-payment-submit-button"], .SubmitButton.SubmitButton--complete, .ConfirmPaymentButton--SubmitButton button[type="submit"]', 15000).catch(() => null);
      if (!submitBtn) throw new Error('未找到或不可见的提交按钮');
      submitBtn.click();

      console.log('已点击提交，检查是否需要选择支付方式或处理错误');

      // 如果出现支付方式选择器或错误提示，选择卡号包含 4242 的项并重试提交
      try {
        await waitUntil(() => {
          return document.querySelector('.AccordionError-message') || document.querySelector('.Picker') || document.querySelector('.PickerItem') || document.querySelector('.LinkRedactedCardNumberDetails');
        }, 5000);
      } catch (e) {
        // 未检测到选择器或错误，继续
      }

      // 如果有错误提示，记录信息
      const errMsg = document.querySelector('.AccordionError-message');
      if (errMsg) console.warn('支付错误提示:', errMsg.innerText.trim());

      // 尝试选择卡片（查找包含 4242 或 •••• 4242 的文本）
      const findCardAndSelect = () => {
        const items = Array.from(document.querySelectorAll('.PickerItem, .PickerItem-container, .LinkRedactedCardNumber'));
        for (const it of items) {
          try {
            const text = it.innerText || '';
            if (/4242/.test(text) || /••••\s*4242/.test(text)) {
              clickElement(it);
              console.log('已选择支付卡：', text.trim());
              return true;
            }
          } catch (e) {}
        }
        return false;
      };

      let cardSelected = false;
      try {
        // 等待 picker 出现并尝试选择
        await waitFor('.Picker, .PickerItem, .LinkRedactedCardNumber', 4000).then(() => {
          cardSelected = findCardAndSelect();
        }).catch(() => {
          cardSelected = findCardAndSelect();
        });
      } catch (e) { cardSelected = false; }

      if (cardSelected) {
        // 等待重新出现提交按钮并可见后点击
        try {
          const submitAgain = await waitForVisible('button[data-testid="hosted-payment-submit-button"], .SubmitButton.SubmitButton--complete, .ConfirmPaymentButton--SubmitButton button[type="submit"]', 10000);
          submitAgain.click();
          console.log('已选择卡并再次点击提交');
        } catch (e) {
          console.warn('未能在选择卡后找到提交按钮进行重试', e);
        }
      }

      // 有些站点在点击支付后会弹出一个“继续购买”的自定义 modal（打开支付处理器的新窗口）
      // 我们短等待并尝试点击该 modal 内的“继续”按钮；同时安装一个短期 observer 以防稍后出现
      (async function handleExternalContinueModal() {
        const continueSelectors = [
          '.Modal_modal__1Jiep',
          '.CowbellStorePanel_modalContent__1JNWg',
        ];
        const buttonSelectors = [
          '.CowbellStorePanel_modalContent__1JNWg button',
          'button.Button_button__1Fe9z.Button_success__6d6kU',
        ];

        const isVisible = (el) => {
          if (!el) return false;
          try {
            const s = window.getComputedStyle(el);
            return s && s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null && !el.disabled;
          } catch (e) { return false; }
        };

        const tryClickContinue = () => {
          // 1) 优先通过已知选择器寻找按钮
          for (const sel of buttonSelectors) {
            const btn = document.querySelector(sel);
            if (btn && isVisible(btn)) {
              try { clickElement(btn); console.log('已自动点击外部支付 modal 的继续按钮 (selector)', sel); return true; } catch (e) { console.warn('点击 continue 按钮失败', e); }
            }
          }

          // 2) 在可能的 modal 容器范围内查找按钮文本包含“继续”的按钮
          const modals = Array.from(document.querySelectorAll(continueSelectors.join(',')));
          for (const modal of modals) {
            const buttons = Array.from(modal.querySelectorAll('button'));
            for (const b of buttons) {
              const txt = (b.innerText || '').trim();
              if (/继续/.test(txt) && isVisible(b)) {
                try { clickElement(b); console.log('已自动点击外部支付 modal 的继续按钮 (text)', txt); return true; } catch (e) { console.warn('点击 continue 文本按钮失败', e); }
              }
            }
          }

          // 3) 全局范围内查找任意文本为“继续”的可见按钮
          const globalBtns = Array.from(document.querySelectorAll('button'));
          for (const b of globalBtns) {
            const txt = (b.innerText || '').trim();
            if (/^继续$/.test(txt) && isVisible(b)) {
              try { clickElement(b); console.log('已在全局找到并点击继续按钮'); return true; } catch (e) { console.warn('全局点击 continue 失败', e); }
            }
          }

          return false;
        };

        // 先快速尝试
        try {
          await waitFor(continueSelectors.join(','), 2000);
          if (tryClickContinue()) return;
        } catch (e) {}

        // 安装短期 observer，监听 15s
        const obs = new MutationObserver((mutations, observer) => {
          if (tryClickContinue()) {
            observer.disconnect();
          }
        });
        obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
        // 自动断开 observer，避免长期运行
        setTimeout(() => obs.disconnect(), 15000);
      })();

      console.log('自动化操作完成：尝试提交并处理支付选择。');
    } catch (err) {
      console.error('自动化操作失败：', err);
    } finally {
      running = false;
    }
  }

  // 观察整个文档，持续等待目标按钮出现并触发自动化（不会重复并发运行）
  const observer = new MutationObserver(() => {
    if (running) return;
    const btn = document.querySelector(targetSelector);
    if (btn) automate(btn);
  });
  observer.observe(document.documentElement || document.body, { childList: true, subtree: true });

  // 立即检查一次（页面中已存在按钮时）
  const existing = document.querySelector(targetSelector);
  if (existing) automate(existing);
})();
