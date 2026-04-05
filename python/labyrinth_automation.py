"""
迷宫自动化程序
用于自动运行迷宫并管理门票数量
"""

import os
import time
import json
import cv2
import numpy as np
from typing import Tuple, Optional, Dict, Any
import re


class LabyrinthAutomation:
    def __init__(self):
        """初始化迷宫自动化程序"""
        self.running = False
        self.ticket_count = {"current": 0, "max": 0}
        self.in_labyrinth = False
        
        # 图像识别相关配置
        self.screenshot_dir = "./screenshots"
        self.template_dir = "./templates"
        
        # 确保目录存在
        os.makedirs(self.screenshot_dir, exist_ok=True)
        os.makedirs(self.template_dir, exist_ok=True)
        
    def capture_screen(self, region: Optional[Tuple[int, int, int, int]] = None) -> np.ndarray:
        """
        截取屏幕画面
        :param region: (x, y, width, height) 截图区域，None表示全屏
        :return: 截图的numpy数组
        """
        # 这里需要根据实际情况选择截图库，例如pyautogui, mss等
        # 示例使用pyautogui
        try:
            import pyautogui
            screenshot = pyautogui.screenshot(region=region)
            screenshot = cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)
            return screenshot
        except ImportError:
            print("请安装pyautogui: pip install pyautogui")
            return np.zeros((100, 100, 3), dtype=np.uint8)  # 返回空白图像作为占位符
    
    def detect_ticket_count(self) -> Tuple[int, int]:
        """
        检测门票数量
        使用图像识别来识别门票数量
        格式为"入场券： {cnt} / 5"
        :return: (当前门票数, 总门票数)
        """
        # 截取门票计数区域
        # 假设门票计数区域在屏幕的某个固定位置，需要根据实际情况调整坐标
        ticket_region = (100, 100, 200, 50)  # (x, y, width, height) - 示例坐标
        screen = self.capture_screen(region=ticket_region)
        
        # 保存截图用于调试
        timestamp = int(time.time())
        cv2.imwrite(f"{self.screenshot_dir}/ticket_count_{timestamp}.png", screen)
        
        # 使用OCR或其他图像识别技术来识别门票数量
        # 这里使用占位符实现，实际应用中可以使用pytesseract或其他OCR库
        ticket_text = self.ocr_image(screen)
        
        # 使用正则表达式匹配"入场券： {cnt} / 5"格式
        pattern = r'入场券\s*：\s*(\d+)\s*\/\s*5'
        match = re.search(pattern, ticket_text)
        
        if match:
            current = int(match.group(1))
            total = 5
            print(f"检测到门票数量: {current}/{total}")
            return current, total
        else:
            print(f"未能匹配门票格式，OCR文本: {ticket_text}")
            return 0, 0
    
    def ocr_image(self, image: np.ndarray) -> str:
        """
        对图像进行OCR识别
        :param image: 输入图像
        :return: 识别出的文本
        """
        # 这里需要根据实际情况选择OCR库，例如pytesseract
        try:
            import pytesseract
            # 预处理图像以提高OCR准确性
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            # 应用阈值处理
            _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
            # 使用OCR识别文本
            text = pytesseract.image_to_string(thresh, lang='chi_sim+eng')
            return text.strip()
        except ImportError:
            print("请安装pytesseract和Tesseract-OCR: pip install pytesseract")
            return f"PLACEHOLDER OCR TEXT FOR IMAGE SHAPE {image.shape}"
    
    def detect_labyrinth_status(self) -> bool:
        """
        检测是否在迷宫中
        :return: 是否在迷宫中
        """
        # 截取状态栏区域
        status_region = (50, 50, 300, 100)  # 示例坐标
        screen = self.capture_screen(region=status_region)
        
        # 保存截图用于调试
        timestamp = int(time.time())
        cv2.imwrite(f"{self.screenshot_dir}/labyrinth_status_{timestamp}.png", screen)
        
        # 检测是否有迷宫相关图标或文本
        # 这里使用图像模板匹配或OCR识别
        status_text = self.ocr_image(screen)
        
        # 检查是否包含迷宫相关关键词
        if "迷宫" in status_text or "labyrinth" in status_text.lower():
            print("检测到迷宫状态")
            return True
        else:
            print("未检测到迷宫状态")
            return False
    
    def replenish_tickets(self) -> bool:
        """
        补充门票
        :return: 是否成功补充门票
        """
        print("尝试补充门票...")
        
        # 检测是否在迷宫设置页面
        # 这里需要实现导航到设置页面的逻辑
        # 可能需要点击设置按钮等
        
        # 查找补充门票按钮并点击
        # 这里使用图像识别来找到按钮位置
        button_pos = self.find_button_by_template("replenish_ticket_btn.png")
        
        if button_pos:
            self.click_at_position(button_pos[0], button_pos[1])
            time.sleep(2)  # 等待动画
            
            # 确认补充
            confirm_pos = self.find_button_by_template("confirm_btn.png")
            if confirm_pos:
                self.click_at_position(confirm_pos[0], confirm_pos[1])
                print("门票补充请求已发送")
                
                # 等待一段时间后重新检测门票数量
                time.sleep(5)
                current, max_tickets = self.detect_ticket_count()
                
                if current > 0:
                    print(f"门票补充成功，当前数量: {current}/{max_tickets}")
                    return True
                else:
                    print("门票补充失败")
                    return False
        else:
            print("未找到补充门票按钮")
            return False
    
    def find_button_by_template(self, template_filename: str) -> Optional[Tuple[int, int]]:
        """
        使用模板匹配查找按钮位置
        :param template_filename: 模板图片文件名
        :return: 按钮中心坐标(x, y)，未找到返回None
        """
        # 尝试加载模板
        template_path = os.path.join(self.template_dir, template_filename)
        
        if not os.path.exists(template_path):
            print(f"模板文件不存在: {template_path}")
            # 创建一个占位符模板图像
            placeholder = np.zeros((50, 100, 3), dtype=np.uint8)
            cv2.putText(placeholder, template_filename[:15], (5, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            cv2.imwrite(template_path, placeholder)
            return None
        
        template = cv2.imread(template_path)
        screen = self.capture_screen()
        
        # 执行模板匹配
        result = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
        
        # 设定匹配阈值
        threshold = 0.7
        if max_val >= threshold:
            # 计算匹配区域中心点
            h, w = template.shape[:2]
            center_x = max_loc[0] + w // 2
            center_y = max_loc[1] + h // 2
            print(f"找到按钮 '{template_filename}' 在 ({center_x}, {center_y})，匹配度: {max_val:.2f}")
            return (center_x, center_y)
        else:
            print(f"未找到按钮 '{template_filename}'，最佳匹配度: {max_val:.2f}")
            return None
    
    def click_at_position(self, x: int, y: int):
        """
        点击指定位置
        :param x: X坐标
        :param y: Y坐标
        """
        try:
            import pyautogui
            # 添加随机偏移以模拟人类点击
            offset_x = np.random.randint(-3, 4)
            offset_y = np.random.randint(-3, 4)
            pyautogui.click(x + offset_x, y + offset_y)
            print(f"点击位置 ({x + offset_x}, {y + offset_y})")
        except ImportError:
            print("请安装pyautogui: pip install pyautogui")
    
    def enter_labyrinth(self):
        """
        进入迷宫
        """
        print("尝试进入迷宫...")
        
        # 查找进入迷宫按钮
        enter_btn_pos = self.find_button_by_template("enter_labyrinth_btn.png")
        
        if enter_btn_pos:
            self.click_at_position(enter_btn_pos[0], enter_btn_pos[1])
            time.sleep(2)
            
            # 查找开始按钮
            start_btn_pos = self.find_button_by_template("start_labyrinth_btn.png")
            if start_btn_pos:
                self.click_at_position(start_btn_pos[0], start_btn_pos[1])
                print("迷宫已开始")
            else:
                print("未找到开始按钮")
        else:
            print("未找到进入迷宫按钮")
    
    def run_cycle(self):
        """
        执行一次完整的迷宫循环
        """
        print("开始执行迷宫循环...")
        
        # 更新门票数量
        self.ticket_count = {
            "current": self.detect_ticket_count()[0],
            "max": self.detect_ticket_count()[1]
        }
        
        # 更新迷宫状态
        self.in_labyrinth = self.detect_labyrinth_status()
        
        print(f"当前状态 - 门票: {self.ticket_count['current']}/{self.ticket_count['max']}, "
              f"迷宫中: {'是' if self.in_labyrinth else '否'}")
        
        if not self.in_labyrinth:
            # 检查门票是否足够
            if self.ticket_count["current"] <= 0:
                print("门票不足，尝试补充...")
                success = self.replenish_tickets()
                if not success:
                    print("补充门票失败，等待...")
                    return
                
                # 更新门票数量
                self.ticket_count = {
                    "current": self.detect_ticket_count()[0],
                    "max": self.detect_ticket_count()[1]
                }
            
            # 如果门票充足，则进入迷宫
            if self.ticket_count["current"] > 0:
                self.enter_labyrinth()
            else:
                print("仍然没有足够的门票")
        else:
            print("正在迷宫中，等待结束...")
            # 等待迷宫结束
            time.sleep(30)  # 等待30秒后再检查
    
    def start(self):
        """
        开始自动化
        """
        print("迷宫自动化开始运行...")
        self.running = True
        
        while self.running:
            try:
                self.run_cycle()
                
                # 每次循环之间等待一段时间
                wait_time = 60  # 1分钟
                print(f"等待 {wait_time} 秒后继续...")
                time.sleep(wait_time)
                
            except KeyboardInterrupt:
                print("\n用户中断，停止自动化...")
                self.running = False
            except Exception as e:
                print(f"运行中出现错误: {str(e)}")
                time.sleep(10)  # 出错后等待10秒再继续
    
    def stop(self):
        """
        停止自动化
        """
        print("停止迷宫自动化...")
        self.running = False


def main():
    """
    主函数
    """
    print("初始化迷宫自动化程序...")
    
    # 创建自动化实例
    automation = LabyrinthAutomation()
    
    try:
        # 开始自动化
        automation.start()
    except KeyboardInterrupt:
        print("\n程序被用户中断")
        automation.stop()
    finally:
        print("程序结束")


if __name__ == "__main__":
    main()