for i in range(8):
    a = bool(i & 1)
    b = bool((i >> 1) & 1)
    c = bool((i >> 2) & 1)

    t1 = not (a and b)
    t2 = not (a or b)
    t3 = t1 and (not c)
    t4 = (not t2) and t1
    f1 = (t4 != c)              # XOR
    f2 = not (t3 or t2)

    # 预测式（等价化简）
    f1_pred = not(c) and (a !=b)# XNOR 与 c
    f2_pred = (a and b) or (a and c) or (b and c)

    print(f"a={int(a)} b={int(b)} c={int(c)} => "
          f"t1={int(t1)} t2={int(t2)} t3={int(t3)} t4={int(t4)} "
          f"f1={int(f1)} f1_pred={int(f1_pred)} f2={int(f2)} f2_pred={int(f2_pred)}")