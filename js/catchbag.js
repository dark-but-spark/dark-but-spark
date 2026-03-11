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
    console.log('%c[抓包器] 已启动，正在监听所有 WebSocket 发送/接收包...', 'color: #00ff00; font-weight: bold;');

    const OriginalWebSocket = window.WebSocket;

    // 简单解码器（字符串 / ArrayBuffer / Blob）
    function tryDecode(data) {
        try {
            if (typeof data === 'string') return data;
            if (data instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(data));
            if (data instanceof Blob) {
                // Blob 需要异步读取，先返回占位文本并在 Promise 完成后再 log 完整内容
                data.text().then(t => console.log('%c[Blob 解码 - async]', 'color:#aaf', t));
                return '[Blob] - decoding asynchronously';
            }
            return data;
        } catch (e) {
            return `[decode error] ${e && e.message}`;
        }
    }

    // 替换全局 WebSocket 构造函数，拦截每个实例的 send 与 message
    function ProxyWebSocket(url, protocols) {
        const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);

        // 拦截 send（发出 -> 服务器）
        const originalSend = ws.send.bind(ws);
        ws.send = function(data) {
            try {
                const decoded = tryDecode(data);
                console.group('%c[WS SEND]', 'color:#00aaff; font-weight:bold; background:#111; padding:4px;');
                console.log('📡 URL:', url);
                console.log('🔸 Raw (outgoing):', data);
                console.log('🔍 Decoded:', decoded);
                console.groupEnd();
            } catch (e) {
                console.error('[WS SEND] decode error', e);
            }
            return originalSend(data);
        };

        // 拦截 addEventListener，包装 message 回调（服务器 -> 我）
        const origAddEventListener = ws.addEventListener.bind(ws);
        ws.addEventListener = function(type, listener, options) {
            if (type === 'message') {
                const wrapped = function(event) {
                    try {
                        const d = event.data;
                        if (typeof d === 'string') {
                            console.group('%c[WS RECV]', 'color:#00ff66; font-weight:bold; background:#111; padding:4px;');
                            console.log('📡 URL:', url);
                            console.log('🔸 Raw (incoming string):', d);
                            console.groupEnd();
                        } else if (d instanceof ArrayBuffer) {
                            const dec = new TextDecoder().decode(new Uint8Array(d));
                            console.group('%c[WS RECV]', 'color:#00ff66; font-weight:bold; background:#111; padding:4px;');
                            console.log('📡 URL:', url);
                            console.log('🔸 Raw (ArrayBuffer):', d);
                            console.log('🔍 Decoded:', dec);
                            console.groupEnd();
                        } else if (d instanceof Blob) {
                            console.group('%c[WS RECV]', 'color:#00ff66; font-weight:bold; background:#111; padding:4px;');
                            console.log('📡 URL:', url);
                            console.log('🔸 Raw (Blob):', d);
                            d.text().then(t => console.log('🔍 Blob Decoded (async):', t));
                            console.groupEnd();
                        } else {
                            console.group('%c[WS RECV]', 'color:#00ff66; font-weight:bold; background:#111; padding:4px;');
                            console.log('📡 URL:', url);
                            console.log('🔸 Raw (unknown):', d);
                            console.groupEnd();
                        }
                    } catch (e) {
                        console.error('[WS RECV] decode error', e);
                    }
                    return listener.apply(this, arguments);
                };
                return origAddEventListener(type, wrapped, options);
            }
            return origAddEventListener(type, listener, options);
        };

        // 支持设置 onmessage（常见用法），通过定义实例属性来包装回调
        Object.defineProperty(ws, 'onmessage', {
            get() { return this._onmessage || null; },
            set(fn) {
                if (this._onmessage_wrapped) {
                    this.removeEventListener('message', this._onmessage_wrapped);
                    this._onmessage_wrapped = null;
                }
                this._onmessage = fn;
                if (typeof fn === 'function') {
                    const wrapped = function(event) {
                        try {
                            const d = event.data;
                            if (typeof d === 'string') {
                                console.group('%c[WS RECV]', 'color:#00ff66; font-weight:bold; background:#111; padding:4px;');
                                console.log('📡 URL:', url);
                                console.log('🔸 Raw (incoming string):', d);
                                console.groupEnd();
                            } else if (d instanceof ArrayBuffer) {
                                const dec = new TextDecoder().decode(new Uint8Array(d));
                                console.group('%c[WS RECV]', 'color:#00ff66; font-weight:bold; background:#111; padding:4px;');
                                console.log('📡 URL:', url);
                                console.log('🔸 Raw (ArrayBuffer):', d);
                                console.log('🔍 Decoded:', dec);
                                console.groupEnd();
                            } else if (d instanceof Blob) {
                                console.group('%c[WS RECV]', 'color:#00ff66; font-weight:bold; background:#111; padding:4px;');
                                console.log('📡 URL:', url);
                                console.log('🔸 Raw (Blob):', d);
                                d.text().then(t => console.log('🔍 Blob Decoded (async):', t));
                                console.groupEnd();
                            } else {
                                console.group('%c[WS RECV]', 'color:#00ff66; font-weight:bold; background:#111; padding:4px;');
                                console.log('📡 URL:', url);
                                console.log('🔸 Raw (unknown):', d);
                                console.groupEnd();
                            }
                        } catch (e) {
                            console.error('[WS RECV] decode error', e);
                        }
                        return fn.apply(this, arguments);
                    };
                    this._onmessage_wrapped = wrapped;
                    this.addEventListener('message', wrapped);
                }
            },
            configurable: true
        });

        return ws;
    }

    // 保持原生静态属性
    ProxyWebSocket.prototype = OriginalWebSocket.prototype;
    ProxyWebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
    ProxyWebSocket.OPEN = OriginalWebSocket.OPEN;
    ProxyWebSocket.CLOSING = OriginalWebSocket.CLOSING;
    ProxyWebSocket.CLOSED = OriginalWebSocket.CLOSED;

    window.WebSocket = ProxyWebSocket;
})();