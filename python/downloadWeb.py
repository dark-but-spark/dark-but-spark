import requests
from bs4 import BeautifulSoup

def download_website(url, save_dir):
    # 下载主页
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    # 下载页面中的资源文件
    for tag in soup.find_all(['link', 'script', 'img']):
        if tag.has_attr('src'):
            file_url = tag['src']
            file_name = file_url.split('/')[-1]
            file_save_path = save_dir + '/' + file_name
            # 下载文件
            file_response = requests.get(file_url)
            with open(file_save_path, 'wb') as f:
                f.write(file_response.content)

# 使用示例
download_website('https://musedash.peropero.net/#/version', 'E:/musedash/1')