.data

.text
    li a7,5
    ecall
    mv a6,a0 #n
    li a3,1 #i
    li t2,0
    fcvt.s.w fa1,t2 #sum
    li t2,1
    fcvt.s.w fa6,t2
    loop:
        fcvt.s.w fa2,a3 #i
        li t2,2
        fcvt.s.w fa3,t2
        fmul.s fa4,fa3,fa2 #i*2
        li t2,1
        fcvt.s.w fa3,t2
        fsub.s fa2,fa4,fa3 #i*2-1
        li t2,4
        fcvt.s.w fa3,t2
        fdiv.s fa4,fa3,fa2 #4/(i*2-1)
        fmul.s fa4,fa4,fa6
        li t2,0
        fcvt.s.w fa3,t2
        fsub.s fa6,fa3,fa6#反转符号
        fadd.s fa1,fa1,fa4 #sum+=4/(i*2-1)
        addi a3,a3,1 #i+=1
        blt a3,a6,loop
    fmv.s fa0,fa1
    li a7,2
    ecall

    li a7,10    
    ecall
    
# pi=4-4/(1*2-1)+4/(2*2-1)-4/(3*2-1)+4/(4*2-1)-...
#收敛超级慢

