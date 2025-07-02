import numpy as np


# 定义量子门
H = np.array([[1/np.sqrt(2), 1/np.sqrt(2)], [1/np.sqrt(2), -1/np.sqrt(2)]])
X = np.array([[0, 1], [1, 0]])
Y = np.array([[0, -1j], [1j, 0]])
Z= np.array([[1, 0], [0, -1]])
S= np.array([[1, 0], [0, 1j]])

# 计算每个门的特征分解
gates = [
    (np.eye(2), "I"),
    (H, "H"),
    (X, "X"),
    (Y, "Y"),
    (Z, "Z"),
    (S, "S"),
    (H.conj().T, "H†"),
    (X.conj().T, "X†"),
    (Y.conj().T, "Y†"),
    (Z.conj().T, "Z†"),
    (S.conj().T, "S†"),
]
Newgates = []
relations=[]
def check(X,Y):
    k=0
    for i in range(2):
        for j in range(2):
            if Y[i][j]==0:
                if(X[i][j] != 0):
                    return 0
            elif X[i][j]!=0:
                if(k==0):
                    k=X[i][j]/Y[i][j] 
                else:
                    if(X[i][j]/Y[i][j]>=k+0.00001 or X[i][j]/Y[i][j]<=k-0.00001):
                        return 0
    return k

id=0
for A, Aname in gates:
    for B,Bname in gates:
        if Aname!='I'and Bname!='I':
            C=A @ B
            for D,Dname in gates:
                k=check(C,D)
                if k!=0:
                    break
                
            if k!=0:
                relations.append(f"{Aname} @ {Bname} = {k} * {Dname}")
                print(f"{Aname} @ {Bname} = {k} * {Dname}")
            else:
                id+=1
                gates.append((C, f"NewGate{id}"))
                gates.append((C.conj().T, f"NewGate{id}†"))
                relations.append(f"{Aname} @ {Bname} = NewGate{id}")
                print(f"{Aname} @ {Bname} = NewGate{id}")
                print(C)

