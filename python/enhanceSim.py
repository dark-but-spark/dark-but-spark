f=[0,1.8115,5.6594]
# f_1=d[(p0*x)/(1-(1-p0)*x)]/dx at x=1
# f_2=d[(p0*p1*x^2)/(1-(1-p1)*p0*x^2-(1-p0)*x)]/dx at x=1
for i in range(2,20):
    f.append(f[i]+f[i-1])
print([format(x, '.4f') for x in f])
p=[0]*20
for i in range(3,20):
    # f[i]<=(1-p)*f[i-1]+p*f[i+1]=f[i-1]+p*(-f[i-1]+f[i+1])
    # p>=(f[i]-f[i-1])/(-f[i-1]+f[i+1])
    p[i]=(f[i]-f[i-1])/(-f[i-1]+f[i+1])
print([format(x*100, '.2f')+'%' for x in p[3:20]])