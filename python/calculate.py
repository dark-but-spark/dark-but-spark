import math 
# import flask
# import latex2sympy2
# e=1e-5
# x=e
# sum=0
# while x<1-e:
#     sum+=e*(-math.log(1-x)/x)
#     x+=e
# print(sum-math.pi**2/6)
ans=0
for i in range(15):
    ans+=5**i*math.exp(-5)/math.factorial(i)
print(ans)
print(format(1-ans,'.4e'))