# f=[0,1.8115,5.6594]
# # f_1=d[(p0*x)/(1-(1-p0)*x)]/dx at x=1
# # f_2=d[(p0*p1*x^2)/(1-(1-p1)*p0*x^2-(1-p0)*x)]/dx at x=1
# for i in range(2,20):
#     f.append(f[i]+f[i-1])
# print([format(x, '.4f') for x in f])
# p=[0]*20
# for i in range(3,20):
#     # f[i]<=(1-p)*f[i-1]+p*f[i+1]=f[i-1]+p*(-f[i-1]+f[i+1])
#     # p>=(f[i]-f[i-1])/(-f[i-1]+f[i+1])
#     p[i]=(f[i]-f[i-1])/(-f[i-1]+f[i+1])
# print([format(x*100, '.2f')+'%' for x in p[3:20]])
f=[(1,0),(0,1)]
for i in range(2,11):
    f.append((f[i-1][0]+f[i-2][0],f[i-1][1]+f[i-2][1]))
print("\n".join([f"{i}:({x[0]},{x[1]})" for x,i in zip(f[0:11],range(10,21))] ))
h=[0]*21
h[15]=1
h[17]=1
x=0
y=0
for i in range(0,11):
    x+=f[i][0]*h[i+10]
    y+=f[i][1]*h[i+10]
print(f[10][0]-x," ",f[10][1]-y) 
