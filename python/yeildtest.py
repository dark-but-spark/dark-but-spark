def f(x):
    while x<=10:
        yield x
        x+=1
print(type(f(1)))
a=f(1)
print(next(a))
while True:
    try:
        value = next(a)
        print(value)
    except StopIteration:
        print("all done, throwing StopIteration")
        break  

for i in f(1):
    print(i,end=" ")