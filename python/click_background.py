import pyautogui
import time
import threading
import random
from pynput import keyboard
import sys
import os
from datetime import datetime

class HumanLikeClickSimulator:
    def __init__(self):
        self.is_running = False
        self.base_interval = 2.5 # 基础点击间隔2.5秒
        self.interval_variance = 0.5  # 间隔变化范围（秒）
        self.position_variance = 5  # 位置变化范围（像素）
        self.click_position = None
        self.thread = None
        self.click_log = []  # 记录点击历史
        self.last_run_file = "last_run.txt"  # 存储上次运行结果的文件
        
    def load_last_run(self):
        """加载上次运行的配置"""
        if os.path.exists(self.last_run_file):
            try:
                with open(self.last_run_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    if len(lines) >= 5:
                        self.click_position = tuple(map(int, lines[0].strip().split(',')))
                        self.base_interval = float(lines[1].strip())
                        self.interval_variance = float(lines[2].strip())
                        self.position_variance = float(lines[3].strip())
                        
                        print("已加载上次运行的配置:")
                        print(f"- 点击位置: {self.click_position}")
                        print(f"- 基础间隔: {self.base_interval}s")
                        print(f"- 间隔偏差: ±{self.interval_variance}s")
                        print(f"- 位置偏差: ±{self.position_variance}px")
                        return True
            except Exception as e:
                print(f"加载上次运行配置失败: {e}")
        return False
        
    def save_current_config(self):
        """保存当前配置到文件"""
        try:
            with open(self.last_run_file, 'w', encoding='utf-8') as f:
                f.write(f"{self.click_position[0]},{self.click_position[1]}\n")
                f.write(f"{self.base_interval}\n")
                f.write(f"{self.interval_variance}\n")
                f.write(f"{self.position_variance}\n")
                f.write(f"Last saved: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        except Exception as e:
            print(f"保存配置失败: {e}")
    
    def set_click_position(self, x=None, y=None):
        """设置点击位置，默认为当前位置"""
        if x is not None and y is not None:
            self.click_position = (x, y)
        else:
            self.click_position = pyautogui.position()
        print(f"点击位置已设置为: {self.click_position}")
        self.save_current_config()  # 自动保存配置
        
    def start_clicking(self):
        """开始后台点击"""
        if self.is_running:
            print("点击已在运行中")
            return
            
        if self.click_position is None:
            print("请先设置点击位置")
            return
            
        self.is_running = True
        print(f"开始拟人化点击，基础间隔{self.base_interval}±{self.interval_variance}秒，位置{self.click_position}±{self.position_variance}px")
        
        # 启动后台线程
        self.thread = threading.Thread(target=self._click_loop, daemon=True)
        self.thread.start()
        
    def stop_clicking(self):
        """停止点击"""
        self.is_running = False
        print("已停止点击")
        
    def _click_loop(self):
        """后台点击循环"""
        while self.is_running:
            try:
                # 记录原始鼠标位置
                original_x, original_y = pyautogui.position()
                
                # 计算带偏差的目标位置
                target_x = self.click_position[0] + random.randint(-self.position_variance, self.position_variance)
                target_y = self.click_position[1] + random.randint(-self.position_variance, self.position_variance)
                
                # 计算移动速度（模拟人类移动轨迹）
                move_duration = random.uniform(0.1, 0.3)  # 随机移动时间
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
                    'delay_before': delay_before_click,
                    'delay_after': delay_after_click,
                    'move_duration': move_duration
                }
                self.click_log.append(click_info)
                
                print(f"点击执行于: ({target_x}, {target_y}) - 时间: {time.strftime('%H:%M:%S')}")
                
                # 计算带偏差的等待时间
                actual_wait_time = self.base_interval + random.uniform(-self.interval_variance, self.interval_variance)
                for i in range(int(actual_wait_time)):
                    if not self.is_running:
                        break
                    time.sleep(1)
                if not self.is_running:
                    break
                time.sleep(actual_wait_time - int(actual_wait_time))  # 补足小数部分
                
            except Exception as e:
                print(f"点击出错: {e}")
                break
                
    def show_click_history(self):
        """显示点击历史"""
        if not self.click_log:
            print("暂无点击历史")
            return
            
        print(f"\n=== 最近 {min(10, len(self.click_log))} 次点击记录 ===")
        for i, record in enumerate(self.click_log[-10:], 1):
            print(f"{i}. {record['time'].strftime('%H:%M:%S')} - 位置({record['position'][0]}, {record['position'][1]})")
            
    def clear_click_history(self):
        """清空点击历史"""
        self.click_log = []
        print("点击历史已清空")
                
    def set_base_interval(self, seconds):
        """设置基础点击间隔"""
        if seconds > 0:
            self.base_interval = seconds
            print(f"基础点击间隔已设置为: {seconds}秒")
            self.save_current_config()  # 自动保存配置
        else:
            print("间隔时间必须大于0")
            
    def set_interval_variance(self, variance):
        """设置间隔变化范围"""
        if variance >= 0:
            self.interval_variance = variance
            print(f"间隔变化范围已设置为: ±{variance}秒")
            self.save_current_config()  # 自动保存配置
        else:
            print("变化范围不能为负数")
            
    def set_position_variance(self, pixels):
        """设置位置变化范围"""
        if pixels >= 0:
            self.position_variance = pixels
            print(f"位置变化范围已设置为: ±{pixels}像素")
            self.save_current_config()  # 自动保存配置
        else:
            print("变化范围不能为负数")

# 全局实例
simulator = HumanLikeClickSimulator()

def on_press(key):
    try:
        # 使用功能键避免冲突
        if key == keyboard.Key.f9:
            if simulator.is_running:
                simulator.stop_clicking()
            else:
                simulator.start_clicking()
        elif key == keyboard.Key.f8:
            simulator.set_click_position()
        elif key == keyboard.Key.f7:
            print("增加点击间隔5秒")
            new_interval = simulator.base_interval + 5
            simulator.set_base_interval(new_interval)
        elif key == keyboard.Key.f6:
            print("减少点击间隔5秒，最小1秒")
            new_interval = max(1, simulator.base_interval - 5)
            simulator.set_base_interval(new_interval)
        elif key == keyboard.Key.f5:
            print("增加位置偏差5像素")
            new_variance = simulator.position_variance + 5
            simulator.set_position_variance(new_variance)
        elif key == keyboard.Key.f4:
            print("减少位置偏差5像素，最小0像素")
            new_variance = max(0, simulator.position_variance - 5)
            simulator.set_position_variance(new_variance)
        elif key == keyboard.Key.f3:
            print("显示最近点击历史")
            simulator.show_click_history()
        elif key == keyboard.Key.f2:
            print("清空点击历史")
            simulator.clear_click_history()
        elif key == keyboard.Key.esc:
            print("退出程序")
            return False
    except AttributeError:
        # 特殊键处理
        if key == keyboard.Key.esc:
            print("退出程序")
            return False

def main():
    print("带记录功能的拟人化点击模拟器启动")
    print("此程序模拟人类点击行为，并记录运行结果")
    
    # 尝试加载上次运行的配置
    if simulator.load_last_run():
        print("已恢复上次的配置")
    else:
        print("首次运行，使用默认配置")
    
    print("快捷键说明:")
    print("- F8键: 设置当前鼠标位置为点击位置")
    print("- F9键: 开始/停止点击")
    print("- F7键: 增加基础点击间隔5秒")
    print("- F6键: 减少基础点击间隔5秒")
    print("- F5键: 增加位置偏差5像素")
    print("- F4键: 减少位置偏差5像素")
    print("- F3键: 显示最近点击历史")
    print("- F2键: 清空点击历史")
    print("- ESC键: 退出程序")
    print("- 命令行设置间隔: python script.py --interval 秒数")
    
    # 处理命令行参数
    if len(sys.argv) > 2:
        if sys.argv[1] == '--interval':
            try:
                interval = float(sys.argv[2])
                simulator.set_base_interval(interval)
            except ValueError:
                print("无效的时间间隔，请输入数字")
    
    print(f"\n当前设置:")
    print(f"- 基础间隔: {simulator.base_interval}±{simulator.interval_variance}秒")
    print(f"- 位置偏差: ±{simulator.position_variance}像素")
    if simulator.click_position:
        print(f"- 点击位置: {simulator.click_position}")
    print("请按F8设置点击位置，然后按F9开始点击")
    
    # 启动键盘监听
    listener = keyboard.Listener(on_press=on_press)
    listener.start()
    
    print("\n程序正在后台运行...")
    listener.join()

if __name__ == "__main__":
    main()