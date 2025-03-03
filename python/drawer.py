import pandas as pd
import math
# a=int(input())
# b=int(input())
# print(a+b)
x=1
n=int(1e5)
# print(math.tan(1)) 
while(1):
    sum=0
    # for i in range(1,n+1):
        # sum+=i/(n*n+n+i)
    print((n+(n+2*n**0.5)**0.5)**0.5-n**0.5)
    print((n+n**0.5+1)**0.5
          -n**0.5)
    n*=2
    input()

    # x=x-(math.tan(x)-1)*(math.cos(x)*math.cos(x))
    # print(x/math.pi)