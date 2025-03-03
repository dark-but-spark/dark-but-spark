import ctypes 
import math
import time
from ctypes import wintypes
import random
import win32con
screen_width = ctypes.windll.user32.GetSystemMetrics(0)
screen_height = ctypes.windll.user32.GetSystemMetrics(1)
class MOUSEINPUT(ctypes.Structure):
    _fields_ = [("dx", ctypes.c_long),
                ("dy", ctypes.c_long),
                ("mouseData", ctypes.c_ulong),
                ("dwFlags", ctypes.c_ulong),
                ("time", ctypes.c_ulong),
                ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong))]
class KEYBDINPUT(ctypes.Structure):
    _fields_ = [("wVk", ctypes.wintypes.WORD),
                ("wScan", ctypes.wintypes.WORD),
                ("dwFlags", ctypes.c_ulong),
                ("time", ctypes.c_ulong),
                ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong))]
class INPUT(ctypes.Structure):
    class _INPUT(ctypes.Union):
        _fields_ =[("mi", MOUSEINPUT),
                    ("ki", KEYBDINPUT)]

    _fields_ = [("type", ctypes.c_ulong),
                ("input", _INPUT)]
def main():
    n=1024
    for i in range(n):
        x=1
        y=random.randint(-100,100)
        inputs =[] 
        inputs.append(INPUT(type=0, input=INPUT._INPUT(mi=MOUSEINPUT(dx=x, dy=x, mouseData=0, dwFlags=win32con.MOUSEEVENTF_MOVE, time=0, dwExtraInfo=None))))
        ctypes.windll.user32.SendInput(len(inputs), ctypes.byref(inputs[0]), ctypes.sizeof(INPUT))
        time.sleep(.1)

main()