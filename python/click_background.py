import pyautogui
import time
import threading
import random
from pynput import keyboard
import sys
import os
from datetime import datetime

# Linux 特定配置
# 防止鼠标移动过快导致失控，Linux 下建议设置稍大的暂停
pyautogui.FAILSAFE = True 
pyautogui.PAUSE = 0.1 

class HumanLikeClickSimulator:
    def __init__(self):
        self.is_running = False
        self.base_interval = 3  # 基础点击间隔3秒
        self.interval_variance = 0.5  # 间隔变化范围（秒）
        self.position_variance = 5  # 位置变化范围（像素）
        self.click_position = None
        self.thread = None
        self.click_log = []  # 记录点击历史
        self.last_run_file = os.path.expanduser("~/last_run_linux.txt")  # Linux 主目录下存储
        
    def load_last_run(self):
        """加载上次运行的配置"""
        if os.path.exists(self.last_run_file):
            try:
                with open(self.last_run_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    if len(lines) >= 5:
                        coords = lines[0].strip().split(',')
                        self.click_position = (int(coords[0]), int(coords[1]))
                        self.base_interval = float(lines[1].strip())
                        self.interval_variance = float(lines[2].strip())
                        self.position_variance = float(lines[3].strip())
                        
                        print("✅ 已加载上次运行的配置:")
                        print(f"   - 点击位置: {self.click_position}")
                        print(f"   - 基础间隔: {self.base_interval}s")
                        print(f"   - 间隔偏差: ±{self.interval_variance}s")
                        print(f"   - 位置偏差: ±{self.position_variance}px")
                        return True
            except Exception as e:
                print(f"⚠️ 加载上次运行配置失败: {e}")
        return False
        
    def save_current_config(self):
        """保存当前配置到文件"""
        if self.click_position is None:
            return
        try:
            with open(self.last_run_file, 'w', encoding='utf-8') as f:
                f.write(f"{self.click_position[0]},{self.click_position[1]}\n")
                f.write(f"{self.base_interval}\n")
                f.write(f"{self.interval_variance}\n")
                f.write(f"{self.position_variance}\n")
                f.write(f"Last saved: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        except Exception as e:
            print(f"⚠️ 保存配置失败: {e}")
    
    def set_click_position(self, x=None, y=None):
        """设置点击位置，默认为当前位置"""
        if x is not None and y is not None:
            self.click_position = (x, y)
        else:
            self.click_position = pyautogui.position()
        print(f"📍 点击位置已设置为: {self.click_position}")
        self.save_current_config()
        
    def start_clicking(self):
        """开始后台点击"""
        if self.is_running:
            print("⚠️ 点击已在运行中")
            return
            
        if self.click_position is None:
            print("❌ 请先按 F8 设置点击位置")
            return
            
        self.is_running = True
        print(f"🚀 开始拟人化点击 (Linux版)")
        print(f"   - 目标: {self.click_position} ± {self.position_variance}px")
        print(f"   - 间隔: {self.base_interval} ± {self.interval_variance}s")
        print("💡 提示: 将鼠标移到屏幕左上角可紧急停止 (Fail-safe)")
        
        # 启动后台线程
        self.thread = threading.Thread(target=self._click_loop, daemon=True)
        self.thread.start()
        
    def stop_clicking(self):
        """停止点击"""
        self.is_running = False
        print("🛑 已停止点击")
        
    def _click_loop(self):
        """后台点击循环"""
        while self.is_running:
            try:
                # 记录原始鼠标位置
                original_x, original_y = pyautogui.position()
                
                # 计算带偏差的目标位置
                target_x = self.click_position[0] + random.randint(-self.position_variance, self.position_variance)
                target_y = self.click_position[1] + random.randint(-self.position_variance, self.position_variance)
                
                # 检查边界 (防止超出屏幕)
                screen_w, screen_h = pyautogui.size()
                target_x = max(0, min(target_x, screen_w - 1))
                target_y = max(0, min(target_y, screen_h - 1))
                
                # 模拟人类移动轨迹 (Linux 下可能需要稍慢一点以避免被忽略)
                move_duration = random.uniform(0.15, 0.35)
                pyautogui.moveTo(target_x, target_y, duration=move_duration, tween=pyautogui.easeInOutQuad)
                
                # 随机延迟（模拟思考时间）
                delay_before_click = random.uniform(0.1, 0.5)
                time.sleep(delay_before_click)
                
                # 执行点击
                pyautogui.click()
                
                # 随机点击后延迟
                delay_after_click = random.uniform(0.1, 0.3)
                time.sleep(delay_after_click)
                
                # 移回原始位置
                return_move_duration = random.uniform(0.1, 0.2)
                pyautogui.moveTo(original_x, original_y, duration=return_move_duration, tween=pyautogui.easeInOutQuad)
                
                # 记录点击信息
                click_info = {
                    'time': datetime.now(),
                    'position': (target_x, target_y),
                    'original_pos': (original_x, original_y),
                }
                self.click_log.append(click_info)
                
                # 限制日志内存占用
                if len(self.click_log) > 100:
                    self.click_log.pop(0)
                
                print(f"✅ 点击: ({target_x}, {target_y}) @ {time.strftime('%H:%M:%S')}")
                
                # 计算带偏差的等待时间
                actual_wait_time = max(0.5, self.base_interval + random.uniform(-self.interval_variance, self.interval_variance))
                
                # 分段睡眠以便快速响应停止信号
                sleep_step = 0.5
                elapsed = 0
                while elapsed < actual_wait_time and self.is_running:
                    time.sleep(sleep_step)
                    elapsed += sleep_step
                
            except Exception as e:
                print(f"❌ 点击出错: {e}")
                # Linux 下常见错误是权限或显示服务器问题
                if "Xlib" in str(e) or "display" in str(e).lower():
                    print("💡 提示: 可能是 X11/Wayland 权限问题。请确保安装了 'xdotool' 和 'scrot'。")
                break
                
    def show_click_history(self):
        """显示点击历史"""
        if not self.click_log:
            print("📭 暂无点击历史")
            return
            
        print(f"\n=== 最近 {min(10, len(self.click_log))} 次点击记录 ===")
        for i, record in enumerate(self.click_log[-10:], 1):
            print(f"{i}. {record['time'].strftime('%H:%M:%S')} - 位置({record['position'][0]}, {record['position'][1]})")
            
    def clear_click_history(self):
        """清空点击历史"""
        self.click_log = []
        print("🗑️ 点击历史已清空")
                
    def set_base_interval(self, seconds):
        """设置基础点击间隔"""
        if seconds > 0:
            self.base_interval = seconds
            print(f"⏱️ 基础点击间隔已设置为: {seconds}秒")
            self.save_current_config()
        else:
            print("❌ 间隔时间必须大于0")
            
    def set_interval_variance(self, variance):
        """设置间隔变化范围"""
        if variance >= 0:
            self.interval_variance = variance
            print(f"🎲 间隔变化范围已设置为: ±{variance}秒")
            self.save_current_config()
        else:
            print("❌ 变化范围不能为负数")
            
    def set_position_variance(self, pixels):
        """设置位置变化范围"""
        if pixels >= 0:
            self.position_variance = pixels
            print(f"🎯 位置变化范围已设置为: ±{pixels}像素")
            self.save_current_config()
        else:
            print("❌ 变化范围不能为负数")

# 全局实例
simulator = HumanLikeClickSimulator()

def on_press(key):
    try:
        if key == keyboard.Key.f9:
            if simulator.is_running:
                simulator.stop_clicking()
            else:
                simulator.start_clicking()
        elif key == keyboard.Key.f8:
            simulator.set_click_position()
        elif key == keyboard.Key.f7:
            new_interval = simulator.base_interval + 5
            simulator.set_base_interval(new_interval)
        elif key == keyboard.Key.f6:
            new_interval = max(1, simulator.base_interval - 5)
            simulator.set_base_interval(new_interval)
        elif key == keyboard.Key.f5:
            new_variance = simulator.position_variance + 5
            simulator.set_position_variance(new_variance)
        elif key == keyboard.Key.f4:
            new_variance = max(0, simulator.position_variance - 5)
            simulator.set_position_variance(new_variance)
        elif key == keyboard.Key.f3:
            simulator.show_click_history()
        elif key == keyboard.Key.f2:
            simulator.clear_click_history()
        elif key == keyboard.Key.esc:
            print("\n👋 退出程序")
            return False
    except Exception as e:
        print(f"按键处理错误: {e}")

def main():
    print("🐧 Ubuntu 拟人化点击模拟器启动")
    print("此程序模拟人类点击行为，并记录运行结果")
    
    # 尝试加载上次运行的配置
    if simulator.load_last_run():
        print("✅ 已恢复上次的配置")
    else:
        print("ℹ️ 首次运行或未找到配置文件，使用默认配置")
    
    print("\n🎹 快捷键说明:")
    print("   [F8] 设置当前鼠标位置为点击位置")
    print("   [F9] 开始/停止点击")
    print("   [F7/F6] 增加/减少基础点击间隔")
    print("   [F5/F4] 增加/减少位置偏差")
    print("   [F3] 显示最近点击历史")
    print("   [F2] 清空点击历史")
    print("   [ESC] 退出程序")
    print("\n⚠️ 安全提示: 将鼠标迅速移动到屏幕左上角可触发紧急停止!")
    
    print(f"\n⚙️ 当前设置:")
    print(f"   - 基础间隔: {simulator.base_interval}±{simulator.interval_variance}秒")
    print(f"   - 位置偏差: ±{simulator.position_variance}像素")
    if simulator.click_position:
        print(f"   - 点击位置: {simulator.click_position}")
    
    print("\n👉 请按 F8 设置点击位置，然后按 F9 开始点击")
    
    # 启动键盘监听
    listener = keyboard.Listener(on_press=on_press)
    listener.start()
    
    print("\n🔄 程序正在后台运行... (按 ESC 退出)")
    listener.join()

if __name__ == "__main__":
    main()