import random

dict={}
f=[0]*5
a=['胡xl','刘yj','马jy','张jb']
b=['','罢工','军校','北伐','清党']
dict[a[0]]='罢工'
f[1]=1
dict[a[2]]='军校'
f[2]=1

for i in [1,3]:
    x=random.randint(1,4)
    while f[x]==1:
        x=random.randint(1,4)
    f[x]=1
    dict[a[i]]=b[x]
print(dict)