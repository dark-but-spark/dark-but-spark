import requests
import json
import time
import hashlib
import os

# 配置
URL = "https://www.milkywayidle.com/game_data/marketplace.json"
LOCAL_FILE = "marketplace.json"
INTERVAL = 60*10  # 检查间隔（秒）
DATA = "DATA.txt"

# 存储上次内容的哈希值
last_hash = None

def get_json_hash(data):
    """计算 JSON 内容的哈希值，用于检测变化"""
    serialized = json.dumps(data, sort_keys=True, separators=(',', ':'))
    return hashlib.md5(serialized.encode('utf-8')).hexdigest()

def fetch_json(url):
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"请求失败: {e}")
        return None

def save_json(data, filename):
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"已保存更新的 JSON 到 {filename}")
    except IOError as e:
        print(f"保存文件失败: {e}")

# 主循环
print(f"开始监控: {URL}")

while True:
    data = fetch_json(URL)
    if data is not None:
        current_hash = get_json_hash(data)
        if last_hash is None:
            # 首次运行
            last_hash = current_hash
            save_json(data, LOCAL_FILE)
            with open(LOCAL_FILE, 'r', encoding='utf-8') as f:
                content = json.load(f)
            timestamp = content.get("timestamp")
            if timestamp:
                with open(DATA, 'a', encoding='utf-8') as f:
                    f.write(f"{timestamp}\n")
        elif current_hash != last_hash:
            print("检测到 JSON 发生变化！")
            save_json(data, LOCAL_FILE)
            with open(LOCAL_FILE, 'r', encoding='utf-8') as f:
                content = json.load(f)
            timestamp = content.get("timestamp")
            if timestamp:
                with open(DATA, 'a', encoding='utf-8') as f:
                    f.write(f"{timestamp}\n")
            last_hash = current_hash
        else:
            print("JSON 未发生变化，跳过保存。")
    else:
        print("未能获取数据，跳过本次检查。")

    # 等待下一次检查
    time.sleep(INTERVAL)