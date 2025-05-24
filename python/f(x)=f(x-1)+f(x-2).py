def f(x):
    if x<3:
        return x
    else:
        return f(x-1) + f(x-2)
x=[0]*200
y=[0]*200
z=[0]*200
for i in range(200):
    x[i]=i/10
    if(i>=30):
        y[i]=y[i-10]+y[i-20]
    else:
        y[i]=(i/10)
    z[i]=1.5**(i/10)
import matplotlib.pyplot as plt
plt.plot(x,y,label='f(x)')
plt.plot(x,z,label='1.5^x')
plt.xlabel('x')
plt.ylabel('f(x)')
plt.legend()
plt.show()