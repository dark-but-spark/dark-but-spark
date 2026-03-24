import pyautogui
import time
import threading
import random
from pynput import keyboard
import sys
import os
from datetime import datetime

# Linux 特定配置
pyautogui.FAILSAFE = True 
pyautogui.PAUSE = 0.1 

class HumanLikeClickSimulator:
    def __init__(self):
        self.is_running = False
        self.base_interval = 5
        self.interval_variance = 2
        self.position_variance = 5
        self.click_position = None
        self.thread = None
        self.click_log = []
        self.last_run_file = os.path.expanduser("~/last_run_linux.txt")
        
    def load_last_run(self):
        if os.path.exists(self.last_run_file):
            try:
                with open(self.last_run_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    if len(lines) >= 5:
                        coords = lines[0].strip().split(',')
                        # 确保加载的是整数
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
        if self.click_position is None:
            return
        try:
            with open(self.last_run_file, 'w', encoding='utf-8') as f:
                f.write(f"{int(self.click_position[0])},{int(self.click_position[1])}\n")
                f.write(f"{self.base_interval}\n")
                f.write(f"{self.interval_variance}\n")
                f.write(f"{self.position_variance}\n")
                f.write(f"Last saved: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        except Exception as e:
            print(f"⚠️ 保存配置失败: {e}")
    
    def set_click_position(self, x=None, y=None):
        if x is not None and y is not None:
            self.click_position = (int(x), int(y))
        else:
            pos = pyautogui.position()
            # 确保 position 返回的值转为 int
            self.click_position = (int(pos.x), int(pos.y))
        print(f"📍 点击位置已设置为: {self.click_position}")
        self.save_current_config()
        
    def start_clicking(self):
        if self.is_running:
            print("⚠️ 点击已在运行中")
            return
            
        if self.click_position is None:
            print("❌ 请先按 F8 设置点击位置")
            return
            
        self.is_running = True
        print(f"🚀 开始拟人化点击 (Linux版 - 已修复类型错误)")
        print(f"   - 目标: {self.click_position} ± {self.position_variance}px")
        print(f"   - 间隔: {self.base_interval} ± {self.interval_variance}s")
        print("💡 提示: 将鼠标移到屏幕左上角可紧急停止 (Fail-safe)")
        
        self.thread = threading.Thread(target=self._click_loop, daemon=True)
        self.thread.start()
        
    def stop_clicking(self):
        self.is_running = False
        print("🛑 已停止点击")
        
    def _click_loop(self):
        while self.is_running:
            try:
                original_pos = pyautogui.position()
                original_x = int(original_pos.x)
                original_y = int(original_pos.y)
                
                # --- 核心修复：强制所有坐标计算为整数 ---
                base_x = int(self.click_position[0])
                base_y = int(self.click_position[1])
                var = int(self.position_variance)
                
                target_x = base_x + random.randint(-var, var)
                target_y = base_y + random.randint(-var, var)
                
                screen_w, screen_h = pyautogui.size()
                screen_w = int(screen_w)
                screen_h = int(screen_h)
                
                # 边界检查并确保结果是 int
                target_x = int(max(0, min(target_x, screen_w - 1)))
                target_y = int(max(0, min(target_y, screen_h - 1)))
                # ---------------------------------------
                
                move_duration = random.uniform(0.15, 0.35)
                # moveTo 现在接收明确的 int
                pyautogui.moveTo(target_x, target_y, duration=move_duration, tween=pyautogui.easeInOutQuad)
                
                delay_before_click = random.uniform(0.1, 0.5)
                time.sleep(delay_before_click)
                
                pyautogui.click()
                
                delay_after_click = random.uniform(0.1, 0.3)
                time.sleep(delay_after_click)
                
                return_move_duration = random.uniform(0.1, 0.2)
                pyautogui.moveTo(original_x, original_y, duration=return_move_duration, tween=pyautogui.easeInOutQuad)
                
                click_info = {
                    'time': datetime.now(),
                    'position': (target_x, target_y),
                    'original_pos': (original_x, original_y),
                }
                self.click_log.append(click_info)
                
                if len(self.click_log) > 100:
                    self.click_log.pop(0)
                
                print(f"✅ 点击: ({target_x}, {target_y}) @ {time.strftime('%H:%M:%S')}")
                
                actual_wait_time = max(0.5, self.base_interval + random.uniform(-self.interval_variance, self.interval_variance))
                
                sleep_step = 0.5
                elapsed = 0
                while elapsed < actual_wait_time and self.is_running:
                    time.sleep(sleep_step)
                    elapsed += sleep_step
                
            except Exception as e:
                print(f"❌ 点击出错: {e}")
                if "Xlib" in str(e) or "display" in str(e).lower():
                    print("💡 提示: 可能是 X11/Wayland 权限问题。")
                elif "integer" in str(e).lower():
                    print("💡 提示: 坐标类型错误，请检查代码是否已强制转换为 int。")
                break
                
    def show_click_history(self):
        if not self.click_log:
            print("📭 暂无点击历史")
            return
        print(f"\n=== 最近 {min(10, len(self.click_log))} 次点击记录 ===")
        for i, record in enumerate(self.click_log[-10:], 1):
            print(f"{i}. {record['time'].strftime('%H:%M:%S')} - 位置({record['position'][0]}, {record['position'][1]})")
            
    def clear_click_history(self):
        self.click_log = []
        print("🗑️ 点击历史已清空")
                
    def set_base_interval(self, seconds):
        if seconds > 0:
            self.base_interval = float(seconds)
            print(f"⏱️ 基础点击间隔已设置为: {seconds}秒")
            self.save_current_config()
        else:
            print("❌ 间隔时间必须大于0")
            
    def set_interval_variance(self, variance):
        if variance >= 0:
            self.interval_variance = float(variance)
            print(f"🎲 间隔变化范围已设置为: ±{variance}秒")
            self.save_current_config()
        else:
            print("❌ 变化范围不能为负数")
            
    def set_position_variance(self, pixels):
        if pixels >= 0:
            self.position_variance = float(pixels)
            print(f"🎯 位置变化范围已设置为: ±{pixels}像素")
            self.save_current_config()
        else:
            print("❌ 变化范围不能为负数")

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
    
    listener = keyboard.Listener(on_press=on_press)
    listener.start()
    
    print("\n🔄 程序正在后台运行... (按 ESC 退出)")
    listener.join()

if __name__ == "__main__":
    main()