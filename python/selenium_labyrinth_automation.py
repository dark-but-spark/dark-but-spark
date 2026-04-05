"""
基于Selenium的迷宫自动化程序
直接读取浏览器页面内容，无需图像识别
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import time
import random
import re
import os
import json
import logging


def setup_logging():
    """设置日志记录"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        handlers=[
            logging.FileHandler(os.path.join(os.getcwd(), 'automation.log'), encoding='utf-8'),
            logging.StreamHandler()
        ]
    )


def human_delay(min_seconds=0.5, max_seconds=2.5):
    """
    模拟人类操作的随机延迟
    :param min_seconds: 最小延迟秒数
    :param max_seconds: 最大延迟秒数
    """
    delay = random.uniform(min_seconds, max_seconds)
    time.sleep(delay)


class SeleniumLabyrinthAutomation:
    def __init__(self, url="https://test.milkywayidle.com/game?characterId=27496", profile_dir=None, headless=False):
        """初始化浏览器自动化程序"""
        self.url = url
        self.driver = None
        self.wait = None
        self.running = False
        self.in_labyrinth = False
        self.ticket_count = {"current": 0, "max": 0}
        self.profile_dir = profile_dir or os.path.join(os.getcwd(), "browser_profile")
        self.cookies_file = os.path.join(self.profile_dir, "cookies.json")
        self.headless = headless  # 添加无头模式选项
        self.cycle_count = 1  # 添加循环计数器
        
        # 延迟设置参数（秒）
        self.button_click_delay_min = 1.5
        self.button_click_delay_max = 3.0
        self.status_check_interval_min = 20
        self.status_check_interval_max = 30
        self.between_cycles_delay_min = 15
        self.between_cycles_delay_max = 20
        
        # 确保配置文件目录存在
        os.makedirs(self.profile_dir, exist_ok=True)
        
    def init_driver(self):
        """初始化浏览器驱动"""
        logging.info("开始设置浏览器驱动...")
        try:
            chrome_options = Options()
            
            # 添加用户数据目录以保持会话
            chrome_options.add_argument(f"--user-data-dir={self.profile_dir}")
            
            # 设置窗口大小
            chrome_options.add_argument("--window-size=1920,1080")
            
            # 无头模式选项
            if self.headless:
                chrome_options.add_argument("--headless")
            
            # 隐藏自动化提示
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            
            # 隐藏webdriver特征
            chrome_options.add_argument("--disable-blink-features=AutomationControlled")
            
            # 设置语言
            chrome_options.add_argument("--lang=zh-CN")
            
            # 禁用一些可能暴露自动化特征的选项
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--no-sandbox")
            
            # 更高级的反检测选项
            chrome_options.add_argument("--disable-blink-features=AutomationControlled")
            chrome_options.add_experimental_option("useAutomationExtension", False)
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            
            # 设置用户代理伪装
            chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
            
            # 禁用某些webgl指纹识别特性
            chrome_options.add_argument("--disable-webgl")
            chrome_options.add_argument("--disable-webgl2")
            
            # 禁用图片加载以提高性能（可选）
            # prefs = {"profile.managed_default_content_settings.images": 2}
            # chrome_options.add_experimental_option("prefs", prefs)
            
            # 安装并启动驱动
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            
            # 执行脚本来隐藏webdriver特征
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # 进一步隐藏自动化特征
            self.driver.execute_script("""
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['zh-CN', 'zh', 'en'],
                });
                
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => {
                    return parameters.name === 'notifications' ?
                        Promise.resolve({state: 'denied'}) :
                        originalQuery(parameters);
                };
            """)
            
            # 设置隐式等待
            self.driver.implicitly_wait(10)
            self.wait = WebDriverWait(self.driver, 15)
            
            logging.info("浏览器驱动设置完成")
            return True
        except Exception as e:
            logging.error(f"浏览器驱动设置失败: {str(e)}")
            return False
    
    def load_cookies(self):
        
        """从文件加载cookies"""
        logging.info("尝试加载cookies...")
        if os.path.exists(self.cookies_file):
            try:
                with open(self.cookies_file, 'r', encoding='utf-8') as f:
                    cookies = json.load(f)
                
                # 先访问域名，然后添加cookies
                self.driver.get(self.url)
                time.sleep(2)  # 等待页面加载
                
                for cookie in cookies:
                    try:
                        # 修正cookie的sameSite属性，如果存在的话
                        if 'sameSite' in cookie:
                            # 仅在必要时删除sameSite属性
                            del cookie['sameSite']
                        
                        self.driver.add_cookie(cookie)
                        logging.debug(f"已添加cookie: {cookie['name']}")
                    except Exception as e:
                        logging.warning(f"添加cookie失败: {str(e)}")
                
                logging.info("成功加载cookies")
                return True
            except Exception as e:
                logging.error(f"加载cookies失败: {str(e)}")
                return False
        else:
            logging.warning(f"Cookies文件不存在: {self.cookies_file}")
        return False
    
    def save_cookies(self):
        """保存当前cookies到文件"""
        try:
            cookies = self.driver.get_cookies()
            with open(self.cookies_file, 'w', encoding='utf-8') as f:
                json.dump(cookies, f, ensure_ascii=False, indent=2)
            logging.info(f"成功保存 {len(cookies)} 个cookies到文件")
        except Exception as e:
            logging.error(f"保存cookies失败: {str(e)}")
    
    def login_if_needed(self):
        """检查是否需要登录，如果需要则提示用户登录"""
        try:
            logging.info(f"访问页面: {self.url}")
            self.driver.get(self.url)
            time.sleep(3)
            
            # 检查是否需要登录
            # 这里可以根据实际情况调整检测逻辑
            login_indicators = [
                "login", "sign in", "log in", "connect", "auth"
            ]
            
            page_source = self.driver.page_source.lower()
            needs_login = any(indicator in page_source for indicator in login_indicators)
            
            logging.info(f"页面源码检查结果: 需要登录 = {needs_login}")
            
            if needs_login:
                logging.info("检测到需要登录，将在浏览器中打开页面，请手动登录...")
                logging.info("登录完成后，请返回此程序并按Enter键继续...")
                
                # 等待用户登录
                input("请在浏览器中完成登录，完成后按Enter键继续...")
                
                # 保存登录后的cookies
                self.save_cookies()
                logging.info("登录信息已保存")
                
                # 等待用户确认登录成功
                time.sleep(2)
            else:
                logging.info("无需登录或已登录")
                
                # 尝试加载已保存的cookies
                if self.load_cookies():
                    # 刷新页面使cookies生效
                    self.driver.refresh()
                    time.sleep(3)
                    
                    # 再次检查是否仍需登录
                    page_source = self.driver.page_source.lower()
                    needs_login = any(indicator in page_source for indicator in login_indicators)
                    
                    if needs_login:
                        logging.warning("加载的cookies无效，需要重新登录...")
                        self.login_manually()
                else:
                    logging.info("没有找到保存的登录信息，可能需要首次登录...")
                    self.login_manually()
        
        except Exception as e:
            logging.error(f"检查登录状态失败: {str(e)}")
            self.login_manually()
    
    def login_manually(self):
        """手动登录流程"""
        logging.info("将在浏览器中打开页面，请手动登录...")
        logging.info("登录完成后，请返回此程序并按Enter键继续...")
        
        # 访问游戏页面
        self.driver.get(self.url)
        time.sleep(2)
        
        # 等待用户登录
        input("请在浏览器中完成登录，完成后按Enter键继续...")
        
        # 保存登录后的cookies
        self.save_cookies()
        logging.info("登录信息已保存")
        
        # 等待用户确认登录成功
        time.sleep(2)

    def verify_login_status(self):
        """验证登录状态"""
        try:
            # 检查是否需要登录
            login_indicators = [
                "login", "sign in", "log in", "connect", "auth"
            ]
            
            page_source = self.driver.page_source.lower()
            needs_login = any(indicator in page_source for indicator in login_indicators)
            
            return not needs_login
        except Exception as e:
            logging.error(f"验证登录状态失败: {str(e)}")
            return False
    
    def verify_labyrinth_page(self):
        """验证当前是否在迷宫页面"""
        try:
            # 检查页面是否存在迷宫面板 - 这是最可靠的检测方法
            labyrinth_panels = self.driver.find_elements(By.CLASS_NAME, "LabyrinthPanel_labyrinthPanel__20JNz")
            if not labyrinth_panels:
                return False
            
            # 检查是否存在迷宫相关的特定元素
            labyrinth_specific_elements = [
                "LabyrinthPanel_chargeDisplay__3IgjX",  # 门票显示区
                "LabyrinthPanel_buttonsContainer__2oY1b",  # 按钮容器
                "LabyrinthPanel_labyrinthTab__3_b10",  # 迷宫标签页
                "LabyrinthPanel_entryScreen__pOtpK",  # 迷宫入口界面
                "LabyrinthPanel_chargeCount__1GDLP",  # 门票计数器
                "LabyrinthPanel_labyrinthTokenStack__2gDe4",  # 迷宫代币
            ]
            
            # 如果找到任何一个迷宫特有元素，说明在迷宫页面
            for element_class in labyrinth_specific_elements:
                if self.driver.find_elements(By.CLASS_NAME, element_class):
                    return True
            
            # 再检查是否有进入迷宫的按钮
            enter_btn_elements = self.driver.find_elements(By.XPATH, "//button[contains(text(), '进入迷宫')]")
            if enter_btn_elements:
                return True
            
            # 检查是否有结束迷宫的按钮
            exit_btn_elements = self.driver.find_elements(By.XPATH, "//button[contains(text(), '结束迷宫')]")
            if exit_btn_elements:
                return True
            
            return False
        except:
            return False

    def navigate_to_labyrinth(self):
        """导航到迷宫页面"""
        try:
            logging.info(f"导航到页面: {self.url}")
            self.driver.get(self.url)
            
            # 等待页面加载
            time.sleep(5)  # 增加等待时间
            
            # 显式等待确保导航栏已加载
            try:
                nav_links = WebDriverWait(self.driver, 15).until(
                    EC.presence_of_all_elements_located((By.CSS_SELECTOR, ".NavigationBar_navigationLink__3eAHA"))
                )
                logging.info(f"找到 {len(nav_links)} 个导航项")
            except:
                logging.warning("未找到任何导航项，可能页面加载有问题")
                return False
            
            # 策略1: 查找包含 aria-label="navigationBar.labyrinth" 的元素
            logging.info("尝试策略1: 通过 aria-label 查找迷宫导航...")
            try:
                labyrinth_icon = WebDriverWait(self.driver, 10).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, "[aria-label='navigationBar.labyrinth']"))
                )
                parent_link = labyrinth_icon.find_element(By.XPATH, "./ancestor-or-self::div[contains(@class, 'NavigationBar_navigationLink__')]")
                logging.info("找到迷宫导航项，准备点击")
                
                # 检查是否已经是激活状态
                if "NavigationBar_active__" in parent_link.get_attribute("class"):
                    logging.info("迷宫导航已是激活状态")
                    # 验证是否真的在迷宫页面 - 这是关键修复点
                    if self.verify_labyrinth_page():
                        logging.info("当前已在迷宫页面")
                        return True
                    else:
                        logging.info("导航项显示激活但实际不在迷宫页面，重新点击")
                
                # 使用JavaScript点击以绕过可能的遮挡元素
                self.driver.execute_script("arguments[0].click();", parent_link)
                logging.info("已点击迷宫导航项")
                
                # 等待页面切换
                human_delay(self.button_click_delay_min, self.button_click_delay_max)
                
                # 验证是否到达正确的迷宫页面
                if self.verify_labyrinth_page():
                    logging.info("已成功导航到迷宫页面")
                    return True
                else:
                    logging.info("点击后仍未到达迷宫页面，可能需要等待页面加载")
                    human_delay(2, 4)
                    if self.verify_labyrinth_page():
                        logging.info("经过额外等待后，已成功导航到迷宫页面")
                        return True
            except Exception as e:
                logging.info(f"策略1失败: {str(e)}")
            
            # 策略2: 直接查找迷宫导航链接
            logging.info("尝试策略2: 通过CSS选择器查找迷宫导航...")
            try:
                # 先找到所有导航链接
                nav_elements = self.driver.find_elements(By.CSS_SELECTOR, ".NavigationBar_navigationLink__3eAHA")
                
                for element in nav_elements:
                    try:
                        # 尝试找到文本为"迷宫"的标签
                        label_elements = element.find_elements(By.CSS_SELECTOR, ".NavigationBar_label__1uH-y")
                        if label_elements and label_elements[0].text.strip() == '迷宫':
                            # 检查是否已经是激活状态
                            if "NavigationBar_active__" in element.get_attribute("class"):
                                logging.info("迷宫导航已是激活状态")
                                if self.verify_labyrinth_page():
                                    logging.info("当前已在迷宫页面")
                                    return True
                                else:
                                    logging.info("导航项显示激活但实际不在迷宫页面，重新点击")
                            
                            # 使用JavaScript点击以绕过可能的遮挡元素
                            self.driver.execute_script("arguments[0].click();", element)
                            logging.info("找到迷宫导航项，已点击")
                            
                            # 等待页面切换
                            human_delay(self.button_click_delay_min, self.button_click_delay_max)
                            
                            # 验证是否到达正确的迷宫页面
                            if self.verify_labyrinth_page():
                                logging.info("已成功导航到迷宫页面")
                                return True
                            else:
                                human_delay(2, 4)
                                if self.verify_labyrinth_page():
                                    logging.info("经过额外等待后，已成功导航到迷宫页面")
                                    return True
                    except Exception as e:
                        logging.debug(f"检查导航项时出错: {str(e)}")
                        continue  # 继续尝试下一个元素
            except Exception as e:
                logging.error(f"策略2执行时出错: {str(e)}")
            
            # 策略3: 通过SVG图标href属性查找
            logging.info("尝试策略3: 通过SVG图标href属性查找迷宫导航...")
            try:
                svg_elements = self.driver.find_elements(By.CSS_SELECTOR, "use[href*='misc_sprite']")
                for svg in svg_elements:
                    try:
                        href = svg.get_attribute("href")
                        if href and "labyrinth" in href:
                            parent_link = svg.find_element(By.XPATH, "./ancestor::div[contains(@class, 'NavigationBar_navigationLink__')]")
                            if parent_link:
                                # 检查是否已经是激活状态
                                if "NavigationBar_active__" in parent_link.get_attribute("class"):
                                    logging.info("迷宫导航已是激活状态")
                                    if self.verify_labyrinth_page():
                                        logging.info("当前已在迷宫页面")
                                        return True
                                    else:
                                        logging.info("导航项显示激活但实际不在迷宫页面，重新点击")
                                
                                # 使用JavaScript点击以绕过可能的遮挡元素
                                self.driver.execute_script("arguments[0].click();", parent_link)
                                logging.info("找到迷宫导航项，已点击")
                                
                                # 等待页面切换
                                human_delay(self.button_click_delay_min, self.button_click_delay_max)
                                
                                # 验证是否到达正确的迷宫页面
                                if self.verify_labyrinth_page():
                                    logging.info("已成功导航到迷宫页面")
                                    return True
                                else:
                                    human_delay(2, 4)
                                    if self.verify_labyrinth_page():
                                        logging.info("经过额外等待后，已成功导航到迷宫页面")
                                        return True
                    except Exception as e:
                        logging.debug(f"检查SVG元素时出错: {str(e)}")
                        continue  # 继续尝试下一个元素
            except Exception as e:
                logging.error(f"策略3执行时出错: {str(e)}")
            
            # 策略4: 通过XPath查找包含"迷宫"文本的导航项
            logging.info("尝试策略4: 通过XPath查找包含'迷宫'文本的导航项...")
            try:
                xpath_elements = self.driver.find_elements(By.XPATH, "//span[contains(text(), '迷宫')]/ancestor::div[contains(@class, 'NavigationBar_navigationLink__')]")
                if xpath_elements:
                    for element in xpath_elements:
                        # 检查是否已经是激活状态
                        if "NavigationBar_active__" in element.get_attribute("class"):
                            logging.info("迷宫导航已是激活状态")
                            if self.verify_labyrinth_page():
                                logging.info("当前已在迷宫页面")
                                return True
                            else:
                                logging.info("导航项显示激活但实际不在迷宫页面，重新点击")
                    
                    logging.info("找到迷宫导航项，准备点击")
                    # 使用JavaScript点击以绕过可能的遮挡元素
                    self.driver.execute_script("arguments[0].click();", xpath_elements[0])
                    
                    # 等待页面切换
                    human_delay(self.button_click_delay_min, self.button_click_delay_max)
                    
                    if self.verify_labyrinth_page():
                        logging.info("已成功导航到迷宫页面")
                        return True
                    else:
                        human_delay(2, 4)
                        if self.verify_labyrinth_page():
                            logging.info("经过额外等待后，已成功导航到迷宫页面")
                            return True
            except Exception as e:
                logging.error(f"策略4执行时出错: {str(e)}")
            
            # 策略5: 检查当前是否已在迷宫页面（这是最重要的修复）
            logging.info("尝试策略5: 检查当前是否已在迷宫页面...")
            try:
                if self.verify_labyrinth_page():
                    logging.info("当前已在迷宫页面")
                    return True
            except Exception as e:
                logging.error(f"检查当前页面状态时出错: {str(e)}")
            
            logging.error("所有策略都未能找到迷宫导航项")
            return False
        except Exception as e:
            logging.error(f"导航失败: {str(e)}")
            return False
    
    def detect_ticket_count(self):
        """
        检测门票数量
        使用正则表达式匹配"入场券： {cnt} / 5"或"入场券: {cnt} / 5"格式
        """
        try:
            # 先尝试关闭可能存在的弹窗
            self.close_offline_progress_modal()
            
            logging.info("开始检测门票数量...")
            # 查找门票数量元素
            ticket_element = self.wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".LabyrinthPanel_chargeCount__1GDLP"))
            )
            
            ticket_text = ticket_element.text
            logging.info(f"门票文本: '{ticket_text}'")
            
            # 使用正则表达式匹配"入场券： {cnt} / 5"或"入场券: {cnt} / 5"格式
            # 适配中英文冒号和各种空白字符
            pattern = r'入场券[：:]\s*(\d+)\s*/\s*5'
            match = re.search(pattern, ticket_text)
            
            if match:
                current = int(match.group(1))
                total = 5
                logging.info(f"检测到门票数量: {current}/{total}")
                return current, total
            else:
                logging.warning(f"未能匹配门票格式，实际文本: '{ticket_text}'")
                # 尝试其他可能的格式
                alt_pattern = r'(\d+)\s*/\s*5'
                alt_match = re.search(alt_pattern, ticket_text)
                if alt_match:
                    current = int(alt_match.group(1))
                    total = 5
                    logging.info(f"使用备用格式检测到门票数量: {current}/{total}")
                    return current, total
                else:
                    logging.error("无法解析门票数量")
                    return 0, 0
        except Exception as e:
            logging.error(f"检测门票数量失败: {str(e)}")
            return 0, 0

    def get_ticket_count(self):
        """
        获取门票数量
        返回格式为 {"current": current, "max": max} 的字典
        """
        current, max_tickets = self.detect_ticket_count()
        if current > 0 or max_tickets > 0:
            return {"current": current, "max": max_tickets}
        else:
            return None

    def replenish_tickets(self):
        """补充门票"""
        try:
            # 先尝试关闭可能存在的弹窗
            self.close_offline_progress_modal()
            
            logging.info("尝试补充门票...")
            
            # 查找设置导航项
            logging.info("查找设置导航...")
            
            # 策略1: 通过 aria-label="navigationBar.settings" 查找设置导航
            settings_nav = None
            try:
                settings_nav = WebDriverWait(self.driver, 10).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, "[aria-label='navigationBar.settings']"))
                )
                logging.info("找到设置导航项（通过aria-label），准备点击")
            except:
                logging.info("未找到aria-label为navigationBar.settings的元素")
            
            # 策略2: 如果策略1失败，通过文本查找
            if not settings_nav:
                try:
                    settings_nav = WebDriverWait(self.driver, 5).until(
                        EC.element_to_be_clickable((By.XPATH, "//span[text()='设置']/ancestor::div[@class='NavigationBar_navigationLink__3eAHA']"))
                    )
                    logging.info("找到设置导航项（通过文本），准备点击")
                except:
                    logging.warning("未找到文本为'设置'的导航项")
            
            # 策略3: 如果前两种策略都失败，通过包含settings图标的元素查找
            if not settings_nav:
                try:
                    settings_svg = self.driver.find_element(By.CSS_SELECTOR, "use[href*='settings']")
                    settings_nav = settings_svg.find_element(By.XPATH, "../../../..")
                    logging.info("找到设置导航项（通过SVG图标），准备点击")
                except:
                    logging.error("所有策略都未能找到设置导航项")
                    return False
            
            if settings_nav:
                # 先尝试普通点击，如果失败再使用JavaScript点击
                try:
                    settings_nav.click()
                except:
                    # 如果普通点击失败，使用ActionChains
                    from selenium.webdriver.common.action_chains import ActionChains
                    actions = ActionChains(self.driver)
                    actions.move_to_element(settings_nav).click().perform()
                
                logging.info("已点击设置导航项")
                
                # 等待设置页面内容加载
                human_delay(self.button_click_delay_min, self.button_click_delay_max)
                
                # 检查是否有不可补充的提示（带倒计时的按钮）
                disabled_replenish_btn = self.driver.find_elements(By.CSS_SELECTOR, ".SettingsPanel_value__2nsKD .Button_button__1Fe9z.Button_disabled__wCyIq")
                if disabled_replenish_btn and "补充入场券" in disabled_replenish_btn[0].text:
                    countdown_text = disabled_replenish_btn[0].find_element(By.XPATH, "./following-sibling::*").text
                    if countdown_text:
                        logging.info(f"门票暂时不可补充，还有 {countdown_text}")
                        # 返回迷宫界面
                        self.navigate_to_labyrinth()
                        return False
                
                # 查找补充门票按钮
                logging.info("查找补充门票按钮...")
                replenish_btn = None
                
                # 尝试多种选择器来定位补充门票按钮
                selectors = [
                    (By.XPATH, "//button[contains(text(), '补充入场券') and not(contains(@class, 'Button_disabled__wCyIq'))]"),
                    (By.XPATH, "//button[contains(text(), '补充门票') and not(contains(@class, 'Button_disabled__wCyIq'))]"),
                    (By.CSS_SELECTOR, "button.Button_success__6d6kU:not(.Button_disabled__wCyIq)"),
                    (By.XPATH, "//button[contains(@class, 'Button') and contains(@class, 'success') and not(contains(@class, 'Button_disabled__wCyIq'))]")
                ]
                
                for selector_type, selector in selectors:
                    try:
                        replenish_btn = WebDriverWait(self.driver, 5).until(
                            EC.element_to_be_clickable((selector_type, selector))
                        )
                        if replenish_btn.is_displayed() and replenish_btn.is_enabled():
                            logging.info(f"使用选择器 '{selector}' 找到补充门票按钮")
                            break
                    except:
                        continue
                
                # 如果没有找到按钮，尝试滚动页面
                if not replenish_btn:
                    logging.info("未找到补充门票按钮，尝试滚动页面...")
                    # 滚动到页面底部，然后再查找
                    self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                    human_delay(1, 2)
                    
                    # 再次尝试查找按钮
                    for selector_type, selector in selectors:
                        try:
                            replenish_btn = self.driver.find_element(selector_type, selector)
                            if replenish_btn.is_displayed() and replenish_btn.is_enabled():
                                logging.info(f"滚动后使用选择器 '{selector}' 找到补充门票按钮")
                                break
                        except:
                            continue
                
                # 如果仍然没有找到按钮，尝试滚动到页面顶部
                if not replenish_btn:
                    logging.info("再次尝试滚动到页面顶部...")
                    self.driver.execute_script("window.scrollTo(0, 0);")
                    human_delay(1, 2)
                    
                    # 再次尝试查找按钮
                    for selector_type, selector in selectors:
                        try:
                            replenish_btn = self.driver.find_element(selector_type, selector)
                            if replenish_btn.is_displayed() and replenish_btn.is_enabled():
                                logging.info(f"滚动到顶部后使用选择器 '{selector}' 找到补充门票按钮")
                                break
                        except:
                            continue
                
                if replenish_btn:
                    logging.info("找到补充门票按钮，准备点击")
                    # 先尝试普通点击
                    try:
                        replenish_btn.click()
                    except:
                        # 如果普通点击失败，使用ActionChains
                        try:
                            from selenium.webdriver.common.action_chains import ActionChains
                            actions = ActionChains(self.driver)
                            actions.move_to_element(replenish_btn).click().perform()
                        except:
                            # 最后尝试JavaScript点击
                            self.driver.execute_script("arguments[0].click();", replenish_btn)
                    
                    logging.info("已点击补充门票按钮")
                    
                    # 等待一段时间后重新检测门票数量
                    human_delay(self.button_click_delay_min, self.button_click_delay_max)
                    current, max_tickets = self.detect_ticket_count()
                    
                    if current > 0:
                        logging.info(f"门票补充成功，当前数量: {current}/{max_tickets}")
                        # 返回迷宫界面
                        self.navigate_to_labyrinth()
                        return True
                    else:
                        logging.error("门票补充失败")
                        # 返回迷宫界面
                        self.navigate_to_labyrinth()
                        return False
                else:
                    logging.error("未找到可点击的补充门票按钮")
                    
                    # 输出当前页面所有按钮用于调试
                    buttons = self.driver.find_elements(By.TAG_NAME, "button")
                    logging.info(f"页面上找到 {len(buttons)} 个按钮:")
                    for i, btn in enumerate(buttons[:10]):  # 仅记录前10个按钮
                        logging.info(f"  按钮 {i+1}: {btn.text} | Class: {btn.get_attribute('class')} | Enabled: {btn.is_enabled()} | Displayed: {btn.is_displayed()}")
                    
                    # 返回迷宫界面
                    self.navigate_to_labyrinth()
                    return False
            else:
                logging.error("未找到设置导航项")
                return False
        except Exception as e:
            logging.error(f"补充门票失败: {str(e)}")
            # 确保即使发生异常也要返回迷宫界面
            self.navigate_to_labyrinth()
            return False

    def enter_labyrinth(self):
        """进入迷宫"""
        try:
            # 先尝试关闭可能存在的弹窗
            self.close_offline_progress_modal()
            
            logging.info("尝试进入迷宫...")
            
            # 查找进入迷宫按钮
            logging.info("查找进入迷宫按钮...")
            enter_btn = None
            
            # 尝试多种方式定位进入迷宫按钮
            enter_btn_selectors = [
                (By.XPATH, "//button[contains(text(), '进入迷宫')]"),
                (By.CSS_SELECTOR, ".LabyrinthPanel_buttonsContainer__2oY1b button.Button_success__6d6kU"),
                (By.CSS_SELECTOR, "button.Button_success__6d6kU.Button_large__yIDVZ"),
            ]
            
            for selector_type, selector in enter_btn_selectors:
                try:
                    enter_btn = self.wait.until(EC.element_to_be_clickable((selector_type, selector)))
                    logging.info(f"使用选择器 '{selector}' 找到进入迷宫按钮")
                    break
                except:
                    continue
            
            if enter_btn:
                logging.info("找到进入迷宫按钮，准备点击")
                enter_btn.click()
                logging.info("已点击进入迷宫按钮")
                
                # 使用按钮点击延迟
                human_delay(self.button_click_delay_min, self.button_click_delay_max)
                
                # 查找开始按钮
                start_btn_selectors = [
                    (By.XPATH, "//button[contains(text(), '立即开始')]"),
                    (By.CSS_SELECTOR, "button.Button_success__6d6kU:not(.Button_large__yIDVZ)")
                ]
                
                start_btn = None
                for selector_type, selector in start_btn_selectors:
                    try:
                        start_btn = self.driver.find_element(selector_type, selector)
                        if start_btn.is_displayed():
                            logging.info(f"找到开始按钮，准备点击")
                            start_btn.click()
                            logging.info("已点击开始按钮")
                            break
                    except:
                        continue
                
                return True
            else:
                logging.error("未找到进入迷宫按钮")
                return False
        except Exception as e:
            logging.error(f"进入迷宫失败: {str(e)}")
            return False

    def escape_labyrinth(self):
        """逃离迷宫"""
        try:
            # 先尝试关闭可能存在的弹窗
            self.close_offline_progress_modal()
            
            logging.info("尝试逃离迷宫...")
            
            # 查找结束迷宫按钮
            logging.info("查找结束迷宫按钮...")
            exit_btn = self.driver.find_elements(By.XPATH, "//button[contains(text(), '结束迷宫') and not(contains(@class, 'Button_disabled__wCyIq'))]")
            
            if exit_btn and len(exit_btn) > 0:
                logging.info("找到可点击的结束迷宫按钮，准备点击")
                exit_btn[0].click()
                
                # 使用按钮点击延迟
                human_delay(self.button_click_delay_min, self.button_click_delay_max)
                
                # 处理确认弹窗
                # 第一个确认弹窗
                first_confirm = self.driver.find_elements(By.XPATH, "//button[contains(text(), '确定')]")
                if first_confirm:
                    logging.info("找到第一个确认按钮，准备点击")
                    first_confirm[0].click()
                    
                    # 使用按钮点击延迟
                    human_delay(self.button_click_delay_min, self.button_click_delay_max)
                    
                    # 第二个确认弹窗
                    second_confirm = self.driver.find_elements(By.XPATH, "//button[contains(text(), '确定')]")
                    if second_confirm:
                        logging.info("找到第二个确认按钮，准备点击")
                        second_confirm[0].click()
                    
                    logging.info("迷宫已结束")
                    return True
                else:
                    logging.error("未找到确认按钮")
                    return False
            else:
                logging.error("未找到可点击的结束迷宫按钮")
                return False
        except Exception as e:
            logging.error(f"逃离迷宫失败: {str(e)}")
            return False

    def close_offline_progress_modal(self):
        """关闭离线进度弹窗"""
        try:
            # 查找离线进度弹窗
            modal_elements = self.driver.find_elements(By.CLASS_NAME, "OfflineProgressModal_modal__2W5xv")
            if modal_elements:
                logging.info("检测到离线进度弹窗，准备关闭")
                
                # 尝试多种方式关闭弹窗
                close_selectors = [
                    (By.CSS_SELECTOR, ".OfflineProgressModal_closeButton__3g3Y2"),  # 右上角关闭按钮
                    (By.CSS_SELECTOR, ".OfflineProgressModal_modalContent__3ZsUb button"),  # 底部关闭按钮
                    (By.XPATH, "//button[contains(text(), '关闭')]"),  # 包含"关闭"文字的按钮
                ]
                
                closed = False
                for selector_type, selector in close_selectors:
                    try:
                        close_btn = self.driver.find_element(selector_type, selector)
                        if close_btn.is_displayed():
                            logging.info(f"找到关闭按钮，使用选择器: {selector}")
                            close_btn.click()
                            logging.info("已点击关闭按钮")
                            closed = True
                            break
                    except:
                        continue
                
                if not closed:
                    logging.warning("未能找到关闭按钮，尝试其他方式关闭弹窗")
                    # 尝试ESC键关闭
                    from selenium.webdriver.common.keys import Keys
                    self.driver.find_element(By.TAG_NAME, 'body').send_keys(Keys.ESCAPE)
                
                # 等待弹窗消失
                WebDriverWait(self.driver, 5).until_not(
                    EC.presence_of_element_located((By.CLASS_NAME, "OfflineProgressModal_modal__2W5xv"))
                )
                logging.info("离线进度弹窗已关闭")
                return True
            else:
                logging.info("未检测到离线进度弹窗")
                return False
        except Exception as e:
            logging.error(f"关闭离线进度弹窗时出现错误: {str(e)}")
            return False

    def detect_labyrinth_status(self):
        """检测是否在迷宫中"""
        try:
            # 先尝试关闭可能存在的弹窗
            self.close_offline_progress_modal()
            
            logging.info("开始检测迷宫状态...")
            
            # 检查是否存在"结束迷宫"按钮，这表示正在迷宫中
            exit_btn_elements = self.driver.find_elements(By.XPATH, "//button[contains(text(), '结束迷宫') and not(contains(@class, 'Button_disabled__wCyIq'))]")
            if exit_btn_elements:
                logging.info("检测到结束迷宫按钮，正在迷宫中")
                return True
            
            # 检查是否存在"进入迷宫"按钮，这表示在迷宫主页
            enter_btn_elements = self.driver.find_elements(By.XPATH, "//button[contains(text(), '进入迷宫')]")
            if enter_btn_elements:
                logging.info("检测到进入迷宫按钮，当前在迷宫主页")
                return False
            
            # 检查是否在房间网格视图中（迷宫内部）
            room_grid_elements = self.driver.find_elements(By.CLASS_NAME, "RoomGrid_roomGrid__3aSCT")
            if room_grid_elements:
                logging.info("检测到房间网格，正在迷宫中")
                return True
            
            # 检查是否有活动房间容器
            active_room_elements = self.driver.find_elements(By.CLASS_NAME, "ActiveRoomContainer_activeRoomContainer__3J99C")
            if active_room_elements:
                logging.info("检测到活动房间容器，正在迷宫中")
                return True
            
            # 检查房间标签页是否有活动房间
            room_tab_elements = self.driver.find_elements(By.CLASS_NAME, "LabyrinthPanel_roomTab__1GdPe")
            if room_tab_elements:
                # 检查房间标签页中是否有"当前没有房间进行中"的文本
                empty_state_elements = self.driver.find_elements(By.CLASS_NAME, "LabyrinthPanel_emptyState__2iQfd")
                if empty_state_elements and any("当前没有房间进行中" in elem.text for elem in empty_state_elements):
                    logging.info("迷宫标签页显示没有房间进行中，不在迷宫中")
                    return False
                elif empty_state_elements:
                    logging.info("迷宫中有房间活动，正在迷宫中")
                    return True
            
            # 检查迷宫主面板是否存在
            labyrinth_panel = self.driver.find_elements(By.CLASS_NAME, "LabyrinthPanel_labyrinthPanel__20JNz")
            if labyrinth_panel:
                # 检查是否显示的是迷宫入口界面
                entry_screen = self.driver.find_elements(By.CLASS_NAME, "LabyrinthPanel_entryScreen__pOtpK")
                if entry_screen:
                    logging.info("在迷宫入口界面，尚未进入迷宫")
                    return False
                else:
                    logging.info("在迷宫面板中，但不在入口界面，可能正在迷宫中")
                    return True
            
            logging.info("未检测到迷宫状态，可能不在迷宫中")
            return False
        except Exception as e:
            logging.error(f"检测迷宫状态时出现错误: {str(e)}")
            return False
    
    def start(self):
        """开始自动化"""
        logging.info("开始自动化进程...")
        
        # 初始化浏览器
        logging.info("初始化浏览器...")
        if not self.init_driver():
            logging.error("浏览器初始化失败")
            return
        
        # 加载cookies
        self.load_cookies()
        
        # 访问页面
        logging.info(f"访问页面: {self.url}")
        self.driver.get(self.url)
        
        # 验证登录状态
        if not self.verify_login_status():
            logging.info("检测到需要登录，将在浏览器中打开页面，请手动登录...")
            logging.info("登录完成后，请返回此程序并按Enter键继续...")
            input("请在浏览器中完成登录，完成后按Enter键继续...")
            
            # 保存cookies
            self.save_cookies()
            logging.info("登录信息已保存")
        
        # 确保导航到迷宫页面
        logging.info("导航到迷宫页面...")
        if not self.navigate_to_labyrinth():
            logging.error("无法导航到迷宫页面，请检查网络连接或页面结构变化")
            self.stop()
            return

        # 开始自动化循环
        self.running = True
        logging.info("开始自动化循环...")
        
        while self.running:
            try:
                self.run_cycle()
            except KeyboardInterrupt:
                logging.info("\n用户中断，停止自动化...")
                self.running = False
            except Exception as e:
                logging.error(f"执行循环时发生错误: {str(e)}")
                break
        
        # 停止自动化
        self.stop()
    
    def run_cycle(self):
        """执行一个完整的自动化循环"""
        cycle_start_time = time.time()
        logging.info(f"开始第 {self.cycle_count} 个循环")
        
        # 只在程序刚开始运行时检查离线进度弹窗
        if self.cycle_count == 1:
            logging.info("检查初始离线进度弹窗...")
            self.close_offline_progress_modal()
        
        logging.info("开始执行迷宫循环...")
        
        # 检查门票数量
        logging.info("开始检测门票数量...")
        tickets = self.get_ticket_count()
        if tickets is None:
            logging.warning("获取门票数量失败，跳过本次循环")
            time.sleep(random.uniform(self.status_check_interval_min, self.status_check_interval_max))
            return
        
        logging.info(f"当前门票: {tickets['current']}/{tickets['max']}")
        
        # 补充门票
        if tickets['current'] <= 2:  # 如果门票少于等于2张，则补充
            logging.info("门票不足，尝试补充...")
            if not self.replenish_tickets():
                logging.error("补充门票失败，跳过本次循环")
                time.sleep(random.uniform(self.status_check_interval_min, self.status_check_interval_max))
                return
        else:
            logging.info("门票充足，无需补充")
        
        # 进入迷宫
        logging.info("准备进入迷宫...")
        if not self.enter_labyrinth():
            logging.error("进入迷宫失败，跳过本次循环")
            time.sleep(random.uniform(self.status_check_interval_min, self.status_check_interval_max))
            return
        
        # 等待一段时间，让迷宫运行
        time.sleep(30)  # 等待30秒再检查
        
        # 尝试退出迷宫
        logging.info("尝试退出迷宫...")
        if not self.escape_labyrinth():
            logging.error("退出迷宫失败，跳过本次循环")
            time.sleep(random.uniform(self.status_check_interval_min, self.status_check_interval_max))
            return
        
        # 循环结束后等待一段时间
        delay = random.uniform(self.between_cycles_delay_min, self.between_cycles_delay_max)
        logging.info(f"循环完成，等待 {delay:.2f} 秒后开始下一个循环...")
        time.sleep(delay)
        
        # 增加循环计数
        self.cycle_count += 1
    
    def stop(self):
        """停止自动化"""
        logging.info("停止迷宫自动化...")
        self.running = False
        if self.driver:
            # 保存当前cookies
            self.save_cookies()
            self.driver.quit()
            logging.info("浏览器已关闭")


def main():
    """
    主函数
    """
    # 初始化日志
    setup_logging()
    
    # 可以通过修改这里的参数来启用无头模式
    headless_mode = False  # 设为True以启用无头模式
    
    logging.info("初始化基于Selenium的迷宫自动化程序...")
    
    # 创建自动化实例，传递headless参数
    automation = SeleniumLabyrinthAutomation(headless=headless_mode)
    
    try:
        # 开始自动化
        logging.info("开始自动化进程...")
        automation.start()
    except KeyboardInterrupt:
        logging.info("\n程序被用户中断")
        automation.stop()
    finally:
        logging.info("程序结束")


if __name__ == "__main__":
    main()