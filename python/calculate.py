import math 
e=1e-5
x=e
sum=0
while x<1-e:
    sum+=e*(-math.log(1-x)/x)
    x+=e
print(sum-math.pi**2/6)